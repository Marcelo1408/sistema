import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Listar Categorias
app.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM categorias WHERE ativo = 1 ORDER BY nome').all()
  return c.json(results)
})

// Salvar Categoria
app.post('/', async (c) => {
  const body = await c.req.parseBody()
  const nome = (body.nome as string)?.trim()
  const ativo = body.ativo ? 1 : 0

  if (!nome) return c.json({ error: 'Nome obrigatório' }, 400)

  await c.env.DB.prepare('INSERT INTO categorias (nome, ativo) VALUES (?, ?)').bind(nome, ativo).run()
  return c.redirect('/categorias')
})

// Excluir Categoria
app.get('/excluir/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM categorias WHERE id = ?').bind(id).run()
  return c.redirect('/categorias')
})

// Atualizar Categoria
app.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.parseBody()

  const nome = (body.nome as string)?.trim()
  const ativo = body.ativo ? 1 : 0

  if (!nome) {
    return c.json({ error: 'Nome obrigatório' }, 400)
  }

  const atual = await c.env.DB.prepare('SELECT id FROM categorias WHERE id = ?').bind(id).first() as any
  if (!atual) return c.json({ error: 'Categoria não encontrada' }, 404)

  await c.env.DB.prepare('UPDATE categorias SET nome=?, ativo=? WHERE id=?').bind(nome, ativo, id).run()

  return c.redirect('/categorias')
})

export default app