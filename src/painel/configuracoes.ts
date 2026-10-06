import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const config = await c.env.DB.prepare('SELECT * FROM configuracoes WHERE id = 1').first() as any || {}
  const ok = c.req.query('ok')

  const conteudo = `
    <style>
      .form-card { background:#fff; padding:25px; border-radius:15px; box-shadow:0 3px 15px rgba(0,0,0,.08); }
      .form-group { margin-bottom:15px; }
      .form-group label { display:block; margin-bottom:5px; font-weight:bold; color:#555; }
      .form-group input, .form-group textarea, .form-group select { width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; }
      .btn-salvar { background:#198754; color:#fff; border:none; padding:12px 20px; border-radius:8px; cursor:pointer; font-weight:bold; font-size:16px; }
      .alerta { background:#d4edda; color:#155724; padding:15px; border-radius:10px; margin-bottom:20px; font-weight:bold; }
      .logo-preview { max-width:180px; max-height:120px; display:block; margin:10px 0; border-radius:10px; border:1px solid #ddd; padding:5px; background:#fff; }
      .entrega-card { border:1px solid #f0d6c0; background:#fff8f2; padding:20px; border-radius:15px; margin:20px 0; }
      .entrega-card h3 { margin-bottom:8px; color:#333; }
      .entrega-ajuda { color:#555; font-size:14px; margin-bottom:15px; line-height:1.5; }
      .form-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:15px; }
      h1 { color:#333; margin-bottom:25px; }
      .secao-titulo { color:#ff6b00; font-size:18px; font-weight:bold; margin:25px 0 15px; padding-bottom:10px; border-bottom:2px solid #f0f0f0; }
    </style>

    <h1>⚙️ Configurações</h1>

    ${ok ? '<div class="alerta">✅ Configurações salvas com sucesso!</div>' : ''}

    <div class="form-card">
      <form id="formConfig" enctype="multipart/form-data">

        <div class="secao-titulo">🏪 Dados da Empresa</div>

        <div class="form-group">
          <label>Nome da Espetaria</label>
          <input type="text" name="nome_empresa" value="${config.nome_empresa || ''}">
        </div>

        <div class="form-group">
          <label>Logo da Espetaria</label>
          ${config.logo ? `<img src="${config.logo.startsWith('/r2/') ? config.logo : '/r2/' + config.logo}" class="logo-preview">` : ''}
          <input type="file" name="logo" accept="image/*" id="inputLogo">
          <input type="hidden" name="logo_url" id="logo_url">
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Telefone</label>
            <input type="text" name="telefone" value="${config.telefone || ''}">
          </div>

          <div class="form-group">
            <label>WhatsApp</label>
            <input type="text" name="whatsapp" value="${config.whatsapp || ''}">
          </div>
        </div>

        <div class="form-group">
          <label>Email</label>
          <input type="text" name="email" value="${config.email || ''}">
        </div>

        <div class="form-group">
          <label>Endereço</label>
          <textarea name="endereco">${config.endereco || ''}</textarea>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Cidade</label>
            <input type="text" name="cidade" value="${config.cidade || ''}">
          </div>

          <div class="form-group">
            <label>Estado</label>
            <input type="text" name="estado" value="${config.estado || ''}">
          </div>

          <div class="form-group">
            <label>CEP</label>
            <input type="text" name="cep" value="${config.cep || ''}">
          </div>
        </div>

        <div class="secao-titulo">💳 Pagamento</div>

        <div class="form-group">
          <label>Chave PIX</label>
          <input type="text" name="chave_pix" value="${config.chave_pix || ''}">
        </div>

        <div class="entrega-card">
          <h3>🚚 Regra da Taxa de Entrega</h3>
          <p class="entrega-ajuda">
            Use esta regra para o bot calcular a entrega automaticamente pela distância do endereço do cliente.<br>
            Exemplo: até 3 km cobra R$ 10,00. Acima de 3 km soma R$ 2,00 por km adicional.
          </p>

          <div class="form-grid">
            <div class="form-group">
              <label>Taxa base até o limite de km (R$)</label>
              <input type="number" step="0.01" min="0" name="taxa_entrega" value="${config.taxa_entrega || '0.00'}">
            </div>

            <div class="form-group">
              <label>Limite da taxa base (km)</label>
              <input type="number" step="0.01" min="0.01" name="entrega_km_base" value="${config.entrega_km_base || '3.00'}">
            </div>

            <div class="form-group">
              <label>Valor por km adicional (R$)</label>
              <input type="number" step="0.01" min="0" name="entrega_valor_km_adicional" value="${config.entrega_valor_km_adicional || '2.00'}">
            </div>

            <div class="form-group">
              <label>Taxa se o mapa falhar (R$)</label>
              <input type="number" step="0.01" min="0" name="entrega_taxa_fallback" value="${config.entrega_taxa_fallback || '10.00'}">
            </div>

            <div class="form-group">
              <label>Latitude da loja</label>
              <input type="text" name="loja_lat" placeholder="Ex: -22.8583" value="${config.loja_lat || ''}">
            </div>

            <div class="form-group">
              <label>Longitude da loja</label>
              <input type="text" name="loja_lng" placeholder="Ex: -47.2200" value="${config.loja_lng || ''}">
            </div>
          </div>
        </div>

        <div class="secao-titulo">🕐 Horários e Preparo</div>

        <div class="form-grid">
          <div class="form-group">
            <label>Tempo Médio de Preparo (min)</label>
            <input type="number" name="tempo_preparo" value="${config.tempo_preparo || '30'}">
          </div>

          <div class="form-group">
            <label>Horário de Abertura</label>
            <input type="time" name="horario_abertura" value="${config.horario_abertura || ''}">
          </div>

          <div class="form-group">
            <label>Horário de Fechamento</label>
            <input type="time" name="horario_fechamento" value="${config.horario_fechamento || ''}">
          </div>
        </div>

        <br>
        <button type="submit" class="btn-salvar">💾 Salvar Configurações</button>
      </form>
    </div>

    <script>
      document.getElementById('formConfig').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const fileInput = form.querySelector('#inputLogo');

        // Upload da logo primeiro se existir
        if (fileInput.files.length > 0) {
          const fd = new FormData();
          fd.append('logo', fileInput.files[0]);
          const res = await fetch('/api/configuracoes/upload-logo', { method: 'POST', body: fd });
          const json = await res.json();
          if (json.url) form.querySelector('#logo_url').value = json.url;
        }

        const formData = new FormData(form);
        await fetch('/api/configuracoes', { method: 'POST', body: formData });
        window.location.href = '/configuracoes?ok=1';
      });
    </script>
  `

  return c.html(renderLayout('Configurações', conteudo, 'configuracoes'))
})

export default app