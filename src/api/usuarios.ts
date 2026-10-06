import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const TABELA = 'usuarios'

const app = new Hono<{ Bindings: Bindings }>()

// ---------- Listar usuários (sem mostrar a senha) ----------
app.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT id, nome, usuario, nivel, ativo, criado_em FROM ${TABELA} ORDER BY id`).all()
  return c.json(results)
})

// ---------- Criar usuário ----------
app.post('/', async (c) => {
  const body = await c.req.parseBody()
  const nome = String(body.nome || '').trim()
  const login = String(body.usuario || '').trim()
  const senha = String(body.senha || '').trim()
  const nivelBruto = String(body.nivel || 'GERENTE').trim().toUpperCase()

  if (!nome || !login) return c.json({ erro: 'Informe nome e usuário.' }, 400)
  if (senha.length < 6) return c.json({ erro: 'Senha precisa ter pelo menos 6 caracteres.' }, 400)

  const nivel = (nivelBruto === 'ADM' || nivelBruto === 'ADMIN') ? 'ADM' : 'GERENTE'

  // Verifica se já existe
  const existe = await c.env.DB.prepare(`SELECT id FROM ${TABELA} WHERE usuario = ?`).bind(login).first()
  if (existe) return c.json({ erro: 'Já existe um usuário com esse login.' }, 400)

  // Salva em TEXTO PURO (mesmo formato que o login compara)
  await c.env.DB.prepare(
    `INSERT INTO ${TABELA} (nome, usuario, senha, nivel, ativo, criado_em) VALUES (?, ?, ?, ?, 1, datetime('now'))`
  ).bind(nome, login, senha, nivel).run()

  return c.redirect('/usuarios')
})

// ---------- Atualizar usuário (nome, nível, senha) ----------
app.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.parseBody()

  const updates: string[] = []
  const valores: any[] = []

  if (body.nome) { updates.push('nome = ?'); valores.push(String(body.nome).trim()) }
  if (body.nivel) {
    const nivel = String(body.nivel).trim().toUpperCase()
    updates.push('nivel = ?')
    valores.push((nivel === 'ADM' || nivel === 'ADMIN') ? 'ADM' : 'GERENTE')
  }
  if (body.senha && String(body.senha).length >= 6) {
    updates.push('senha = ?')
    valores.push(String(body.senha))
  }

  if (!updates.length) return c.json({ erro: 'Nada para atualizar.' }, 400)

  valores.push(id)
  await c.env.DB.prepare(`UPDATE ${TABELA} SET ${updates.join(', ')} WHERE id = ?`).bind(...valores).run()

  return c.json({ sucesso: true })
})

// ---------- Excluir usuário ----------
app.get('/excluir/:id', async (c) => {
  const id = parseInt(c.req.param('id'))

  const usuarioLogado = c.get('usuario')
  const atual = await c.env.DB.prepare(`SELECT * FROM ${TABELA} WHERE id = ?`).bind(id).first() as any

  if (!atual) return c.json({ erro: 'Usuário não encontrado.' }, 404)

  // Protege: não pode excluir a si mesmo
  if (atual.usuario === usuarioLogado) {
    return c.json({ erro: 'Você não pode excluir a si mesmo.' }, 400)
  }

  // Protege: não pode excluir ADMs
  if (atual.nivel === 'ADM') {
    return c.json({ erro: 'Administradores são protegidos contra exclusão.' }, 400)
  }

  await c.env.DB.prepare(`DELETE FROM ${TABELA} WHERE id = ?`).bind(id).run()
  return c.redirect('/usuarios')
})

export default app