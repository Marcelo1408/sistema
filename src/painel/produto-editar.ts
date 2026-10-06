import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const produto = await c.env.DB.prepare('SELECT * FROM produtos WHERE id = ?').bind(id).first() as any

  if (!produto) return c.html('<h1>Produto não encontrado</h1>')

  const categorias = await c.env.DB.prepare('SELECT id, nome FROM categorias WHERE ativo = 1 ORDER BY nome ASC').all() as any

  const conteudo = `
    <style>
      .voltar { display:inline-block; margin-bottom:20px; color:#ff6b00; text-decoration:none; font-weight:bold; }
      .form-card { background:#fff; padding:30px; border-radius:15px; box-shadow:0 3px 15px rgba(0,0,0,.08); max-width:800px; }
      .form-card h2 { margin:0 0 5px; color:#333; }
      .form-card p { margin:0 0 25px; color:#666; font-size:14px; }
      .form-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:15px; }
      .form-group { margin-bottom:15px; }
      .form-group label { display:block; margin-bottom:5px; font-weight:bold; color:#555; font-size:14px; }
      .form-group input, .form-group select, .form-group textarea { width:100%; padding:11px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; font-size:15px; }
      .form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline:none; border-color:#ff6b00; box-shadow:0 0 0 3px rgba(255,107,0,.1); }
      .img-preview { max-width:180px; max-height:130px; object-fit:cover; border-radius:10px; border:1px solid #ddd; padding:4px; background:#fff; display:block; margin-bottom:10px; }
      .checks { display:flex; gap:25px; margin:15px 0; flex-wrap:wrap; }
      .checks label { display:flex; align-items:center; gap:8px; color:#555; font-weight:bold; cursor:pointer; }
      .checks input { width:auto; }
      .botoes { display:flex; gap:10px; margin-top:25px; flex-wrap:wrap; }
      .btn { padding:12px 24px; border-radius:8px; font-weight:bold; cursor:pointer; border:none; font-size:15px; text-decoration:none; display:inline-block; }
      .btn-salvar { background:#198754; color:#fff; }
      .btn-salvar:hover { background:#146c43; }
      .btn-cancelar { background:#6c757d; color:#fff; }
      .btn-cancelar:hover { background:#5a6268; }
      .obrigatorio { color:#dc3545; }
    </style>

    <a href="/produtos" class="voltar">← Voltar para Produtos</a>

    <div class="form-card">
      <h2>✏️ Editar Produto</h2>
      <p>Atualize os dados de <strong>${produto.nome}</strong></p>

      <form id="formEditarProduto">
        <div class="form-grid">
          <div class="form-group">
            <label>Nome do Produto <span class="obrigatorio">*</span></label>
            <input type="text" name="nome" value="${produto.nome || ''}" required>
          </div>
          <div class="form-group">
            <label>Categoria</label>
            <select name="categoria_id">
              <option value="">Sem categoria</option>
              ${categorias.results.map((cat: any) => `<option value="${cat.id}" ${produto.categoria_id === cat.id ? 'selected' : ''}>${cat.nome}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Preço (R$) <span class="obrigatorio">*</span></label>
            <input type="number" step="0.01" min="0" name="preco" value="${produto.preco || '0.00'}" required>
          </div>
          <div class="form-group">
            <label>Estoque</label>
            <input type="number" min="0" name="estoque" value="${produto.estoque || 0}">
          </div>
        </div>

        <div class="form-group">
          <label>Descrição</label>
          <textarea name="descricao" rows="3" placeholder="Descreva o produto...">${produto.descricao || ''}</textarea>
        </div>

        <div class="form-group">
          <label>Imagem do Produto</label>
          ${produto.imagem ? `<img src="${produto.imagem}" class="img-preview">` : '<p style="color:#888; font-size:13px;">Sem imagem atual.</p>'}
          <input type="file" name="imagem" accept="image/*" id="inputImagem">
          <input type="hidden" name="imagem_url" id="imagem_url">
          <small style="color:#888;">Deixe em branco para manter a imagem atual.</small>
        </div>

        <div class="checks">
          <label><input type="checkbox" name="ativo" ${produto.ativo ? 'checked' : ''}> Produto Ativo</label>
          <label><input type="checkbox" name="destaque" ${produto.destaque ? 'checked' : ''}> Produto em Destaque</label>
        </div>

        <div class="botoes">
          <button type="submit" class="btn btn-salvar">💾 Salvar Alterações</button>
          <a href="/produtos" class="btn btn-cancelar">Cancelar</a>
        </div>
      </form>
    </div>

    <script>
      document.getElementById('formEditarProduto').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const fileInput = form.querySelector('#inputImagem');

        // Se escolheu uma imagem nova, faz upload primeiro
        if (fileInput.files.length > 0) {
          const fd = new FormData();
          fd.append('imagem', fileInput.files[0]);
          const res = await fetch('/api/upload', { method: 'POST', body: fd });
          const json = await res.json();
          if (json.url) form.querySelector('#imagem_url').value = json.url;
        }

        const formData = new FormData(form);

        const res = await fetch('/api/produtos/${produto.id}', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(formData),
  redirect: 'manual'
});

// PUT retorna 302 (redirect) quando salva com sucesso
if (res.ok || res.status === 302 || res.status === 303) {
  window.location.href = '/produtos';
} else {
  const json = await res.json().catch(() => ({}));
  alert('Erro ao atualizar produto: ' + (json.error || res.status));
}

        if (res.ok) {
          window.location.href = '/produtos';
        } else {
          alert('Erro ao atualizar produto.');
        }
      });
    </script>
  `

  return c.html(renderLayout('Editar Produto', conteudo, 'produtos'))
})

export default app