import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const categorias = await c.env.DB.prepare('SELECT * FROM categorias WHERE ativo = 1 ORDER BY id ASC').all()
  const produtos = await c.env.DB.prepare(`SELECT p.*, c.nome as categoria FROM produtos p LEFT JOIN categorias c ON c.id = p.categoria_id ORDER BY p.id ASC`).all()

  const listaProdutos = produtos.results as any[]
  const listaCategorias = categorias.results as any[]

  const temSemCat = listaProdutos.some((p) => !p.categoria)
  const chips = [...listaCategorias.map((cat) => cat.nome), ...(temSemCat ? ['Sem Categoria'] : [])]

  const conteudo = `
    <style>
      .prod-topo { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px; }
      .prod-topo h2 { color:#333; margin:0; }
      .btn-add { background:#198754; color:#fff; border:none; padding:12px 22px; border-radius:10px; cursor:pointer; font-weight:bold; font-size:15px; box-shadow:0 3px 10px rgba(25,135,84,.3); }
      .btn-add:hover { background:#157347; }
      .chips-cats { display:flex; flex-wrap:wrap; gap:10px; margin:20px 0; }
      .chip-cat { background:#fff; border:2px solid #ddd; padding:10px 18px; border-radius:25px; cursor:pointer; font-weight:bold; font-size:14px; color:#555; }
      .chip-cat:hover { border-color:#ff6b00; color:#ff6b00; }
      .chip-cat.ativo { background:#ff6b00; border-color:#ff6b00; color:#fff; }
      .aviso-cat { background:#fff8e6; border:1px dashed #ffb84d; color:#8a6d3b; padding:20px; border-radius:12px; text-align:center; font-size:15px; }

      /* ---------- JANELA FLUTUANTE (MODAL) ---------- */
      .modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:1000; justify-content:center; align-items:flex-start; padding:40px 15px; overflow-y:auto; }
      .modal-overlay.aberto { display:flex; }
      .modal-box { background:#fff; border-radius:16px; width:100%; max-width:520px; box-shadow:0 10px 40px rgba(0,0,0,.25); animation:modalIn .25s ease; }
      @keyframes modalIn { from { transform:translateY(-25px); opacity:0; } to { transform:translateY(0); opacity:1; } }
      .modal-header { display:flex; justify-content:space-between; align-items:center; padding:18px 22px; border-bottom:1px solid #eee; }
      .modal-header h3 { margin:0; color:#333; font-size:18px; }
      .modal-x { background:#f1f1f1; border:none; width:34px; height:34px; border-radius:50%; font-size:15px; cursor:pointer; color:#555; }
      .modal-x:hover { background:#e2e2e2; }
      .modal-body { padding:22px; }
      .campo { width:100%; padding:12px; margin-bottom:12px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; font-size:14px; }
      .lbl-check { display:flex; align-items:center; gap:10px; margin:10px 0; color:#555; font-size:14px; }
      .lbl-check input { width:auto; }
      .btn-salvar-modal { background:#ff6b00; color:#fff; border:none; padding:14px; border-radius:10px; cursor:pointer; font-size:16px; font-weight:bold; width:100%; }
      .btn-salvar-modal:hover { background:#e05e00; }
      .btn-salvar-modal:disabled { background:#ccc; cursor:not-allowed; }

      /* ---------- MENSAGEM DE CONFIRMAÇÃO (TOAST) ---------- */
      .toast { position:fixed; top:20px; left:50%; transform:translateX(-50%) translateY(-90px); background:#198754; color:#fff; padding:14px 28px; border-radius:12px; font-weight:bold; font-size:15px; box-shadow:0 6px 20px rgba(0,0,0,.25); z-index:2000; transition:transform .35s ease; }
      .toast.visivel { transform:translateX(-50%) translateY(0); }
    </style>

    <div class="prod-topo">
      <h2>🍢 Produtos</h2>
      <button id="btnNovoProduto" class="btn-add">➕ Adicionar Produto</button>
    </div>

    <div class="chips-cats">
      ${chips.map((nome) => `<button class="chip-cat" data-cat="${nome}">${nome}</button>`).join('')}
    </div>

    <div id="avisoCategoria" class="aviso-cat">👆 Clique em uma categoria acima para ver os produtos dela.</div>

    <div id="gridProdutos" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:20px; margin-top:20px;">
      ${listaProdutos.map((p) => `
        <div data-cat="${p.categoria || 'Sem Categoria'}" style="display:none; background:#fff; border-radius:15px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,.08);">
          <img src="${p.imagem ? p.imagem : 'https://via.placeholder.com/400x250?text=Sem+Imagem'}" style="width:100%; height:220px; object-fit:cover; background:#eee;">
          <div style="padding:15px;">
            <div style="font-size:20px; font-weight:bold; margin-bottom:10px;">${p.nome}</div>
            <div style="color:#666; margin-bottom:5px;">Categoria: <strong>${p.categoria || 'Sem Categoria'}</strong></div>
            <p style="color:#666; margin-bottom:10px;">${p.descricao || ''}</p>
            <div style="color:#ff6b00; font-size:24px; font-weight:bold; margin:10px 0;">R$ ${parseFloat(p.preco).toFixed(2).replace('.', ',')}</div>
            <p style="color:#666;">Estoque: <strong>${p.estoque}</strong></p>
            ${p.ativo ? '<span style="background:#d4edda; color:#155724; padding:5px 10px; border-radius:20px; font-size:12px; display:inline-block; margin-top:10px;">Ativo</span>' : '<span style="background:#f8d7da; color:#721c24; padding:5px 10px; border-radius:20px; font-size:12px; display:inline-block; margin-top:10px;">Inativo</span>'}
            ${p.destaque ? '<span style="background:#fff3cd; color:#856404; padding:5px 10px; border-radius:20px; font-size:12px; display:inline-block; margin-top:10px; margin-left:5px;">Destaque</span>' : ''}
            <div style="margin-top:12px; display:flex; gap:6px; flex-wrap:wrap;">
              <a href="/produtos/editar/${p.id}" style="background:#0d6efd; color:#fff; padding:8px 12px; border-radius:5px; text-decoration:none; font-size:14px;">✏️ Editar</a>
              <a href="/api/produtos/excluir/${p.id}" style="background:#dc3545; color:#fff; padding:8px 12px; border-radius:5px; text-decoration:none; font-size:14px;" onclick="return confirm('Excluir?')">Excluir</a>
              <a href="#" style="background:#6f42c1; color:#fff; padding:8px 12px; border-radius:5px; text-decoration:none; font-size:14px;">Adicionais</a>
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- ========== JANELA FLUTUANTE: NOVO PRODUTO ========== -->
    <div id="modalProduto" class="modal-overlay">
      <div class="modal-box">
        <div class="modal-header">
          <h3>🍢 Novo Produto</h3>
          <button id="btnFecharModal" class="modal-x" title="Fechar">✕</button>
        </div>
        <div class="modal-body">
          <form id="formProduto" enctype="multipart/form-data">
            <select name="categoria" required class="campo">
              <option value="">Selecione a categoria</option>
              ${listaCategorias.map((cat) => `<option value="${cat.id}">${cat.nome}</option>`).join('')}
            </select>
            <input type="text" name="nome" placeholder="Nome do Produto" required class="campo">
            <textarea name="descricao" placeholder="Descrição do produto" class="campo"></textarea>
            <input type="number" step="0.01" name="preco" placeholder="Preço" required class="campo">
            <input type="number" name="estoque" placeholder="Quantidade em estoque" required class="campo">
            <input type="file" name="imagem" accept="image/*" class="campo">
            <input type="hidden" name="imagem_url" id="imagem_url">
            <label class="lbl-check"><input type="checkbox" name="ativo" checked> Produto Ativo</label>
            <label class="lbl-check"><input type="checkbox" name="destaque"> Produto Destaque</label>
            <button type="submit" class="btn-salvar-modal">💾 Salvar Produto</button>
          </form>
        </div>
      </div>
    </div>

    <!-- ========== MENSAGEM DE CONFIRMAÇÃO ========== -->
    <div id="toastSucesso" class="toast">✅ Produto cadastrado com sucesso!</div>

    <script>
      // ---------- Abrir / fechar a janela flutuante ----------
      const modal = document.getElementById('modalProduto');
      const abrirModal = () => {
        modal.classList.add('aberto');
        setTimeout(() => modal.querySelector('select[name="categoria"]').focus(), 120);
      };
      const fecharModal = () => modal.classList.remove('aberto');

      document.getElementById('btnNovoProduto').onclick = abrirModal;
      document.getElementById('btnFecharModal').onclick = fecharModal;
      modal.addEventListener('click', (e) => { if (e.target === modal) fecharModal(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharModal(); });

      // ---------- Mensagem de confirmação ----------
      function mostrarToast(msg) {
        const t = document.getElementById('toastSucesso');
        if (msg) t.textContent = msg;
        t.classList.add('visivel');
        setTimeout(() => t.classList.remove('visivel'), 3500);
      }
      if (sessionStorage.getItem('toastProduto') === '1') {
        sessionStorage.removeItem('toastProduto');
        mostrarToast('✅ Produto cadastrado com sucesso!');
      }

      // ---------- Filtro por categoria ----------
      const aviso = document.getElementById('avisoCategoria');
      const cards = Array.from(document.querySelectorAll('#gridProdutos > div'));
      document.querySelectorAll('.chip-cat').forEach((ch) => {
        ch.onclick = () => {
          const cat = ch.dataset.cat;
          const ativando = !ch.classList.contains('ativo');
          document.querySelectorAll('.chip-cat').forEach((x) => x.classList.remove('ativo'));
          if (ativando) {
            ch.classList.add('ativo');
            aviso.style.display = 'none';
            cards.forEach((cd) => { cd.style.display = cd.dataset.cat === cat ? '' : 'none'; });
          } else {
            aviso.style.display = 'block';
            cards.forEach((cd) => { cd.style.display = 'none'; });
          }
        };
      });

      // ---------- Salvar: upload + cadastro + confirmação ----------
      document.getElementById('formProduto').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Salvando...';
        try {
          const fileInput = form.querySelector('input[name="imagem"]');
          if (fileInput.files.length > 0) {
            const fd = new FormData();
            fd.append('imagem', fileInput.files[0]);
            const res = await fetch('/api/upload', { method: 'POST', body: fd });
            const json = await res.json();
            if (json.url) form.querySelector('#imagem_url').value = json.url;
          }
          const formData = new FormData(form);
          const resp = await fetch('/api/produtos', { method: 'POST', body: formData });
          if (!resp.ok) throw new Error('Erro ao salvar o produto');
          sessionStorage.setItem('toastProduto', '1');
          window.location.reload();
        } catch (err) {
          btn.disabled = false;
          btn.textContent = '💾 Salvar Produto';
          alert('Não foi possível salvar: ' + err.message);
        }
      });
    </script>
  `

  return c.html(renderLayout('Produtos', conteudo, 'produtos'))
})

export default app