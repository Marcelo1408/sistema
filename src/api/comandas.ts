import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Data de hoje no horário de Brasília (UTC-3)
const hojeBr = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)

// Recalcula o total da comanda e do pedido vinculado
async function recalcularTotal(db: D1Database, pedidoId: number, comandaId: number) {
  const r = await db.prepare('SELECT COALESCE(SUM(subtotal), 0) AS t FROM itens_pedido WHERE pedido_id = ?').bind(pedidoId).first() as any
  const total = r?.t || 0
  await db.prepare('UPDATE comandas SET total = ? WHERE id = ?').bind(total, comandaId).run()
  await db.prepare('UPDATE pedidos SET total = ? WHERE id = ?').bind(total, pedidoId).run()
  return total
}

// Listar comandas ABERTAS (com itens)
app.get('/', async (c) => {
  const { results: comandas } = await c.env.DB.prepare(`
    SELECT * FROM comandas WHERE status = 'aberta' ORDER BY id DESC
  `).all()

  for (const com of comandas as any[]) {
    const itens = await c.env.DB.prepare(`
      SELECT ip.*, pr.nome AS produto
      FROM itens_pedido ip
      LEFT JOIN produtos pr ON pr.id = ip.produto_id
      WHERE ip.pedido_id = ?
      ORDER BY ip.id ASC
    `).bind(com.pedido_id).all()
    com.itens = itens.results
  }

  return c.json(comandas)
})

// Histórico (fechadas/canceladas)
app.get('/historico', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT * FROM comandas WHERE status != 'aberta' ORDER BY COALESCE(data_fechamento, criado_em) DESC LIMIT 30
  `).all()
  return c.json(results)
})

// Abrir comanda
app.post('/abrir', async (c) => {
  const { mesa_numero, nome_cliente } = await c.req.json()
  if (!mesa_numero) return c.json({ erro: 'Número da mesa é obrigatório' }, 400)

  // Verifica se já existe comanda aberta para esta mesa
  const existente = await c.env.DB.prepare("SELECT id FROM comandas WHERE mesa_numero = ? AND status = 'aberta'").bind(String(mesa_numero)).first() as any
  if (existente) return c.json({ erro: `A mesa ${mesa_numero} já possui uma comanda aberta.` }, 400)

  // Cria o pedido interno da comanda
  const pedido = await c.env.DB.prepare(`
    INSERT INTO pedidos (cliente_id, total, pagamento, observacao, status, taxa_entrega, origem, status_pagamento)
    VALUES (NULL, 0, '', ?, 'COMANDA_ABERTA', 0, 'COMANDA', 'PENDENTE')
  `).bind(`Comanda mesa ${mesa_numero}`).run()

  const pedidoId = pedido.meta.last_row_id as number

  const comanda = await c.env.DB.prepare(`
    INSERT INTO comandas (mesa_numero, nome_cliente, status, total, pedido_id)
    VALUES (?, ?, 'aberta', 0, ?)
  `).bind(String(mesa_numero), (nome_cliente || '').trim() || null, pedidoId).run()

  return c.json({ sucesso: true, comanda_id: comanda.meta.last_row_id })
})

// Adicionar item
app.post('/itens', async (c) => {
  const { comanda_id, produto_id, quantidade } = await c.req.json()
  const qtd = Math.abs(parseInt(quantidade) || 0)
  if (!comanda_id || !produto_id || qtd <= 0) return c.json({ erro: 'Dados inválidos' }, 400)

  const comanda = await c.env.DB.prepare('SELECT * FROM comandas WHERE id = ?').bind(comanda_id).first() as any
  if (!comanda || comanda.status !== 'aberta') return c.json({ erro: 'Comanda não está aberta' }, 400)

  const produto = await c.env.DB.prepare('SELECT * FROM produtos WHERE id = ?').bind(produto_id).first() as any
  if (!produto) return c.json({ erro: 'Produto não encontrado' }, 404)

  const subtotal = (produto.preco || 0) * qtd

  await c.env.DB.prepare(`
    INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, valor_unitario, subtotal, nome_item, tipo_item)
    VALUES (?, ?, ?, ?, ?, ?, 'produto')
  `).bind(comanda.pedido_id, produto_id, qtd, produto.preco, subtotal, produto.nome).run()

  const total = await recalcularTotal(c.env.DB, comanda.pedido_id, comanda.id)
  return c.json({ sucesso: true, total })
})

// Remover item
app.post('/remover-item', async (c) => {
  const { comanda_id, item_id } = await c.req.json()
  const comanda = await c.env.DB.prepare('SELECT * FROM comandas WHERE id = ?').bind(comanda_id).first() as any
  if (!comanda || comanda.status !== 'aberta') return c.json({ erro: 'Comanda não está aberta' }, 400)

  await c.env.DB.prepare('DELETE FROM itens_pedido WHERE id = ? AND pedido_id = ?').bind(item_id, comanda.pedido_id).run()
  const total = await recalcularTotal(c.env.DB, comanda.pedido_id, comanda.id)
  return c.json({ sucesso: true, total })
})

// Fechar comanda (com pagamento + lançamento no financeiro)
app.post('/fechar', async (c) => {
  const { comanda_id, pagamento } = await c.req.json()
  const comanda = await c.env.DB.prepare('SELECT * FROM comandas WHERE id = ?').bind(comanda_id).first() as any
  if (!comanda || comanda.status !== 'aberta') return c.json({ erro: 'Comanda não está aberta' }, 400)

  const agora = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const forma = pagamento || 'DINHEIRO'

  // Fecha a comanda e o pedido
  await c.env.DB.prepare(`
    UPDATE comandas SET status = 'fechada', data_fechamento = ? WHERE id = ?
  `).bind(agora, comanda.id).run()

  await c.env.DB.prepare(`
    UPDATE pedidos SET status = 'PAGO', status_pagamento = 'PAGO', pagamento = ? WHERE id = ?
  `).bind(forma, comanda.pedido_id).run()

  // Lança ENTRADA automática no financeiro
  if ((comanda.total || 0) > 0) {
    await c.env.DB.prepare(`
      INSERT INTO financeiro (tipo, descricao, valor, data_movimento, forma_pagamento, observacao, categoria, automatico, pedido_id)
      VALUES ('ENTRADA', ?, ?, ?, ?, ?, 'VENDAS', 1, ?)
    `).bind(
      `Comanda #${comanda.id} - Mesa ${comanda.mesa_numero}`,
      comanda.total,
      hojeBr(),
      forma,
      `Cliente: ${comanda.nome_cliente || 'não informado'}`,
      comanda.pedido_id
    ).run()
  }

  return c.json({ sucesso: true, total: comanda.total })
})

// Cancelar comanda
app.post('/cancelar', async (c) => {
  const { comanda_id } = await c.req.json()
  const comanda = await c.env.DB.prepare('SELECT * FROM comandas WHERE id = ?').bind(comanda_id).first() as any
  if (!comanda || comanda.status !== 'aberta') return c.json({ erro: 'Comanda não está aberta' }, 400)

  const agora = new Date().toISOString().slice(0, 19).replace('T', ' ')
  await c.env.DB.prepare("UPDATE comandas SET status = 'cancelada', data_fechamento = ? WHERE id = ?").bind(agora, comanda.id).run()
  await c.env.DB.prepare("UPDATE pedidos SET status = 'CANCELADO' WHERE id = ?").bind(comanda.pedido_id).run()

  return c.json({ sucesso: true })
})

export default app