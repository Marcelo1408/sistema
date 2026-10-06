import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Função auxiliar para obter configurações da loja
async function obterConfigLoja(db: D1Database) {
  const config = await db.prepare('SELECT * FROM configuracoes ORDER BY id ASC LIMIT 1').first() as any
  if (!config) {
    await db.prepare('INSERT INTO configuracoes (id, nome_empresa, loja_aberta) VALUES (1, ?, 0)').bind('Espetaria').run()
    return { id: 1, loja_aberta: 0, expediente_aberto_em: null, expediente_fechado_em: null }
  }
  return config
}

// Toggle Loja (Abrir/Fechar)
app.get('/toggle-loja', async (c) => {
  const config = await obterConfigLoja(c.env.DB)
  const agora = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const novoStatus = config.loja_aberta ? 0 : 1

  if (novoStatus === 1) {
    await c.env.DB.prepare('UPDATE configuracoes SET loja_aberta = 1, expediente_aberto_em = ?, expediente_fechado_em = NULL WHERE id = ?')
      .bind(agora, config.id).run()
  } else {
    await c.env.DB.prepare('UPDATE configuracoes SET loja_aberta = 0, expediente_fechado_em = ? WHERE id = ?')
      .bind(agora, config.id).run()
  }

  const configAtualizada = await obterConfigLoja(c.env.DB)
  return c.json({
    sucesso: true,
    aberta: configAtualizada.loja_aberta === 1,
    expediente_aberto_em: configAtualizada.expediente_aberto_em
  })
})

// Status da Loja (AJAX)
app.get('/status-loja', async (c) => {
  const config = await obterConfigLoja(c.env.DB)
  return c.json({
    aberta: config.loja_aberta === 1,
    expediente_aberto_em: config.expediente_aberto_em
  })
})

// Último Pedido (AJAX para verificação de novos)
app.get('/ultimo-pedido', async (c) => {
  const config = await obterConfigLoja(c.env.DB)
  let ultimoPedido = 0

  if (config.loja_aberta && config.expediente_aberto_em) {
    const result = await c.env.DB.prepare('SELECT MAX(id) as ultimo FROM pedidos WHERE criado_em >= ?')
      .bind(config.expediente_aberto_em).first() as any
    ultimoPedido = result?.ultimo || 0
  }

  return c.json({ ultimo: ultimoPedido })
})

// Atualizar Status do Pedido
app.get('/status/:id/:status', async (c) => {
  const id = parseInt(c.req.param('id'))
  const status = c.req.param('status')

  const permitidos = [
    'AGUARDANDO_PAGAMENTO', 'AGUARDANDO_PIX', 'PAGO', 'EM_PREPARO',
    'PRONTO', 'SAIU_ENTREGA', 'ENTREGUE', 'CONFIRMADO_CLIENTE', 'CANCELADO'
  ]

  if (!permitidos.includes(status)) {
    return c.json({ erro: 'Status inválido' }, 400)
  }

  await c.env.DB.prepare('UPDATE pedidos SET status = ? WHERE id = ?').bind(status, id).run()
  return c.redirect('/pedidos')
})

// Criar Pedido (Sem adicionais)
app.post('/', async (c) => {
  const body = await c.req.json()
  const { nome, telefone, endereco, referencia, itens, total, taxa_entrega } = body

  if (!nome || !telefone || !endereco || !itens || !itens.length) {
    return c.json({ erro: 'Dados incompletos para criar pedido.' }, 400)
  }

  const valorTotal = Number(total) || 0
  const taxaEntrega = taxa_entrega !== undefined ? Number(taxa_entrega) : 0
  const telefoneLimpo = telefone.replace(/\D/g, '')

  try {
    const statements: any[] = []

    // 1. Buscar ou criar cliente
    const clienteExistente = await c.env.DB.prepare('SELECT id FROM clientes WHERE telefone = ?').bind(telefoneLimpo).first() as any
    
    let clienteId: number
    if (clienteExistente) {
      clienteId = clienteExistente.id
      statements.push(
        c.env.DB.prepare(`UPDATE clientes SET nome=?, endereco=?, referencia=?, total_pedidos=IFNULL(total_pedidos,0)+1, valor_gasto=IFNULL(valor_gasto,0)+? WHERE id=?`)
          .bind(nome, endereco, referencia, valorTotal, clienteId)
      )
    } else {
      const result = await c.env.DB.prepare(`INSERT INTO clientes (nome, telefone, endereco, referencia, total_pedidos, valor_gasto) VALUES (?, ?, ?, ?, 1, ?)`)
        .bind(nome, telefoneLimpo, endereco, referencia, valorTotal).run()
      clienteId = result.meta.last_row_id as number
    }

    // 2. Criar pedido
    const obs = `Endereço: ${endereco} | Referência: ${referencia || ''}`
    const pedidoResult = await c.env.DB.prepare(
      `INSERT INTO pedidos (cliente_id, total, pagamento, observacao, status, taxa_entrega, origem, status_pagamento) VALUES (?, ?, 'PIX', ?, 'AGUARDANDO_PIX', ?, 'PWA', 'PENDENTE')`
    ).bind(clienteId, valorTotal, obs, taxaEntrega).run()
    
    const pedidoId = pedidoResult.meta.last_row_id as number

    // 3. Inserir itens
    for (const item of itens) {
      const produtoId = item.id || item.produto_id
      
      statements.push(
        c.env.DB.prepare(`INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, valor_unitario, subtotal, nome_item, tipo_item) VALUES (?, ?, ?, ?, ?, ?, 'produto')`)
          .bind(pedidoId, produtoId, item.quantidade, Number(item.preco) || 0, Number(item.subtotal) || 0, item.nome || '')
      )
    }

    if (statements.length > 0) {
      await c.env.DB.batch(statements)
    }

    return c.json({
      sucesso: true,
      pedido_id: pedidoId,
      cliente_id: clienteId,
      taxa_entrega: taxaEntrega,
      total: valorTotal,
      mensagem: 'Pedido criado com sucesso.'
    })

  } catch (error: any) {
    console.error('Erro ao criar pedido:', error)
    return c.json({ erro: error.message || 'Erro interno' }, 500)
  }
})

// Confirmar Entrega
app.post('/confirmar-entrega', async (c) => {
  const { telefone } = await c.req.json()
  if (!telefone) return c.json({ erro: 'Telefone obrigatório.' }, 400)

  const telefoneLimpo = telefone.replace(/\D/g, '')
  
  const pedido = await c.env.DB.prepare(`
    SELECT p.id FROM pedidos p 
    INNER JOIN clientes c ON c.id = p.cliente_id 
    WHERE c.telefone = ? AND p.status = 'ENTREGUE' 
    ORDER BY p.id DESC LIMIT 1
  `).bind(telefoneLimpo).first() as any

  if (!pedido) return c.json({ erro: 'Nenhum pedido entregue encontrado.' }, 404)

  await c.env.DB.prepare('UPDATE pedidos SET status = ? WHERE id = ?').bind('CONFIRMADO_CLIENTE', pedido.id).run()

  return c.json({ sucesso: true, pedido_id: pedido.id })
})

// Listar Pedidos (com filtros de expediente)
app.get('/', async (c) => {
  const config = await obterConfigLoja(c.env.DB)
  const filtro = c.req.query('filtro') || ''
  
  let where = 'WHERE 1=0'
  if (config.loja_aberta && config.expediente_aberto_em) {
    where = `WHERE p.criado_em >= '${config.expediente_aberto_em}'`
    if (filtro) {
      where += ` AND p.status='${filtro}'`
    }
  }

  const { results } = await c.env.DB.prepare(`
    SELECT p.*, c.nome, c.telefone, c.bairro
    FROM pedidos p
    LEFT JOIN clientes c ON c.id = p.cliente_id
    ${where}
    ORDER BY p.id DESC
  `).all()
  
  return c.json(results)
})

// Detalhes do Pedido
app.get('/detalhes/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  
  const pedido = await c.env.DB.prepare(`
    SELECT p.*, c.nome, c.telefone, c.endereco, c.numero, c.bairro, c.complemento, c.referencia
    FROM pedidos p
    LEFT JOIN clientes c ON c.id = p.cliente_id
    WHERE p.id = ?
  `).bind(id).first()

  if (!pedido) return c.json({ erro: 'Pedido não encontrado' }, 404)

  const itens = await c.env.DB.prepare(`
    SELECT ip.*, pr.nome AS produto
    FROM itens_pedido ip
    LEFT JOIN produtos pr ON pr.id = ip.produto_id
    WHERE ip.pedido_id = ?
    ORDER BY ip.id ASC
  `).bind(id).all()

  return c.json({ pedido, itens: itens.results })
})

export default app