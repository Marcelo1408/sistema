import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
}

const app = new Hono<{ Bindings: Bindings }>()

// Listar Produtos
app.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT p.*, c.nome as categoria 
    FROM produtos p 
    LEFT JOIN categorias c ON c.id = p.categoria_id 
    ORDER BY p.id ASC
  `).all()
  return c.json(results)
})

// Salvar Produto (novo)
app.post('/', async (c) => {
  const body = await c.req.parseBody()
  const categoria = parseInt(body.categoria as string) || null
  const nome = (body.nome as string)?.trim()
  const descricao = (body.descricao as string)?.trim() || ''
  const preco = parseFloat((body.preco as string).replace(',', '.')) || 0
  const estoque = parseInt(body.estoque as string) || 0
  const ativo = body.ativo ? 1 : 0
  const destaque = body.destaque ? 1 : 0
  const imagem = (body.imagem_url as string) || ''

  await c.env.DB.prepare(`
    INSERT INTO produtos (categoria_id, nome, descricao, preco, imagem, ativo, destaque, estoque)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(categoria, nome, descricao, preco, imagem, ativo, destaque, estoque).run()

  return c.redirect('/produtos')
})

// Excluir Produto
app.get('/excluir/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM produtos WHERE id = ?').bind(id).run()
  return c.redirect('/produtos')
})

// Atualizar Produto (edição)
app.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.parseBody()

  const nome = (body.nome as string)?.trim()
  const categoria_id = parseInt(body.categoria_id as string) || null
  const descricao = (body.descricao as string)?.trim() || ''
  const preco = parseFloat((body.preco as string).replace(',', '.')) || 0
  const estoque = parseInt(body.estoque as string) || 0
  const ativo = body.ativo ? 1 : 0
  const destaque = body.destaque ? 1 : 0
  const imagem_url = (body.imagem_url as string)?.trim() || ''

  if (!nome) {
    return c.json({ error: 'Nome obrigatório' }, 400)
  }

  // Busca o produto atual para manter a imagem se não enviar nova
  const atual = await c.env.DB.prepare('SELECT imagem FROM produtos WHERE id = ?').bind(id).first() as any
  if (!atual) return c.json({ error: 'Produto não encontrado' }, 404)

  const imagemFinal = imagem_url || atual.imagem || ''

  await c.env.DB.prepare(`
    UPDATE produtos SET nome=?, categoria_id=?, descricao=?, preco=?, estoque=?, ativo=?, destaque=?, imagem=?
    WHERE id=?
  `).bind(nome, categoria_id, descricao, preco, estoque, ativo, destaque, imagemFinal, id).run()

  // ✅ CORREÇÃO: retorna JSON em vez de redirect (evita loop 302 no fetch)
  return c.json({ sucesso: true })
})

export default app