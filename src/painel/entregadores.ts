import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const lista = await c.env.DB.prepare('SELECT * FROM entregadores ORDER BY nome ASC').all() as any

  const conteudo = `
    <style>
      .box { background:#fff; border-radius:15px; padding:20px; box-shadow:0 3px 15px rgba(0,0,0,.08); margin-bottom:20px; }
      .box h3 { margin:0 0 15px; color:#333; font-size:17px; }
      .form-grid { display:grid; grid-template-columns:2fr 1fr 1fr auto; gap:10px; align-items:end; }
      .form-group label { display:block; margin-bottom:5px; font-weight:bold; color:#555; font-size:13px; }
      .form-group input, .form-group select { width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; font-size:16px; }
      .btn-salvar { background:#198754; color:#fff; border:none; padding:13px 22px; border-radius:8px; cursor:pointer; font-weight:bold; min-height:46px; }
      table { width:100%; border-collapse:collapse; }
      th, td { padding:11px 10px; text-align:left; border-bottom:1px solid #eee; font-size:14px; }
      th { background:#f8f9fa; color:#495057; font-size:12px; text-transform:uppercase; }
      .pill { padding:4px 12px; border-radius:20px; font-size:11px; font-weight:bold; color:#fff; }
      .pill.naloja { background:#28a745; }
      .pill.fora { background:#6c757d; }
      .btn-toggle { background:#0d6efd; color:#fff; padding:7px 12px; border-radius:6px; text-decoration:none; font-size:13px; border:none; cursor:pointer; }
      .btn-toggle.fora { background:#6c757d; }
      .btn-excluir { background:#dc3545; color:#fff; padding:7px 12px; border-radius:6px; text-decoration:none; font-size:13px; }
      .aviso-app { background:#fff5ec; border:1px dashed #ff6b00; border-radius:10px; padding:12px 16px; font-size:14px; color:#8a5a2b; margin-bottom:20px; }
      .table-scroll { overflow-x:auto; }
      @media (max-width:760px) { .form-grid { grid-template-columns:1fr; } }
    </style>

    <h1 style="margin-bottom:20px; color:#333; font-size:22px;">🛵 Entregadores</h1>

    <div class="aviso-app">
      📱 O app do entregador fica em: <b>chefdabrasa.shop/entregador</b> — ele entra só com o telefone cadastrado aqui.
      A fila de entregas respeita a <b>ordem de chegada na loja</b> (quem checkou primeiro e está com menos entregas recebe o próximo pedido).
    </div>

    <div class="box">
      <h3>➕ Cadastrar Entregador</h3>
      <form method="POST" action="/api/entregadores">
        <div class="form-grid">
          <div class="form-group"><label>Nome *</label><input type="text" name="nome" required placeholder="Nome completo"></div>
          <div class="form-group"><label>Telefone (WhatsApp) *</label><input type="text" name="telefone" required placeholder="(19) 99999-9999"></div>
          <div class="form-group">
            <label>Veículo</label>
            <select name="veiculo">
              <option value="MOTO">🏍️ Moto</option>
              <option value="BICICLETA">🚲 Bicicleta</option>
              <option value="CARRO">🚗 Carro</option>
              <option value="A_PE">🚶 A pé</option>
            </select>
          </div>
          <button class="btn-salvar" type="submit">💾 Salvar</button>
        </div>
      </form>
    </div>

    <div class="box">
      <h3>👥 Equipe (${lista.results.length})</h3>
      ${lista.results.length === 0 ? '<p style="color:#888; text-align:center; padding:20px;">Nenhum entregador cadastrado.</p>' : `
        <div class="table-scroll">
          <table>
            <tr><th>Nome</th><th>Telefone</th><th>Veículo</th><th>Situação</th><th>Entregas ativas</th><th>Ações</th></tr>
            ${lista.results.map((e: any) => `
              <tr>
                <td><strong>${e.nome}</strong></td>
                <td>${e.telefone}</td>
                <td>${e.veiculo || '-'}</td>
                <td>${Number(e.disponivel) === 1 ? '<span class="pill naloja">🟢 NA LOJA</span>' : '<span class="pill fora">⚪ Fora</span>'}</td>
                <td><strong>${e.entregas_ativas || 0}</strong></td>
                <td>
                  <a href="/api/entregadores/toggle/${e.id}" class="btn-toggle ${Number(e.disponivel) === 1 ? 'fora' : ''}">${Number(e.disponivel) === 1 ? '✅ Marcar fora' : ' Marcar na loja'}</a>
                  <a href="/api/entregadores/excluir/${e.id}" class="btn-excluir" onclick="return confirm('Excluir este entregador?')">🗑️</a>
                </td>
              </tr>
            `).join('')}
          </table>
        </div>
      `}
    </div>
  `

  return c.html(renderLayout('Entregadores', conteudo, 'entregadores'))
})

export default app