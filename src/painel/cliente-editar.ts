import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const cliente = await c.env.DB.prepare('SELECT * FROM clientes WHERE id = ?').bind(id).first() as any

  if (!cliente) return c.html('<h1>Cliente não encontrado</h1>')

  const conteudo = `
    <style>
      .voltar { display:inline-block; margin-bottom:20px; color:#ff6b00; text-decoration:none; font-weight:bold; }
      .form-card { background:#fff; padding:30px; border-radius:15px; box-shadow:0 3px 15px rgba(0,0,0,.08); max-width:800px; }
      .form-card h2 { margin:0 0 5px; color:#333; }
      .form-card p { margin:0 0 25px; color:#666; font-size:14px; }
      .form-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:15px; }
      .form-group { margin-bottom:15px; }
      .form-group label { display:block; margin-bottom:5px; font-weight:bold; color:#555; font-size:14px; }
      .form-group input { width:100%; padding:11px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; font-size:15px; }
      .form-group input:focus { outline:none; border-color:#ff6b00; box-shadow:0 0 0 3px rgba(255,107,0,.1); }
      .botoes { display:flex; gap:10px; margin-top:25px; flex-wrap:wrap; }
      .btn { padding:12px 24px; border-radius:8px; font-weight:bold; cursor:pointer; border:none; font-size:15px; text-decoration:none; display:inline-block; }
      .btn-salvar { background:#198754; color:#fff; }
      .btn-salvar:hover { background:#146c43; }
      .btn-cancelar { background:#6c757d; color:#fff; }
      .btn-cancelar:hover { background:#5a6268; }
      .obrigatorio { color:#dc3545; }
    </style>

    <a href="/clientes/detalhes/${cliente.id}" class="voltar">← Voltar para o Cliente</a>

    <div class="form-card">
      <h2>✏️ Editar Cliente</h2>
      <p>Atualize os dados cadastrais de <strong>${cliente.nome}</strong></p>

      <form method="POST" action="/api/clientes/${cliente.id}?_method=PUT" onsubmit="return confirmar()">
        <div class="form-grid">
          <div class="form-group">
            <label>Nome <span class="obrigatorio">*</span></label>
            <input type="text" name="nome" value="${cliente.nome || ''}" required>
          </div>
          <div class="form-group">
            <label>Telefone / WhatsApp <span class="obrigatorio">*</span></label>
            <input type="tel" name="telefone" value="${cliente.telefone || ''}" required placeholder="(00) 90000-0000">
          </div>
          <div class="form-group">
            <label>CEP</label>
            <input type="text" name="cep" value="${cliente.cep || ''}" placeholder="00000-000">
          </div>
          <div class="form-group">
            <label>Endereço (Rua)</label>
            <input type="text" name="endereco" value="${cliente.endereco || ''}">
          </div>
          <div class="form-group">
            <label>Número</label>
            <input type="text" name="numero" value="${cliente.numero || ''}">
          </div>
          <div class="form-group">
            <label>Bairro</label>
            <input type="text" name="bairro" value="${cliente.bairro || ''}">
          </div>
          <div class="form-group">
            <label>Complemento</label>
            <input type="text" name="complemento" value="${cliente.complemento || ''}" placeholder="Apto, Bloco...">
          </div>
          <div class="form-group">
            <label>Referência</label>
            <input type="text" name="referencia" value="${cliente.referencia || ''}" placeholder="Próximo a...">
          </div>
        </div>

        <div class="botoes">
          <button type="submit" class="btn btn-salvar">💾 Salvar Alterações</button>
          <a href="/clientes/detalhes/${cliente.id}" class="btn btn-cancelar">Cancelar</a>
        </div>
      </form>
    </div>

    <script>
      // Hono não aceita PUT diretamente de form HTML, então converte POST+_method em PUT
      document.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        
        const res = await fetch('/api/clientes/${cliente.id}', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(formData)
        });
        
        if (res.ok) {
          window.location.href = '/clientes/detalhes/${cliente.id}';
        } else {
          alert('Erro ao atualizar cliente.');
        }
      });

      function confirmar() {
        return confirm('Salvar as alterações deste cliente?');
      }
    </script>
  `

  return c.html(renderLayout('Editar Cliente', conteudo, 'clientes'))
})

export default app