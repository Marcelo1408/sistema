import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
}

const app = new Hono<{ Bindings: Bindings }>()

// Listar Combos (API pública para PWA)
app.get('/', async (c) => {
  try {
    const { results: combos } = await c.env.DB.prepare(`
      SELECT * FROM combos WHERE ativo = 1 ORDER BY destaque DESC, id DESC
    `).all()

    for (const combo of combos as any[]) {
      const { results: itens } = await c.env.DB.prepare(`
        SELECT cp.quantidade, p.nome, p.preco
        FROM combo_produtos cp
        LEFT JOIN produtos p ON p.id = cp.produto_id
        WHERE cp.combo_id = ?
      `).bind(combo.id).all()
      combo.itens = itens
    }

    return c.json(combos)
  } catch (err: any) {
    return c.json({ erro: err.message }, 500)
  }
})

// Listar Combos (Painel - todos)
app.get('/todos', async (c) => {
  const { results: combos } = await c.env.DB.prepare('SELECT * FROM combos ORDER BY id DESC').all()

  for (const combo of combos as any[]) {
    const { results: itens } = await c.env.DB.prepare(`
      SELECT cp.quantidade, p.nome
      FROM combo_produtos cp
      LEFT JOIN produtos p ON p.id = cp.produto_id
      WHERE cp.combo_id = ?
    `).bind(combo.id).all()
    combo.itens = itens
  }

  return c.json(combos)
})

// Salvar Combo
app.post('/', async (c) => {
  const body = await c.req.parseBody()
  const nome = (body.nome as string)?.trim()
  const descricao = (body.descricao as string)?.trim() || ''
  const preco = parseFloat((body.preco as string).replace(',', '.')) || 0
  const destaque = body.destaque ? 1 : 0
  const ativo = body.ativo ? 1 : 0
  const imagem = (body.imagem_url as string) || ''

  if (!nome || !preco) {
    return c.json({ erro: 'Nome e preço obrigatórios' }, 400)
  }

  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO combos (nome, descricao, preco, imagem, destaque, ativo)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(nome, descricao, preco, imagem, destaque, ativo).run()

    const combo_id = result.meta.last_row_id

    // Salvar produtos do combo
    const produto_ids = body['produto_id[]'] as string[]
    const quantidades = body['quantidade[]'] as string[]

    if (produto_ids && produto_ids.length > 0) {
      const statements = []
      for (let i = 0; i < produto_ids.length; i++) {
        const produto_id = parseInt(produto_ids[i]) || 0
        const quantidade = parseInt(quantidades[i]) || 1
        if (produto_id > 0 && quantidade > 0) {
          statements.push(
            c.env.DB.prepare('INSERT INTO combo_produtos (combo_id, produto_id, quantidade) VALUES (?, ?, ?)')
              .bind(combo_id, produto_id, quantidade)
          )
        }
      }
      if (statements.length > 0) {
        await c.env.DB.batch(statements)
      }
    }

    return c.redirect('/combos')
  } catch (err: any) {
    return c.json({ erro: err.message }, 500)
  }
})

// Ações (ativar/desativar/destaque)
app.get('/acao/:id/:acao', async (c) => {
  const id = parseInt(c.req.param('id'))
  const acao = c.req.param('acao')

  if (acao === 'ativar') {
    await c.env.DB.prepare('UPDATE combos SET ativo=1 WHERE id=?').bind(id).run()
  } else if (acao === 'desativar') {
    await c.env.DB.prepare('UPDATE combos SET ativo=0 WHERE id=?').bind(id).run()
  } else if (acao === 'destaque_on') {
    await c.env.DB.prepare('UPDATE combos SET destaque=1 WHERE id=?').bind(id).run()
  } else if (acao === 'destaque_off') {
    await c.env.DB.prepare('UPDATE combos SET destaque=0 WHERE id=?').bind(id).run()
  }

  return c.redirect('/combos')
})

// Excluir Combo
app.get('/excluir/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM combo_produtos WHERE combo_id=?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM combos WHERE id=?').bind(id).run()
  return c.redirect('/combos')
})

// Upload de Imagem
app.post('/upload', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('imagem') as File
  if (!file) return c.json({ error: 'Imagem necessária' }, 400)

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
    return c.json({ error: 'Formato não permitido' }, 400)
  }

  const key = `combo_${Date.now()}.${ext}`
  await c.env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
  return c.json({ url: `/r2/${key}` })
})

export default app