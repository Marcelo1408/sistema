// src/painel/login.ts
import { Hono } from 'hono'
import { criarToken, sha256hex, COOKIE } from '../auth'
import { setCookie } from 'hono/cookie'

type Bindings = {
  DB: D1Database
  SESSION_SECRET?: string
}

const app = new Hono<{ Bindings: Bindings }>()

function paginaLogin(erro: string) {
  return `<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Login - Painel Admin</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI', sans-serif; background:#f4f6f9; min-height:100vh; display:flex; align-items:center; justify-content:center; }
  .login-card { background:#fff; padding:40px 35px; border-radius:15px; box-shadow:0 5px 25px rgba(0,0,0,.1); width:100%; max-width:400px; text-align:center; }
  .login-card .icone { font-size:52px; }
  .login-card h1 { color:#ff6b00; font-size:26px; margin:10px 0 25px; }
  .login-card input { width:100%; padding:13px; margin-bottom:12px; border:1px solid #ddd; border-radius:8px; font-size:15px; }
  .login-card button { width:100%; background:#ff6b00; color:#fff; border:none; padding:14px; border-radius:8px; font-size:16px; font-weight:bold; cursor:pointer; }
  .login-card button:hover { background:#e55f00; }
  .erro { background:#f8d7da; color:#721c24; padding:10px; border-radius:8px; margin-bottom:15px; font-size:14px; }
</style>
</head>
<body>
  <div class="login-card">
    <div class="icone">🔐</div>
    <h1>Login Admin</h1>
    ${erro ? '<div class="erro">' + erro + '</div>' : ''}
    <form method="POST" action="/login">
      <input type="text" name="usuario" placeholder="Usuário" required autofocus>
      <input type="password" name="senha" placeholder="Senha" required>
      <button type="submit">Entrar</button>
    </form>
  </div>
</body>
</html>`
}

// Tela de login
app.get('/login', (c) => c.html(paginaLogin('')))

// Validar login
app.post('/login', async (c) => {
  const body = await c.req.parseBody()
  const usuario = String(body.usuario || '').trim()
  const senha = String(body.senha || '')

  if (!usuario || !senha) {
    return c.html(paginaLogin('Preencha usuário e senha.'), 400)
  }

  const user = await c.env.DB.prepare('SELECT * FROM usuarios WHERE usuario = ? AND ativo = 1').bind(usuario).first() as any

  let ok = false
  if (user) {
    const hash = await sha256hex(senha)
    ok = (user.senha === senha) || (user.senha === hash)
  }

  if (!ok) {
    return c.html(paginaLogin('Credenciais inválidas'), 401)
  }

  const secret = c.env.SESSION_SECRET || 'segredo-dev-troque-no-deploy'
  const token = await criarToken(usuario, secret)

   setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 12 * 3600,
    secure: false
  })

  return c.redirect('/')
})

// Sair
app.get('/logout', (c) => {
   setCookie(c, COOKIE, '', { path: '/', maxAge: 0, secure: false })
  return c.redirect('/login')
})

export default app