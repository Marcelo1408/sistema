import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Listar movimentações (com filtros)
app.get('/', async (c) => {
  const dataInicio = c.req.query('data_inicio') || ''
  const dataFim = c.req.query('data_fim') || ''
  const tipo = c.req.query('tipo') || ''

  let where = 'WHERE 1=1'
  const params: any[] = []

  if (dataInicio) { where += ' AND data_movimento >= ?'; params.push(dataInicio) }
  if (dataFim) { where += ' AND data_movimento <= ?'; params.push(dataFim) }
  if (tipo) { where += ' AND tipo = ?'; params.push(tipo) }

  const { results } = await c.env.DB.prepare(`
    SELECT * FROM financeiro ${where} ORDER BY data_movimento DESC, id DESC
  `).bind(...params).all()

  return c.json(results)
})

// ---------- NOVO: Detalhes de uma movimentação (para modal) ----------
app.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const mov = await c.env.DB.prepare('SELECT * FROM financeiro WHERE id = ?').bind(id).first()
  if (!mov) return c.json({ erro: 'Movimentação não encontrada.' }, 404)
  return c.json(mov)
})

// Resumo do período (entradas, saídas, saldo)
app.get('/resumo', async (c) => {
  const dataInicio = c.req.query('data_inicio') || '0000-00-00'
  const dataFim = c.req.query('data_fim') || '9999-99-99'

  const res = await c.env.DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN valor ELSE 0 END), 0) AS entradas,
      COALESCE(SUM(CASE WHEN tipo = 'SAIDA' THEN valor ELSE 0 END), 0) AS saidas
    FROM financeiro
    WHERE data_movimento BETWEEN ? AND ?
  `).bind(dataInicio, dataFim).first() as any

  const entradas = res?.entradas || 0
  const saidas = res?.saidas || 0

  return c.json({ entradas, saidas, saldo: entradas - saidas })
})

// Criar movimentação
app.post('/', async (c) => {
  const body = await c.req.parseBody()

  const tipo = (body.tipo as string) === 'SAIDA' ? 'SAIDA' : 'ENTRADA'
  const descricao = (body.descricao as string)?.trim()
  const valor = parseFloat((body.valor as string).replace(',', '.')) || 0
  const data_movimento = (body.data_movimento as string) || new Date().toISOString().slice(0, 10)
  const forma_pagamento = (body.forma_pagamento as string) || ''
  const categoria = (body.categoria as string) || ''
  const observacao = (body.observacao as string)?.trim() || ''

  if (!descricao || valor <= 0) {
    return c.json({ erro: 'Descrição e valor são obrigatórios.' }, 400)
  }

  await c.env.DB.prepare(`
    INSERT INTO financeiro (tipo, descricao, valor, data_movimento, forma_pagamento, observacao, categoria, automatico)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).bind(tipo, descricao, valor, data_movimento, forma_pagamento, observacao, categoria).run()

  return c.redirect('/financeiro')
})

// Excluir movimentação
app.get('/excluir/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM financeiro WHERE id = ?').bind(id).run()
  return c.redirect('/financeiro')
})

export default app