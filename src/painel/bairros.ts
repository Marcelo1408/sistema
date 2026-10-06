import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const busca = c.req.query('busca') || ''
  const editarId = c.req.query('editar')
  
  // Dashboard
  const total = await c.env.DB.prepare('SELECT COUNT(*) as total FROM bairros').first() as any
  const ativos = await c.env.DB.prepare('SELECT COUNT(*) as total FROM bairros WHERE ativo=1').first() as any
  const entregaDisponivel = await c.env.DB.prepare('SELECT COUNT(*) as total FROM bairros WHERE entrega_disponivel=1').first() as any
  const taxaMedia = await c.env.DB.prepare('SELECT COALESCE(AVG(taxa),0) as total FROM bairros').first() as any

  // Buscar bairro para edição
  let editar: any = null
  if (editarId) {
    editar = await c.env.DB.prepare('SELECT * FROM bairros WHERE id=?').bind(parseInt(editarId)).first()
  }

  // Lista de bairros
  let where = ''
  if (busca) {
    where = `WHERE nome LIKE '%${busca}%'`
  }
  const bairros = await c.env.DB.prepare(`SELECT * FROM bairros ${where} ORDER BY nome ASC`).all()

  const conteudo = `
    <style>
      .dashboard { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:20px; margin-bottom:25px; }
      .card-info, .form-card, .table-box { background:#fff; padding:25px; border-radius:15px; box-shadow:0 3px 15px rgba(0,0,0,.08); margin-bottom:25px; }
      .card-info h4 { color:#777; margin-bottom:10px; font-size:14px; }
      .card-info h2 { color:#111; font-size:32px; margin:0; }
      .form-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:15px; }
      .form-group { margin-bottom:15px; }
      .form-group label { display:block; margin-bottom:5px; font-weight:bold; color:#555; }
      .form-group input { width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; }
      .checks { display:flex; gap:20px; margin:15px 0; flex-wrap:wrap; }
      .checks label { display:flex; align-items:center; gap:8px; color:#555; }
      .checks input[type="checkbox"] { width:auto; }
      .btn-salvar { background:#198754; color:#fff; border:none; padding:12px 20px; border-radius:8px; cursor:pointer; font-weight:bold; }
      .btn-cancelar { background:#6c757d; color:#fff; padding:12px 20px; border-radius:8px; text-decoration:none; display:inline-block; margin-left:10px; }
      .busca-box { background:#fff; padding:20px; border-radius:15px; margin-bottom:25px; box-shadow:0 3px 15px rgba(0,0,0,.08); }
      .busca-box form { display:flex; gap:10px; }
      .busca-box input { flex:1; padding:10px; border:1px solid #ddd; border-radius:8px; }
      .btn-busca { background:#ff6b00; color:#fff; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; }
      .badge-ativo, .badge-entrega { background:#d4edda; color:#155724; padding:5px 10px; border-radius:20px; font-size:12px; font-weight:bold; }
      .badge-inativo, .badge-sem-entrega { background:#f8d7da; color:#721c24; padding:5px 10px; border-radius:20px; font-size:12px; font-weight:bold; }
      table { width:100%; border-collapse:collapse; }
      th, td { padding:12px; text-align:left; border-bottom:1px solid #eee; }
      th { background:#f8f9fa; color:#495057; font-weight:bold; }
      tr:hover { background:#f9f9f9; }
      .acoes a { text-decoration:none; margin-right:8px; font-size:13px; padding:6px 10px; border-radius:5px; display:inline-block; }
      .acoes a:hover { opacity:0.8; }
      h2 { color:#333; margin-bottom:15px; }
    </style>

    <h1 style="margin-bottom:25px; color:#333;">📍 Bairros e Taxas de Entrega</h1>

    <div class="dashboard">
      <div class="card-info">
        <h4>Total de Bairros</h4>
        <h2>${total?.total || 0}</h2>
      </div>
      <div class="card-info">
        <h4>Bairros Ativos</h4>
        <h2>${ativos?.total || 0}</h2>
      </div>
      <div class="card-info">
        <h4>Entrega Disponível</h4>
        <h2>${entregaDisponivel?.total || 0}</h2>
      </div>
      <div class="card-info">
        <h4>Taxa Média</h4>
        <h2>R$ ${parseFloat(taxaMedia?.total || 0).toFixed(2).replace('.', ',')}</h2>
      </div>
    </div>

    <div class="form-card">
      <h2>${editar ? '✏️ Editar Bairro' : '➕ Novo Bairro'}</h2>
      <br>
      <form method="POST" action="/api/bairros">
        <input type="hidden" name="id" value="${editar?.id || ''}">
        
        <div class="form-grid">
          <div class="form-group">
            <label>Nome do Bairro</label>
            <input type="text" name="nome" value="${editar?.nome || ''}" required>
          </div>
          <div class="form-group">
            <label>Taxa de Entrega (R$)</label>
            <input type="number" step="0.01" name="taxa" value="${editar?.taxa || '0.00'}">
          </div>
          <div class="form-group">
            <label>Tempo Médio de Entrega (min)</label>
            <input type="number" name="tempo_entrega" value="${editar?.tempo_entrega || '30'}">
          </div>
          <div class="form-group">
            <label>Pedido Mínimo (R$)</label>
            <input type="number" step="0.01" name="pedido_minimo" value="${editar?.pedido_minimo || '0.00'}">
          </div>
        </div>

        <div class="checks">
          <label>
            <input type="checkbox" name="entrega_disponivel" ${!editar || editar?.entrega_disponivel ? 'checked' : ''}>
            Entrega Disponível
          </label>
          <label>
            <input type="checkbox" name="ativo" ${!editar || editar?.ativo ? 'checked' : ''}>
            Bairro Ativo
          </label>
        </div>

        <button type="submit" name="salvar" class="btn-salvar">Salvar Bairro</button>
        ${editar ? '<a href="/bairros" class="btn-cancelar">Cancelar</a>' : ''}
      </form>
    </div>

    <div class="busca-box">
      <form method="GET">
        <input type="text" name="busca" placeholder="Buscar bairro..." value="${busca}">
        <button class="btn-busca">🔍 Pesquisar</button>
      </form>
    </div>

    <div class="table-box">
      <h2>📋 Lista de Bairros</h2>
      <br>
      ${(bairros.results as any[]).length === 0 ? `
        <p style="text-align:center; color:#666; padding:20px;">Nenhum bairro cadastrado.</p>
      ` : `
        <table>
          <tr>
            <th>ID</th>
            <th>Bairro</th>
            <th>Taxa</th>
            <th>Tempo</th>
            <th>Ped. Mínimo</th>
            <th>Entrega</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
          ${(bairros.results as any[]).map((b: any) => `
            <tr>
              <td>${b.id}</td>
              <td><strong>${b.nome}</strong></td>
              <td>R$ ${parseFloat(b.taxa).toFixed(2).replace('.', ',')}</td>
              <td>${b.tempo_entrega} min</td>
              <td>R$ ${parseFloat(b.pedido_minimo).toFixed(2).replace('.', ',')}</td>
              <td>${b.entrega_disponivel ? '<span class="badge-entrega">✅ Sim</span>' : '<span class="badge-sem-entrega">❌ Não</span>'}</td>
              <td>${b.ativo ? '<span class="badge-ativo">✅ Ativo</span>' : '<span class="badge-inativo">❌ Inativo</span>'}</td>
              <td class="acoes">
                <a href="?editar=${b.id}" style="background:#0d6efd; color:white;">✏️ Editar</a>
                ${b.ativo 
                  ? `<a href="/api/bairros/acao/${b.id}/desativar" style="background:#dc3545; color:white;">Desativar</a>`
                  : `<a href="/api/bairros/acao/${b.id}/ativar" style="background:#198754; color:white;">Ativar</a>`
                }
                ${b.entrega_disponivel
                  ? `<a href="/api/bairros/acao/${b.id}/entrega_off" style="background:#ffc107; color:black;">Sem Entrega</a>`
                  : `<a href="/api/bairros/acao/${b.id}/entrega_on" style="background:#28a745; color:white;">Com Entrega</a>`
                }
                <a href="/api/bairros/excluir/${b.id}" style="background:#dc3545; color:white;" onclick="return confirm('Deseja excluir este bairro?')">🗑️ Excluir</a>
              </td>
            </tr>
          `).join('')}
        </table>
      `}
    </div>
  `

  return c.html(renderLayout('Bairros', conteudo, 'bairros'))
})

export default app