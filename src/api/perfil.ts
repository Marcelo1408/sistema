import { Hono } from 'hono'
import { sha256hex } from '../auth'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Dados do usuário logado
app.get('/', async (c) => {
  const usuario = c.get('usuario')
  const user = await c.env.DB.prepare('SELECT nome, usuario, nivel FROM usuarios WHERE usuario = ?').bind(usuario).first() as any
  return c.json(user || { usuario })
})

// Alterar a própria senha
app.post('/', async (c) => {
  const usuario = c.get('usuario')
  const body = await c.req.parseBody()
  const senhaAtual = String(body.senha_atual || '')
  const novaSenha = String(body.nova_senha || '')
  const confirmar = String(body.confirmar_senha || '')

  const user = await c.env.DB.prepare('SELECT * FROM usuarios WHERE usuario = ?').bind(usuario).first() as any
  if (!user) return c.json({ erro: 'Usuário não encontrado.' }, 404)

  // Valida a senha atual (aceita texto puro legado ou hash sha256)
  const hashAtual = await sha256hex(senhaAtual)
  const confere = user.senha === senhaAtual || user.senha === hashAtual
  if (!confere) return c.json({ erro: 'Senha atual incorreta.' }, 400)

  if (novaSenha.length < 6) return c.json({ erro: 'A nova senha deve ter pelo menos 6 caracteres.' }, 400)
  if (novaSenha !== confirmar) return c.json({ erro: 'A confirmação não confere com a nova senha.' }, 400)
  if (novaSenha === senhaAtual) return c.json({ erro: 'A nova senha é igual à senha atual.' }, 400)

  const hashNova = await sha256hex(novaSenha)
  await c.env.DB.prepare('UPDATE usuarios SET senha = ? WHERE usuario = ?').bind(hashNova, usuario).run()

  return c.json({ sucesso: true })
})

export default app