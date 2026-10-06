import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

const dataBr = (d: string) => {
  if (!d) return '-'
  try {
    return new Date(d.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch { return d }
}

app.get('/', async (c) => {
  const db = c.env.DB

  const produtos = await db.prepare(`
    SELECT p.*, c.nome AS categoria
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    ORDER BY p.estoque ASC
  `).all() as any

  const produtosSelect = await db.prepare('SELECT id, nome, estoque FROM produtos ORDER BY nome ASC').all() as any

  const total = await db.prepare('SELECT COUNT(*) as total FROM produtos').first() as any
  const baixo = await db.prepare('SELECT COUNT(*) as total FROM produtos WHERE estoque <= 10').first() as any
  const esgotados = await db.prepare('SELECT COUNT(*) as total FROM produtos WHERE estoque = 0').first() as any

  const movimentacoes = await db.prepare(`
    SELECT em.*, p.nome AS produto
    FROM estoque_movimentacoes em
    LEFT JOIN produtos p ON p.id = em.produto_id
    ORDER BY em.id DESC
    LIMIT 20
  `).all() as any

  const badgeEstoque = (e: number) => {
    if (e === 0) return '<span class="badge-zero">🔴 Esgotado</span>'
    if (e <= 10) return '<span class="badge-baixo">🟡 Baixo</span>'
    return '<span class="badge-ok">🟢 OK</span>'
  }

  const badgeTipo = (t: string) => {
    if (t === 'ENTRADA') return '<span style="background:#d4edda; color:#155724; padding:4px 10px; border-radius:15px; font-size:12px; font-weight:bold;">📥 Entrada</span>'
    if (t === 'SAIDA') return '<span style="background:#f8d7da; color:#721c24; padding:4px 10px; border-radius:15px; font-size:12px; font-weight:bold;">📤 Saída</span>'
    return '<span style="background:#e7f1ff; color:#084298; padding:4px 10px; border-radius:15px; font-size:12px; font-weight:bold;">🔧 Ajuste</span>'
  }

  const conteudo = `
    <style>
      .dashboard { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:20px; margin-bottom:25px; }
      .card-info, .form-card, .table-box { background:#fff; padding:25px; border-radius:15px; box-shadow:0 3px 15px rgba(0,0,0,.08); margin-bottom:25px; }
      .card-info h4 { color:#777; margin:0 0 5px; font-size:14px; }
      .card-info h2 { margin:0; font-size:32px; color:#111; }
      .card-info.alerta h2 { color:#dc3545; }
      .form-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:15px; }
      .form-group { margin-bottom:15px; }
      .form-group label { display:block; margin-bottom:5px; font-weight:bold; color:#555; }
      .form-group input, .form-group select, .form-group textarea { width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; }
      .btn-salvar { background:#198754; color:#fff; border:none; padding:12px 20px; border-radius:8px; cursor:pointer; font-weight:bold; }
      .badge-ok { background:#d4edda; color:#155724; padding:5px 10px; border-radius:20px; font-size:12px; font-weight:bold; }
      .badge-baixo { background:#fff3cd; color:#856404; padding:5px 10px; border-radius:20px; font-size:12px; font-weight:bold; }
      .badge-zero { background:#f8d7da; color:#721c24; padding:5px 10px; border-radius:20px; font-size:12px; font-weight:bold; }
      table { width:100%; border-collapse:collapse; }
      th, td { padding:12px; text-align:left; border-bottom:1px solid #eee; font-size:14px; }
      th { background:#f8f9fa; color:#495057; font-size:12px; text-transform:uppercase; }
      tr:hover { background:#f9f9f9; }
      h1, h2 { color:#333; }
    </style>

    <h1>📦 Estoque</h1>

    <div class="dashboard">
      <div class="card-info">
        <h4>Total de Produtos</h4>
        <h2>${total?.total || 0}</h2>
      </div>
      <div class="card-info alerta">
        <h4>Estoque Baixo (≤ 10)</h4>
        <h2>${baixo?.total || 0}</h2>
      </div>
      <div class="card-info alerta">
        <h4>Esgotados</h4>
        <h2>${esgotados?.total || 0}</h2>
      </div>
    </div>

    <div class="form-card">
      <h2>🔄 Movimentar Estoque</h2>
      <br>
      <form method="POST" action="/api/estoque/movimentar">
        <div class="form-grid">
          <div class="form-group">
            <label>Produto</label>
            <select name="produto_id" required>
              <option value="">Selecione...</option>
              ${produtosSelect.results.map((p: any) => `<option value="${p.id}">${p.nome} - atual: ${p.estoque}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Tipo</label>
            <select name="tipo" required>
              <option value="ENTRADA">📥 Entrada</option>
              <option value="SAIDA">📤 Saída</option>
              <option value="AJUSTE">🔧 Ajuste Manual</option>
            </select>
          </div>
          <div class="form-group">
            <label>Quantidade</label>
            <input type="number" name="quantidade" min="0" required>
          </div>
        </div>
        <div class="form-group">
          <label>Observação</label>
          <textarea name="observacao" rows="2" placeholder="Ex: compra de espetos, perda, ajuste de contagem..."></textarea>
        </div>
        <button type="submit" class="btn-salvar">💾 Salvar Movimentação</button>
      </form>
    </div>

    <div class="table-box">
      <h2>📋 Produtos em Estoque (${produtos.results.length})</h2>
      <br>
      ${produtos.results.length === 0 ? '<p style="text-align:center; color:#888;">Nenhum produto cadastrado.</p>' : `
        <table>
          <tr>
            <th>ID</th>
            <th>Produto</th>
            <th>Categoria</th>
            <th>Estoque</th>
            <th>Status</th>
          </tr>
          ${produtos.results.map((p: any) => `
            <tr>
              <td>${p.id}</td>
              <td><strong>${p.nome}</strong></td>
              <td>${p.categoria || '-'}</td>
              <td><strong>${p.estoque}</strong></td>
              <td>${badgeEstoque(p.estoque || 0)}</td>
            </tr>
          `).join('')}
        </table>
      `}
    </div>

    <div class="table-box">
      <h2>🕐 Últimas Movimentações</h2>
      <br>
      ${movimentacoes.results.length === 0 ? '<p style="text-align:center; color:#888;">Nenhuma movimentação registrada.</p>' : `
        <table>
          <tr>
            <th>Data</th>
            <th>Produto</th>
            <th>Tipo</th>
            <th>Quantidade</th>
            <th>Observação</th>
          </tr>
          ${movimentacoes.results.map((m: any) => `
            <tr>
              <td>${dataBr(m.criado_em)}</td>
              <td><strong>${m.produto || '—'}</strong></td>
              <td>${badgeTipo(m.tipo)}</td>
              <td>${m.quantidade}</td>
              <td>${m.observacao || '-'}</td>
            </tr>
          `).join('')}
        </table>
      `}
    </div>
  `

  return c.html(renderLayout('Estoque', conteudo, 'estoque'))
})

export default app