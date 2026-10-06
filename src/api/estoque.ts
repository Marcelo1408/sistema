import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Listar produtos (para tela de estoque)
app.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT p.*, c.nome AS categoria
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    ORDER BY p.estoque ASC
  `).all()
  return c.json(results)
})

// Listar produtos para o select (com estoque atual)
app.get('/produtos', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, nome, estoque FROM produtos ORDER BY nome ASC').all()
  return c.json(results)
})

// Listar últimas movimentações
app.get('/movimentacoes', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT em.*, p.nome AS produto
    FROM estoque_movimentacoes em
    LEFT JOIN produtos p ON p.id = em.produto_id
    ORDER BY em.id DESC
    LIMIT 30
  `).all()
  return c.json(results)
})

// Registrar movimentação de estoque
app.post('/movimentar', async (c) => {
  const body = await c.req.parseBody()
  const produto_id = parseInt(body.produto_id as string) || 0
  const tipo = (body.tipo as string) || ''
  const quantidade = parseInt(body.quantidade as string) || 0
  const observacao = (body.observacao as string)?.trim() || ''

  if (!produto_id) return c.json({ erro: 'Produto obrigatório' }, 400)
  if (!['ENTRADA', 'SAIDA', 'AJUSTE'].includes(tipo)) return c.json({ erro: 'Tipo inválido' }, 400)
  if (quantidade < 0) return c.json({ erro: 'Quantidade inválida' }, 400)

  const produto = await c.env.DB.prepare('SELECT estoque FROM produtos WHERE id = ?').bind(produto_id).first() as any
  if (!produto) return c.json({ erro: 'Produto não encontrado' }, 404)

  const estoqueAtual = parseInt(produto.estoque) || 0
  let novoEstoque = estoqueAtual

  if (tipo === 'ENTRADA') {
    novoEstoque = estoqueAtual + quantidade
  } else if (tipo === 'SAIDA') {
    novoEstoque = Math.max(0, estoqueAtual - quantidade)
  } else if (tipo === 'AJUSTE') {
    novoEstoque = Math.max(0, quantidade)
  }

  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE produtos SET estoque = ? WHERE id = ?').bind(novoEstoque, produto_id),
    c.env.DB.prepare(`
      INSERT INTO estoque_movimentacoes (produto_id, tipo, quantidade, observacao)
      VALUES (?, ?, ?, ?)
    `).bind(produto_id, tipo, quantidade, observacao)
  ])

  return c.redirect('/estoque')
})

export default app