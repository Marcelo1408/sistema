import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Listar promoções VIGENTES (para o PWA / cardápio)
app.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT pr.*, p.nome AS produto_nome, p.preco AS preco_original
    FROM promocoes pr
    LEFT JOIN produtos p ON p.id = pr.produto_id
    WHERE pr.ativo = 1
      AND (pr.data_inicio IS NULL OR pr.data_inicio = '' OR pr.data_inicio <= date('now'))
      AND (pr.data_fim IS NULL OR pr.data_fim = '' OR pr.data_fim >= date('now'))
    ORDER BY pr.id DESC
  `).all()
  return c.json(results)
})

// Listar TODAS (painel)
app.get('/todas', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT pr.*, p.nome AS produto_nome, p.preco AS preco_original
    FROM promocoes pr
    LEFT JOIN produtos p ON p.id = pr.produto_id
    ORDER BY pr.id DESC
  `).all()
  return c.json(results)
})

// Criar promoção
app.post('/', async (c) => {
  const body = await c.req.parseBody()
  const titulo = (body.titulo as string)?.trim()
  const descricao = (body.descricao as string)?.trim() || ''
  const produto_id = parseInt(body.produto_id as string) || null
  const preco_promocional = parseFloat((body.preco_promocional as string).replace(',', '.')) || 0
  const data_inicio = (body.data_inicio as string) || null
  const data_fim = (body.data_fim as string) || null
  const ativo = body.ativo ? 1 : 0
  const imagem = (body.imagem_url as string) || ''

  if (!titulo) return c.json({ erro: 'Título obrigatório' }, 400)

  await c.env.DB.prepare(`
    INSERT INTO promocoes (titulo, descricao, imagem, produto_id, preco_promocional, data_inicio, data_fim, ativo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(titulo, descricao, imagem, produto_id, preco_promocional, data_inicio, data_fim, ativo).run()

  return c.redirect('/promocoes')
})

// Ativar / Desativar
app.get('/acao/:id/:acao', async (c) => {
  const id = parseInt(c.req.param('id'))
  const acao = c.req.param('acao')

  if (acao === 'ativar') {
    await c.env.DB.prepare('UPDATE promocoes SET ativo=1 WHERE id=?').bind(id).run()
  } else if (acao === 'desativar') {
    await c.env.DB.prepare('UPDATE promocoes SET ativo=0 WHERE id=?').bind(id).run()
  }

  return c.redirect('/promocoes')
})

// Excluir
app.get('/excluir/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM promocoes WHERE id=?').bind(id).run()
  return c.redirect('/promocoes')
})

export default app