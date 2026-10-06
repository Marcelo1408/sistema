import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Listar Clientes
app.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM clientes ORDER BY criado_em DESC').all()
  return c.json(results)
})

// Buscar Cliente por Telefone (para login rápido no PWA)
app.get('/telefone/:telefone', async (c) => {
  const telefone = c.req.param('telefone').replace(/\D/g, '')
  const { results } = await c.env.DB.prepare('SELECT * FROM clientes WHERE telefone = ?').bind(telefone).all()
  if (results.length === 0) return c.json({ error: 'Cliente não encontrado' }, 404)
  return c.json(results[0])
})

// Salvar/Atualizar Cliente
app.post('/', async (c) => {
  const body = await c.req.parseBody()
  const nome = (body.nome as string)?.trim()
  const telefone = (body.telefone as string)?.replace(/\D/g, '')
  const endereco = (body.endereco as string)?.trim()
  const numero = (body.numero as string)?.trim()
  const bairro = (body.bairro as string)?.trim()
  const complemento = (body.complemento as string)?.trim()
  const cep = (body.cep as string)?.replace(/\D/g, '')
  const referencia = (body.referencia as string)?.trim()

  if (!nome || !telefone) return c.json({ error: 'Nome e telefone obrigatórios' }, 400)

  // Verifica se já existe
  const existente = await c.env.DB.prepare('SELECT id FROM clientes WHERE telefone = ?').bind(telefone).first() as any

  if (existente) {
    // Atualiza
    await c.env.DB.prepare(`
      UPDATE clientes SET nome=?, endereco=?, numero=?, bairro=?, complemento=?, cep=?, referencia=? WHERE id=?
    `).bind(nome, endereco, numero, bairro, complemento, cep, referencia, existente.id).run()
    return c.json({ success: true, id: existente.id, action: 'updated' })
  } else {
    // Cria novo
    const result = await c.env.DB.prepare(`
      INSERT INTO clientes (nome, telefone, endereco, numero, bairro, complemento, cep, referencia)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(nome, telefone, endereco, numero, bairro, complemento, cep, referencia).run()
    return c.json({ success: true, id: result.meta.last_row_id, action: 'created' })
  }
})

export default app