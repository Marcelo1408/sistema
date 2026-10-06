import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = { DB: D1Database }

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  // Pega só as colunas que a tabela realmente tem
  const colunasInfo = await c.env.DB.prepare('PRAGMA table_info(usuarios)').all()
  const nomesColunas = (colunasInfo.results as any[]).map((x: any) => x.name)

  // Monta SELECT dinâmico com só as colunas existentes
  const queridas = ['id', 'nome', 'usuario', 'nivel', 'ativo', 'criado_em']
  const colunasExistentes = queridas.filter((c) => nomesColunas.includes(c))
  const sql = `SELECT ${colunasExistentes.join(', ')} FROM usuarios ORDER BY id DESC`

  const usuarios = await c.env.DB.prepare(sql).all()
  const lista = (usuarios.results as any[]) || []

  const temNivel = nomesColunas.includes('nivel')

  const conteudo = `
    <style>
      .form-card, .table-box { background:#fff; padding:25px; border-radius:15px; margin-bottom:25px; box-shadow:0 3px 15px rgba(0,0,0,.08); }
      .form-group { margin-bottom:15px; }
      .form-group label { display:block; margin-bottom:5px; font-weight:bold; color:#555; }
      .form-group input, .form-group select { width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; }
      .btn-salvar { background:#198754; color:#fff; border:none; padding:12px 20px; border-radius:8px; cursor:pointer; font-weight:bold; }
      .badge-adm { background:#fff3cd; color:#856404; padding:5px 10px; border-radius:20px; font-size:12px; font-weight:bold; }
      .badge-gerente { background:#d4edda; color:#155724; padding:5px 10px; border-radius:20px; font-size:12px; font-weight:bold; }
      table { width:100%; border-collapse:collapse; }
      th, td { padding:12px; text-align:left; border-bottom:1px solid #eee; }
      th { background:#f8f9fa; color:#495057; font-size:12px; text-transform:uppercase; }
      tr:hover { background:#f9f9f9; }
      h1, h2 { color:#333; }
      .btn-excluir { background:#dc3545; color:#fff; padding:6px 12px; border-radius:5px; text-decoration:none; font-size:13px; }
      .protegido { color:#999; font-style:italic; font-size:13px; }
    </style>

    <h1>👥 Usuários do Sistema</h1>

    <div class="form-card">
      <h2>➕ Novo Usuário</h2>
      <br>
      <form method="POST" action="/api/usuarios">
        <div class="form-group">
          <label>Nome</label>
          <input type="text" name="nome" placeholder="Nome completo" required>
        </div>
        <div class="form-group">
          <label>Usuário (login)</label>
          <input type="text" name="usuario" placeholder="Nome de usuário para login" required>
        </div>
        <div class="form-group">
          <label>Senha</label>
          <input type="password" name="senha" placeholder="Senha de acesso" required>
        </div>
        ${temNivel ? `
        <div class="form-group">
          <label>Nível de Acesso</label>
          <select name="nivel">
            <option value="GERENTE">Gerente (acesso padrão)</option>
            <option value="ADM">Administrador (acesso total)</option>
          </select>
        </div>` : ''}
        <button type="submit" class="btn-salvar">💾 Cadastrar Usuário</button>
      </form>
    </div>

    <div class="table-box">
      <h2>📋 Usuários Cadastrados (${lista.length})</h2>
      <br>
      ${lista.length === 0 ? `
        <p style="text-align:center; color:#888;">Nenhum usuário cadastrado.</p>
      ` : `
        <table>
          <tr>
            <th>ID</th>
            <th>Nome</th>
            <th>Usuário</th>
            ${temNivel ? '<th>Nível</th>' : ''}
            <th>Ações</th>
          </tr>
          ${lista.map((u: any) => {
            const ehAdm = u.nivel === 'ADM' || u.usuario === 'admin'
            return `
              <tr>
                <td>${u.id}</td>
                <td><strong>${u.nome}</strong></td>
                <td>${u.usuario}</td>
                ${temNivel ? `
                <td>
                  ${ehAdm
                    ? '<span class="badge-adm">👑 ADM</span>'
                    : '<span class="badge-gerente">👤 GERENTE</span>'}
                </td>` : ''}
                <td>
                  ${ehAdm
                    ? '<span class="protegido">🔒 Protegido</span>'
                    : `<a href="/api/usuarios/excluir/${u.id}" class="btn-excluir" onclick="return confirm('Excluir este usuário?')">🗑️ Excluir</a>`}
                </td>
              </tr>
            `
          }).join('')}
        </table>
      `}
    </div>
  `

  return c.html(renderLayout('Usuários', conteudo, 'usuarios'))
})

export default app