import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const usuarioLogado = c.get('usuario')
  const user = await c.env.DB
    .prepare('SELECT nome, nivel FROM usuarios WHERE usuario = ?')
    .bind(usuarioLogado)
    .first() as any

  const conteudo = `
    <style>
      .negado-card {
        background:#fff;
        border-radius:20px;
        padding:60px 40px;
        box-shadow:0 5px 25px rgba(0,0,0,.1);
        max-width:560px;
        margin:40px auto;
        text-align:center;
      }
      .negado-card .icone { font-size:80px; margin-bottom:10px; }
      .negado-card h1 { color:#dc3545; font-size:32px; margin:0 0 10px; }
      .negado-card p { color:#666; font-size:16px; line-height:1.6; margin:0 0 8px; }
      .negado-card .nivel {
        display:inline-block;
        background:#f8d7da;
        color:#721c24;
        padding:6px 16px;
        border-radius:20px;
        font-size:13px;
        font-weight:bold;
        margin:15px 0 25px;
      }
      .botoes { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
      .btn {
        padding:13px 28px;
        border-radius:8px;
        font-weight:bold;
        font-size:15px;
        text-decoration:none;
        display:inline-block;
      }
      .btn-inicio { background:#ff6b00; color:#fff; }
      .btn-inicio:hover { background:#e55f00; }
      .btn-sair { background:#6c757d; color:#fff; }
      .btn-sair:hover { background:#5a6268; }
      .codigo { color:#bbb; font-size:13px; margin-top:25px; }
    </style>

    <div class="negado-card">
      <div class="icone">⛔</div>
      <h1>Acesso Negado</h1>
      <p>Desculpe, <strong>${user?.nome || usuarioLogado}</strong>.<br>
      Você não tem permissão para acessar esta área do sistema.</p>
      <span class="nivel">Seu nível atual: ${user?.nivel === 'ADM' ? '👑 ADM' : '👤 GERENTE'}</span>
      <p style="font-size:14px; color:#888;">
        Esta página é restrita a usuários com nível <strong>Administrador (ADM)</strong>.<br>
        Se você precisa deste acesso, solicite ao administrador do sistema.
      </p>
      <div class="botoes">
        <a href="/" class="btn btn-inicio">🏠 Voltar ao Início</a>
        <a href="/logout" class="btn btn-sair">🚪 Sair</a>
      </div>
      <p class="codigo">Erro 403 — Forbidden</p>
    </div>
  `

  return c.html(renderLayout('Acesso Negado', conteudo, ''))
})

export default app