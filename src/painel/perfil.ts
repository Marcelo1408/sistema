import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const usuarioLogado = c.get('usuario')
  const user = await c.env.DB.prepare('SELECT nome, usuario, nivel FROM usuarios WHERE usuario = ?').bind(usuarioLogado).first() as any

  const conteudo = `
    <style>
      .perfil-card { background:#fff; padding:30px; border-radius:15px; box-shadow:0 3px 15px rgba(0,0,0,.08); max-width:520px; }
      .perfil-card h2 { margin:0 0 5px; color:#333; }
      .perfil-card p { margin:0 0 25px; color:#666; font-size:14px; }
      .info-user { background:#f4f6f9; border-radius:12px; padding:18px; margin-bottom:25px; display:flex; align-items:center; gap:15px; }
      .info-user .avatar { width:56px; height:56px; border-radius:50%; background:#ff6b00; color:#fff; display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:bold; }
      .info-user .dados strong { display:block; color:#333; font-size:16px; }
      .info-user .dados span { color:#888; font-size:13px; }
      .badge-nivel { background:#fff3cd; color:#856404; padding:3px 10px; border-radius:15px; font-size:11px; font-weight:bold; margin-left:6px; }
      .form-group { margin-bottom:16px; }
      .form-group label { display:block; margin-bottom:6px; font-weight:bold; color:#555; font-size:14px; }
      .form-group input { width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; font-size:15px; }
      .form-group input:focus { outline:none; border-color:#ff6b00; box-shadow:0 0 0 3px rgba(255,107,0,.1); }
      .msg { padding:12px 15px; border-radius:10px; margin-bottom:18px; font-size:14px; display:none; }
      .msg.erro { background:#f8d7da; color:#721c24; display:block; }
      .msg.ok { background:#d4edda; color:#155724; display:block; }
      .btn-salvar { background:#198754; color:#fff; border:none; padding:13px 26px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:15px; width:100%; }
      .btn-salvar:hover { background:#146c43; }
      .dica { color:#888; font-size:12px; margin-top:12px; text-align:center; }
    </style>

    <div class="perfil-card">
      <h2>⚙️ Meu Perfil</h2>
      <p>Gerencie seus dados de acesso e altere sua senha.</p>

      <div class="info-user">
        <div class="avatar">${(user?.nome || usuarioLogado || '?').charAt(0).toUpperCase()}</div>
        <div class="dados">
          <strong>${user?.nome || usuarioLogado}<span class="badge-nivel">${user?.nivel === 'ADM' ? '👑 ADM' : '👤 GERENTE'}</span></strong>
          <span>Usuário: ${user?.usuario || usuarioLogado}</span>
        </div>
      </div>

      <div id="msg" class="msg"></div>

      <form id="formPerfil">
        <div class="form-group">
          <label>Senha Atual</label>
          <input type="password" name="senha_atual" required autocomplete="current-password">
        </div>
        <div class="form-group">
          <label>Nova Senha</label>
          <input type="password" name="nova_senha" required minlength="6" autocomplete="new-password">
        </div>
        <div class="form-group">
          <label>Confirmar Nova Senha</label>
          <input type="password" name="confirmar_senha" required minlength="6" autocomplete="new-password">
        </div>
        <button type="submit" class="btn-salvar">🔒 Alterar Senha</button>
        <p class="dica">Mínimo de 6 caracteres. Você continuará logado após alterar.</p>
      </form>
    </div>

    <script>
      document.getElementById('formPerfil').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const msg = document.getElementById('msg');
        msg.className = 'msg';
        msg.textContent = '';

        const formData = new FormData(form);
        const res = await fetch('/api/perfil', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(formData)
        });
        const json = await res.json();

        if (json.sucesso) {
          msg.className = 'msg ok';
          msg.textContent = '✅ Senha alterada com sucesso!';
          form.reset();
        } else {
          msg.className = 'msg erro';
          msg.textContent = '❌ ' + (json.erro || 'Erro ao alterar senha.');
        }
      });
    </script>
  `

  return c.html(renderLayout('Meu Perfil', conteudo, 'perfil'))
})

export default app