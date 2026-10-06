import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  // Estatísticas
  const total = await c.env.DB.prepare('SELECT COUNT(*) as total FROM combos').first() as any
  const ativos = await c.env.DB.prepare('SELECT COUNT(*) as total FROM combos WHERE ativo=1').first() as any
  const destaque = await c.env.DB.prepare('SELECT COUNT(*) as total FROM combos WHERE destaque=1').first() as any

  // Produtos ativos para o select
  const produtos = await c.env.DB.prepare('SELECT id, nome, preco FROM produtos WHERE ativo=1 ORDER BY nome ASC').all()

  // Combos com seus itens
  const combos = await c.env.DB.prepare('SELECT * FROM combos ORDER BY id DESC').all()
  for (const combo of combos.results as any[]) {
    const itens = await c.env.DB.prepare(`
      SELECT cp.quantidade, p.nome
      FROM combo_produtos cp
      LEFT JOIN produtos p ON p.id = cp.produto_id
      WHERE cp.combo_id = ?
    `).bind(combo.id).all()
    combo.itens = itens.results
  }

  const conteudo = `
    <style>
      .dashboard { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:20px; margin-bottom:25px; }
      .card-info, .form-card, .table-box { background:#fff; padding:25px; border-radius:15px; box-shadow:0 3px 15px rgba(0,0,0,.08); margin-bottom:25px; }
      .card-info h4 { color:#777; margin-bottom:10px; font-size:14px; }
      .card-info h2 { color:#111; font-size:32px; margin:0; }
      .form-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:15px; }
      .form-group { margin-bottom:15px; }
      .form-group label { display:block; margin-bottom:5px; font-weight:bold; color:#555; }
      .form-group input, .form-group textarea, .form-group select { width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; }
      .item-produto { display:grid; grid-template-columns:1fr 120px 80px; gap:10px; margin-bottom:10px; }
      .btn-salvar { background:#198754; color:#fff; border:none; padding:12px 20px; border-radius:8px; cursor:pointer; font-weight:bold; }
      .btn-add { background:#ff6b00; color:#fff; border:none; padding:10px 15px; border-radius:8px; cursor:pointer; margin-bottom:15px; }
      .btn-remove { background:#dc3545; color:#fff; border:none; border-radius:8px; cursor:pointer; padding:10px 15px; }
      .badge-ativo { background:#d4edda; color:#155724; padding:5px 10px; border-radius:20px; font-size:12px; font-weight:bold; }
      .badge-inativo { background:#f8d7da; color:#721c24; padding:5px 10px; border-radius:20px; font-size:12px; font-weight:bold; }
      .badge-destaque { background:#fff3cd; color:#856404; padding:5px 10px; border-radius:20px; font-size:12px; font-weight:bold; }
      .combo-img { width:90px; height:65px; object-fit:cover; border-radius:8px; }
      table { width:100%; border-collapse:collapse; }
      th, td { padding:12px; text-align:left; border-bottom:1px solid #eee; }
      th { background:#f8f9fa; color:#495057; font-weight:bold; }
      tr:hover { background:#f9f9f9; }
      .acoes a { text-decoration:none; margin-right:8px; font-size:13px; padding:6px 10px; border-radius:5px; display:inline-block; }
      .acoes a:hover { opacity:0.8; }
      h2 { color:#333; margin-bottom:15px; }
      h3 { color:#555; margin-top:20px; }
    </style>

    <h1 style="margin-bottom:25px; color:#333;">🎁 Combos</h1>

    <div class="dashboard">
      <div class="card-info">
        <h4>Total de Combos</h4>
        <h2>${total?.total || 0}</h2>
      </div>
      <div class="card-info">
        <h4>Combos Ativos</h4>
        <h2>${ativos?.total || 0}</h2>
      </div>
      <div class="card-info">
        <h4>Combos em Destaque</h4>
        <h2>${destaque?.total || 0}</h2>
      </div>
    </div>

    <div class="form-card">
      <h2>➕ Novo Combo</h2>
      <br>
      <form method="POST" action="/api/combos" enctype="multipart/form-data">
        <div class="form-grid">
          <div class="form-group">
            <label>Nome do Combo</label>
            <input type="text" name="nome" required placeholder="Ex: Combo Família">
          </div>
          <div class="form-group">
            <label>Preço do Combo</label>
            <input type="number" step="0.01" name="preco" required>
          </div>
        </div>

        <div class="form-group">
          <label>Descrição</label>
          <textarea name="descricao" rows="3" placeholder="Ex: 10 espetos + 1 coca 2L + porção"></textarea>
        </div>

        <div class="form-group">
          <label>Imagem do Combo</label>
          <input type="file" name="imagem" accept="image/*" id="inputImagem">
          <input type="hidden" name="imagem_url" id="imagem_url">
        </div>

        <h3>Produtos do Combo</h3>
        <br>

        <div id="produtos-combo">
          <div class="item-produto">
            <select name="produto_id[]">
              <option value="">Selecione um produto</option>
              ${(produtos.results as any[]).map((p: any) => `
                <option value="${p.id}">${p.nome} - R$ ${parseFloat(p.preco).toFixed(2).replace('.', ',')}</option>
              `).join('')}
            </select>
            <input type="number" name="quantidade[]" value="1" min="1">
            <button type="button" class="btn-remove" onclick="removerProduto(this)">X</button>
          </div>
        </div>

        <button type="button" class="btn-add" onclick="adicionarProduto()">+ Adicionar Produto</button>

        <br><br>

        <label style="display:flex; align-items:center; gap:10px; margin-bottom:10px; color:#555;">
          <input type="checkbox" name="destaque" style="width:auto;">
          Combo em Destaque
        </label>

        <label style="display:flex; align-items:center; gap:10px; margin-bottom:15px; color:#555;">
          <input type="checkbox" name="ativo" checked style="width:auto;">
          Combo Ativo
        </label>

        <br>

        <button type="submit" name="salvar" class="btn-salvar">Salvar Combo</button>
      </form>
    </div>

    <div class="table-box">
      <h2>📋 Combos Cadastrados</h2>
      <br>
      ${(combos.results as any[]).length === 0 ? `
        <p style="text-align:center; color:#666; padding:20px;">Nenhum combo cadastrado.</p>
      ` : `
        <table>
          <tr>
            <th>ID</th>
            <th>Imagem</th>
            <th>Combo</th>
            <th>Preço</th>
            <th>Itens</th>
            <th>Status</th>
            <th>Destaque</th>
            <th>Ações</th>
          </tr>
          ${(combos.results as any[]).map((combo: any) => `
            <tr>
              <td>${combo.id}</td>
              <td>
                ${combo.imagem 
                  ? `<img src="${combo.imagem}" class="combo-img">` 
                  : 'Sem imagem'}
              </td>
              <td>
                <strong>${combo.nome}</strong><br>
                <small style="color:#666;">${combo.descricao || ''}</small>
              </td>
              <td>R$ ${parseFloat(combo.preco).toFixed(2).replace('.', ',')}</td>
              <td>
                ${(combo.itens || []).map((item: any) => `${item.quantidade}x ${item.nome}`).join('<br>') || '-'}
              </td>
              <td>
                ${combo.ativo 
                  ? '<span class="badge-ativo">✅ Ativo</span>' 
                  : '<span class="badge-inativo">❌ Inativo</span>'}
              </td>
              <td>
                ${combo.destaque 
                  ? '<span class="badge-destaque">⭐ Destaque</span>' 
                  : '-'}
              </td>
              <td class="acoes">
                ${combo.ativo 
                  ? `<a href="/api/combos/acao/${combo.id}/desativar" style="background:#dc3545; color:white;">Desativar</a>` 
                  : `<a href="/api/combos/acao/${combo.id}/ativar" style="background:#198754; color:white;">Ativar</a>`}
                ${combo.destaque 
                  ? `<a href="/api/combos/acao/${combo.id}/destaque_off" style="background:#ffc107; color:black;">Remover Destaque</a>` 
                  : `<a href="/api/combos/acao/${combo.id}/destaque_on" style="background:#ff6b00; color:white;">Destacar</a>`}
                <a href="/api/combos/excluir/${combo.id}" style="background:#dc3545; color:white;" onclick="return confirm('Excluir este combo?')">🗑️ Excluir</a>
              </td>
            </tr>
          `).join('')}
        </table>
      `}
    </div>

    <script>
      function adicionarProduto() {
        const container = document.getElementById('produtos-combo');
        const item = document.querySelector('.item-produto').cloneNode(true);
        item.querySelector('select').value = '';
        item.querySelector('input').value = 1;
        container.appendChild(item);
      }

      function removerProduto(botao) {
        const container = document.getElementById('produtos-combo');
        if (container.children.length > 1) {
          botao.parentElement.remove();
        }
      }

      document.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const fileInput = form.querySelector('#inputImagem');
        
        if (fileInput.files.length > 0) {
          const fd = new FormData();
          fd.append('imagem', fileInput.files[0]);
          const res = await fetch('/api/combos/upload', { method: 'POST', body: fd });
          const json = await res.json();
          if (json.url) form.querySelector('#imagem_url').value = json.url;
        }

        const formData = new FormData(form);
        await fetch('/api/combos', { method: 'POST', body: formData });
        window.location.reload();
      });
    </script>
  `

  return c.html(renderLayout('Combos', conteudo, 'combos'))
})

export default app