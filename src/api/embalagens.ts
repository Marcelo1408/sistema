import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Listar embalagens
app.get('/', async (c) => {
  const busca = c.req.query('busca') || ''
  let where = ''
  if (busca) where = `WHERE nome LIKE '%${busca}%'`

  const { results } = await c.env.DB.prepare(`SELECT * FROM embalagens ${where} ORDER BY nome ASC`).all()
  return c.json(results)
})

// Salvar embalagem
app.post('/', async (c) => {
  const body = await c.req.parseBody()
  const nome = (body.nome as string)?.trim()
  const descricao = (body.descricao as string)?.trim() || ''
  const unidade = (body.unidade as string)?.trim() || 'un'
  const estoque = parseInt(body.estoque as string) || 0
  const estoque_minimo = parseInt(body.estoque_minimo as string) || 10
  const ativo = body.ativo ? 1 : 0

  if (!nome) return c.json({ erro: 'Nome obrigatório' }, 400)

  await c.env.DB.prepare(`
    INSERT INTO embalagens (nome, descricao, unidade, estoque, estoque_minimo, ativo)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(nome, descricao, unidade, estoque, estoque_minimo, ativo).run()

  return c.redirect('/embalagens')
})

// Movimentação de estoque (entrada/saída)
app.post('/movimento', async (c) => {
  const { id, tipo, quantidade } = await c.req.json()
  const qtd = Math.abs(parseInt(quantidade) || 0)

  if (!id || qtd <= 0) return c.json({ erro: 'Dados inválidos' }, 400)

  const emb = await c.env.DB.prepare('SELECT estoque FROM embalagens WHERE id = ?').bind(id).first() as any
  if (!emb) return c.json({ erro: 'Embalagem não encontrada' }, 404)

  let novo = emb.estoque || 0
  if (tipo === 'ENTRADA') {
    novo += qtd
  } else {
    novo = Math.max(0, novo - qtd)
  }

  await c.env.DB.prepare('UPDATE embalagens SET estoque = ? WHERE id = ?').bind(novo, id).run()
  return c.json({ sucesso: true, estoque: novo })
})

// Ativar / Desativar
app.get('/acao/:id/:acao', async (c) => {
  const id = parseInt(c.req.param('id'))
  const acao = c.req.param('acao')

  if (acao === 'ativar') {
    await c.env.DB.prepare('UPDATE embalagens SET ativo=1 WHERE id=?').bind(id).run()
  } else if (acao === 'desativar') {
    await c.env.DB.prepare('UPDATE embalagens SET ativo=0 WHERE id=?').bind(id).run()
  }

  return c.redirect('/embalagens')
})

// Excluir
app.get('/excluir/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM embalagens WHERE id=?').bind(id).run()
  return c.redirect('/embalagens')
})

export default app