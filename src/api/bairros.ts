import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Listar Bairros
app.get('/', async (c) => {
  const busca = c.req.query('busca') || ''
  let where = ''
  
  if (busca) {
    where = `WHERE nome LIKE '%${busca}%'`
  }

  const { results } = await c.env.DB.prepare(`SELECT * FROM bairros ${where} ORDER BY nome ASC`).all()
  return c.json(results)
})

// Dashboard (estatísticas)
app.get('/dashboard', async (c) => {
  const total = await c.env.DB.prepare('SELECT COUNT(*) as total FROM bairros').first() as any
  const ativos = await c.env.DB.prepare('SELECT COUNT(*) as total FROM bairros WHERE ativo=1').first() as any
  const entregaDisponivel = await c.env.DB.prepare('SELECT COUNT(*) as total FROM bairros WHERE entrega_disponivel=1').first() as any
  const taxaMedia = await c.env.DB.prepare('SELECT COALESCE(AVG(taxa),0) as total FROM bairros').first() as any

  return c.json({
    total: total?.total || 0,
    ativos: ativos?.total || 0,
    entregaDisponivel: entregaDisponivel?.total || 0,
    taxaMedia: parseFloat(taxaMedia?.total || 0)
  })
})

// Salvar Bairro (criar ou editar)
app.post('/', async (c) => {
  const body = await c.req.parseBody()
  const id = parseInt(body.id as string) || 0
  const nome = (body.nome as string)?.trim()
  const taxa = parseFloat((body.taxa as string).replace(',', '.')) || 0
  const tempo_entrega = parseInt(body.tempo_entrega as string) || 30
  const pedido_minimo = parseFloat((body.pedido_minimo as string).replace(',', '.')) || 0
  const entrega_disponivel = body.entrega_disponivel ? 1 : 0
  const ativo = body.ativo ? 1 : 0

  if (!nome) {
    return c.json({ erro: 'Nome obrigatório' }, 400)
  }

  if (id > 0) {
    // Editar
    await c.env.DB.prepare(`
      UPDATE bairros SET nome=?, taxa=?, tempo_entrega=?, pedido_minimo=?, entrega_disponivel=?, ativo=? WHERE id=?
    `).bind(nome, taxa, tempo_entrega, pedido_minimo, entrega_disponivel, ativo, id).run()
  } else {
    // Criar
    await c.env.DB.prepare(`
      INSERT INTO bairros (nome, taxa, tempo_entrega, pedido_minimo, entrega_disponivel, ativo)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(nome, taxa, tempo_entrega, pedido_minimo, entrega_disponivel, ativo).run()
  }

  return c.redirect('/bairros')
})

// Ação (ativar/desativar/entrega_on/entrega_off)
app.get('/acao/:id/:acao', async (c) => {
  const id = parseInt(c.req.param('id'))
  const acao = c.req.param('acao')

  if (acao === 'ativar') {
    await c.env.DB.prepare('UPDATE bairros SET ativo=1 WHERE id=?').bind(id).run()
  } else if (acao === 'desativar') {
    await c.env.DB.prepare('UPDATE bairros SET ativo=0 WHERE id=?').bind(id).run()
  } else if (acao === 'entrega_on') {
    await c.env.DB.prepare('UPDATE bairros SET entrega_disponivel=1 WHERE id=?').bind(id).run()
  } else if (acao === 'entrega_off') {
    await c.env.DB.prepare('UPDATE bairros SET entrega_disponivel=0 WHERE id=?').bind(id).run()
  }

  return c.redirect('/bairros')
})

// Excluir Bairro
app.get('/excluir/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM bairros WHERE id=?').bind(id).run()
  return c.redirect('/bairros')
})

// Buscar Bairro para Edição
app.get('/editar/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const bairro = await c.env.DB.prepare('SELECT * FROM bairros WHERE id=?').bind(id).first()
  return c.json(bairro)
})

export default app