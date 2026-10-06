import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const categoria = await c.env.DB.prepare('SELECT * FROM categorias WHERE id = ?').bind(id).first() as any

  if (!categoria) return c.html('<h1>Categoria não encontrada</h1>')

  // Conta quantos produtos usam esta categoria (aviso útil)
  const qtdProdutos = await c.env.DB.prepare('SELECT COUNT(*) as total FROM produtos WHERE categoria_id = ?').bind(id).first() as any

  const conteudo = `
    <style>
      .voltar { display:inline-block; margin-bottom:20px; color:#ff6b00; text-decoration:none; font-weight:bold; }
      .form-card { background:#fff; padding:30px; border-radius:15px; box-shadow:0 3px 15px rgba(0,0,0,.08); max-width:600px; }
      .form-card h2 { margin:0 0 5px; color:#333; }
      .form-card p { margin:0 0 25px; color:#666; font-size:14px; }
      .aviso { background:#fff3cd; color:#856404; padding:12px 15px; border-radius:10px; margin-bottom:20px; font-size:14px; }
      .form-group { margin-bottom:18px; }
      .form-group label { display:block; margin-bottom:6px; font-weight:bold; color:#555; font-size:14px; }
      .form-group input[type="text"] { width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; font-size:15px; }
      .form-group input[type="text"]:focus { outline:none; border-color:#ff6b00; box-shadow:0 0 0 3px rgba(255,107,0,.1); }
      .check-ativo { display:flex; align-items:center; gap:10px; color:#555; font-weight:bold; cursor:pointer; }
      .check-ativo input { width:auto; }
      .botoes { display:flex; gap:10px; margin-top:25px; flex-wrap:wrap; }
      .btn { padding:12px 24px; border-radius:8px; font-weight:bold; cursor:pointer; border:none; font-size:15px; text-decoration:none; display:inline-block; }
      .btn-salvar { background:#198754; color:#fff; }
      .btn-salvar:hover { background:#146c43; }
      .btn-cancelar { background:#6c757d; color:#fff; }
      .btn-cancelar:hover { background:#5a6268; }
      .obrigatorio { color:#dc3545; }
    </style>

    <a href="/categorias" class="voltar">← Voltar para Categorias</a>

    <div class="form-card">
      <h2>✏️ Editar Categoria</h2>
      <p>Atualize os dados da categoria <strong>${categoria.nome}</strong></p>

      ${qtdProdutos?.total > 0 ? `
        <div class="aviso">
          ⚠️ Esta categoria possui <strong>${qtdProdutos.total}</strong> produto(s) vinculado(s).
          Alterar o nome não afeta os produtos, apenas o rótulo exibido.
        </div>
      ` : ''}

      <form id="formEditarCategoria">
        <div class="form-group">
          <label>Nome da Categoria <span class="obrigatorio">*</span></label>
          <input type="text" name="nome" value="${categoria.nome || ''}" required placeholder="Ex: Espetos, Bebidas, Porções...">
        </div>

        <div class="form-group">
          <label class="check-ativo">
            <input type="checkbox" name="ativo" ${categoria.ativo ? 'checked' : ''}>
            Categoria Ativa (aparece no cardápio)
          </label>
        </div>

        <div class="botoes">
          <button type="submit" class="btn btn-salvar">💾 Salvar Alterações</button>
          <a href="/categorias" class="btn btn-cancelar">Cancelar</a>
        </div>
      </form>
    </div>

    <script>
      document.getElementById('formEditarCategoria').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);

        const res = await fetch('/api/categorias/${categoria.id}', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(formData)
        });

        if (res.ok) {
          window.location.href = '/categorias';
        } else {
          alert('Erro ao atualizar categoria.');
        }
      });
    </script>
  `

  return c.html(renderLayout('Editar Categoria', conteudo, 'categorias'))
})

export default app