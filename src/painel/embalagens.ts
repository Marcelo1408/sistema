import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const busca = c.req.query('busca') || ''

  // Estatísticas
  const total = await c.env.DB.prepare('SELECT COUNT(*) as total FROM embalagens').first() as any
  const baixo = await c.env.DB.prepare('SELECT COUNT(*) as total FROM embalagens WHERE estoque > 0 AND estoque <= estoque_minimo').first() as any
  const sem = await c.env.DB.prepare('SELECT COUNT(*) as total FROM embalagens WHERE estoque = 0').first() as any

  // Lista
  let where = ''
  if (busca) where = `WHERE nome LIKE '%${busca}%'`
  const embalagens = await c.env.DB.prepare(`SELECT * FROM embalagens ${where} ORDER BY nome ASC`).all()

  const badgeEstoque = (e: any) => {
    if ((e.estoque || 0) === 0) return '<span style="background:#f8d7da; color:#721c24; padding:5px 10px; border-radius:20px; font-size:12px; font-weight:bold;">🔴 Sem estoque</span>'
    if ((e.estoque || 0) <= (e.estoque_minimo || 0)) return '<span style="background:#fff3cd; color:#856404; padding:5px 10px; border-radius:20px; font-size:12px; font-weight:bold;">🟡 Estoque baixo</span>'
    return '<span style="background:#d4edda; color:#155724; padding:5px 10px; border-radius:20px; font-size:12px; font-weight:bold;">🟢 OK</span>'
  }

  const conteudo = `
    <style>
      .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:18px; margin-bottom:25px; }
      .card { background:#fff; border-radius:15px; padding:20px; box-shadow:0 3px 15px rgba(0,0,0,.08); }
      .card h3 { margin:0; font-size:28px; color:#111; }
      .card p { margin:5px 0 0; color:#777; font-size:13px; }
      .card.destaque h3 { color:#ff6b00; }
      .box { background:#fff; border-radius:15px; padding:20px 25px; box-shadow:0 3px 15px rgba(0,0,0,.08); margin-bottom:20px; }
      .box h3 { margin:0 0 15px; color:#333; font-size:17px; }
      .form-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:15px; }
      .form-group { margin-bottom:15px; }
      .form-group label { display:block; margin-bottom:5px; font-weight:bold; color:#555; }
      .form-group input, .form-group select, .form-group textarea { width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; }
      .btn-salvar { background:#198754; color:#fff; border:none; padding:12px 20px; border-radius:8px; cursor:pointer; font-weight:bold; }
      .busca-box form { display:flex; gap:10px; }
      .busca-box input { flex:1; padding:10px; border:1px solid #ddd; border-radius:8px; }
      .btn-busca { background:#ff6b00; color:#fff; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; }
      table { width:100%; border-collapse:collapse; }
      th, td { padding:12px 10px; text-align:left; border-bottom:1px solid #eee; font-size:14px; }
      th { background:#f8f9fa; color:#495057; font-size:12px; text-transform:uppercase; }
      tr:hover { background:#f9f9f9; }
      .estoque-num { font-size:18px; font-weight:bold; }
      .acoes a, .acoes button { text-decoration:none; margin-right:5px; font-size:12px; padding:6px 10px; border-radius:5px; display:inline-block; color:#fff; border:none; cursor:pointer; }
    </style>

    <h1 style="margin-bottom:25px; color:#333;">📦 Embalagens</h1>

    <div class="cards">
      <div class="card destaque">
        <h3>${total?.total || 0}</h3>
        <p>Tipos de embalagem</p>
      </div>
      <div class="card">
        <h3 style="color:#ffc107;">${baixo?.total || 0}</h3>
        <p>Com estoque baixo</p>
      </div>
      <div class="card">
        <h3 style="color:#dc3545;">${sem?.total || 0}</h3>
        <p>Sem estoque</p>
      </div>
    </div>

    <div class="box">
      <h3>➕ Nova Embalagem</h3>
      <form method="POST" action="/api/embalagens">
        <div class="form-grid">
          <div class="form-group">
            <label>Nome</label>
            <input type="text" name="nome" placeholder="Ex: Saco kraft, Caixa de isopor..." required>
          </div>
          <div class="form-group">
            <label>Unidade</label>
            <select name="unidade">
              <option value="un">un (unidade)</option>
              <option value="cx">cx (caixa)</option>
              <option value="pct">pct (pacote)</option>
              <option value="fardo">fardo</option>
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="L">L (litro)</option>
              <option value="ml">ml</option>
            </select>
          </div>
          <div class="form-group">
            <label>Estoque Atual</label>
            <input type="number" name="estoque" value="0" min="0">
          </div>
          <div class="form-group">
            <label>Estoque Mínimo</label>
            <input type="number" name="estoque_minimo" value="10" min="0">
          </div>
        </div>
        <div class="form-group">
          <label>Descrição</label>
          <textarea name="descricao" rows="2" placeholder="Observações opcionais..."></textarea>
        </div>
        <label style="display:flex; align-items:center; gap:10px; margin-bottom:15px; color:#555;">
          <input type="checkbox" name="ativo" checked style="width:auto;"> Embalagem Ativa
        </label>
        <button type="submit" class="btn-salvar">💾 Salvar Embalagem</button>
      </form>
    </div>

    <div class="box busca-box">
      <form method="GET">
        <input type="text" name="busca" placeholder="Buscar embalagem pelo nome..." value="${busca}">
        <button class="btn-busca">🔍 Pesquisar</button>
      </form>
    </div>

    <div class="box">
      <h3>📋 Embalagens Cadastradas (${(embalagens.results as any[]).length})</h3>
      ${(embalagens.results as any[]).length === 0 ? `
        <p style="text-align:center; color:#888; padding:20px;">Nenhuma embalagem cadastrada.</p>
      ` : `
        <table>
          <tr>
            <th>ID</th>
            <th>Embalagem</th>
            <th>Estoque</th>
            <th>Mínimo</th>
            <th>Situação</th>
            <th>Movimentar</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
          ${(embalagens.results as any[]).map((e: any) => `
            <tr>
              <td>${e.id}</td>
              <td>
                <strong>${e.nome}</strong>
                ${e.descricao ? `<br><small style="color:#888;">${e.descricao}</small>` : ''}
              </td>
              <td><span class="estoque-num">${e.estoque || 0}</span> ${e.unidade}</td>
              <td>${e.estoque_minimo || 0} ${e.unidade}</td>
              <td>${badgeEstoque(e)}</td>
              <td>
                <button style="background:#28a745;" onclick="movimentar(${e.id}, 'ENTRADA')">+ Entrada</button>
                <button style="background:#dc3545;" onclick="movimentar(${e.id}, 'SAIDA')">− Saída</button>
              </td>
              <td>${e.ativo ? '<span style="background:#d4edda; color:#155724; padding:5px 10px; border-radius:20px; font-size:12px; font-weight:bold;">✅ Ativo</span>' : '<span style="background:#f8d7da; color:#721c24; padding:5px 10px; border-radius:20px; font-size:12px; font-weight:bold;">❌ Inativo</span>'}</td>
              <td class="acoes">
                ${e.ativo
                  ? `<a href="/api/embalagens/acao/${e.id}/desativar" style="background:#6c757d;">Desativar</a>`
                  : `<a href="/api/embalagens/acao/${e.id}/ativar" style="background:#198754;">Ativar</a>`}
                <a href="/api/embalagens/excluir/${e.id}" style="background:#dc3545;" onclick="return confirm('Excluir esta embalagem?')">🗑️</a>
              </td>
            </tr>
          `).join('')}
        </table>
      `}
    </div>

    <script>
      async function movimentar(id, tipo) {
        const qtd = prompt(tipo === 'ENTRADA' ? 'Quantidade a ADICIONAR no estoque:' : 'Quantidade a RETIRAR do estoque:');
        if (qtd === null || qtd === '') return;
        const n = parseInt(qtd);
        if (!n || n <= 0) return alert('Quantidade inválida!');

        const res = await fetch('/api/embalagens/movimento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, tipo, quantidade: n })
        });
        const json = await res.json();
        if (json.sucesso) {
          location.reload();
        } else {
          alert(json.erro || 'Erro ao movimentar estoque.');
        }
      }
    </script>
  `

  return c.html(renderLayout('Embalagens', conteudo, 'embalagens'))
})

export default app