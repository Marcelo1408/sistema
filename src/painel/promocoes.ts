import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

const brl = (v: number) => (v || 0).toFixed(2).replace('.', ',')
const dataBr = (d: string) => {
  if (!d) return ''
  const [a, m, dia] = d.split('-')
  return `${dia}/${m}/${a}`
}

// Status automático pela data
function statusPromo(p: any) {
  if (!p.ativo) return { label: 'Inativa', cor: '#6c757d', icone: '⚪' }
  const hoje = new Date().toISOString().slice(0, 10)
  if (p.data_inicio && hoje < p.data_inicio) return { label: 'Agendada', cor: '#ffc107', icone: '🟡' }
  if (p.data_fim && hoje > p.data_fim) return { label: 'Expirada', cor: '#dc3545', icone: '🔴' }
  return { label: 'Ativa', cor: '#28a745', icone: '🟢' }
}

app.get('/', async (c) => {
  // Promoções com produto vinculado
  const promocoes = await c.env.DB.prepare(`
    SELECT pr.*, p.nome AS produto_nome, p.preco AS preco_original
    FROM promocoes pr
    LEFT JOIN produtos p ON p.id = pr.produto_id
    ORDER BY pr.id DESC
  `).all() as any

  // Produtos ativos para o select
  const produtos = await c.env.DB.prepare('SELECT id, nome, preco FROM produtos WHERE ativo=1 ORDER BY nome ASC').all() as any

  // Estatísticas
  const hoje = new Date().toISOString().slice(0, 10)
  let ativas = 0, agendadas = 0, expiradas = 0
  for (const p of promocoes.results) {
    const s = statusPromo(p)
    if (s.label === 'Ativa') ativas++
    else if (s.label === 'Agendada') agendadas++
    else if (s.label === 'Expirada') expiradas++
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
      .form-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:15px; }
      .form-group { margin-bottom:15px; }
      .form-group label { display:block; margin-bottom:5px; font-weight:bold; color:#555; }
      .form-group input, .form-group select, .form-group textarea { width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; }
      .btn-salvar { background:#198754; color:#fff; border:none; padding:12px 20px; border-radius:8px; cursor:pointer; font-weight:bold; }
      table { width:100%; border-collapse:collapse; }
      th, td { padding:12px 10px; text-align:left; border-bottom:1px solid #eee; font-size:14px; }
      th { background:#f8f9fa; color:#495057; font-size:12px; text-transform:uppercase; }
      tr:hover { background:#f9f9f9; }
      .promo-img { width:80px; height:60px; object-fit:cover; border-radius:8px; background:#eee; }
      .preco-de { text-decoration:line-through; color:#999; font-size:13px; }
      .preco-por { color:#28a745; font-weight:bold; font-size:16px; }
      .desconto { background:#ff6b00; color:#fff; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:bold; margin-left:6px; }
      .pill { padding:5px 10px; border-radius:20px; font-size:12px; font-weight:bold; color:#fff; white-space:nowrap; }
      .acoes a { text-decoration:none; margin-right:6px; font-size:12px; padding:6px 10px; border-radius:5px; display:inline-block; color:#fff; }
    </style>

    <h1 style="margin-bottom:25px; color:#333;">🏷️ Promoções</h1>

    <div class="cards">
      <div class="card destaque">
        <h3>${promocoes.results.length}</h3>
        <p>Total de promoções</p>
      </div>
      <div class="card">
        <h3 style="color:#28a745;">${ativas}</h3>
        <p>Ativas agora</p>
      </div>
      <div class="card">
        <h3 style="color:#ffc107;">${agendadas}</h3>
        <p>Agendadas</p>
      </div>
      <div class="card">
        <h3 style="color:#dc3545;">${expiradas}</h3>
        <p>Expiradas</p>
      </div>
    </div>

    <div class="box">
      <h3>➕ Nova Promoção</h3>
      <form id="formPromo">
        <div class="form-grid">
          <div class="form-group">
            <label>Título da Promoção</label>
            <input type="text" name="titulo" placeholder="Ex: Festival de Espetos" required>
          </div>
          <div class="form-group">
            <label>Produto em Promoção</label>
            <select name="produto_id" id="selectProduto">
              <option value="">Sem produto vinculado</option>
              ${produtos.results.map((p: any) => `<option value="${p.id}" data-preco="${p.preco}">${p.nome} - R$ ${brl(p.preco)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Preço Promocional (R$)</label>
            <input type="number" step="0.01" name="preco_promocional" required>
          </div>
        </div>

        <div class="form-group">
          <label>Descrição</label>
          <textarea name="descricao" rows="2" placeholder="Ex: Válido apenas às terças-feiras..."></textarea>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Data de Início</label>
            <input type="date" name="data_inicio">
          </div>
          <div class="form-group">
            <label>Data de Fim</label>
            <input type="date" name="data_fim">
          </div>
          <div class="form-group">
            <label>Imagem da Promoção</label>
            <input type="file" name="imagem" accept="image/*" id="inputImagem">
            <input type="hidden" name="imagem_url" id="imagem_url">
          </div>
        </div>

        <label style="display:flex; align-items:center; gap:10px; margin-bottom:15px; color:#555;">
          <input type="checkbox" name="ativo" checked style="width:auto;"> Promoção Ativa
        </label>

        <button type="submit" class="btn-salvar">💾 Salvar Promoção</button>
      </form>
    </div>

    <div class="box">
      <h3>📋 Promoções Cadastradas (${promocoes.results.length})</h3>
      ${promocoes.results.length === 0 ? `
        <p style="text-align:center; color:#888; padding:20px;">Nenhuma promoção cadastrada.</p>
      ` : `
        <table>
          <tr>
            <th>ID</th>
            <th>Imagem</th>
            <th>Promoção</th>
            <th>Produto</th>
            <th>Preço</th>
            <th>Período</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
          ${promocoes.results.map((p: any) => {
            const s = statusPromo(p)
            const desconto = p.preco_original > 0 && p.preco_promocional > 0
              ? Math.round(((p.preco_original - p.preco_promocional) / p.preco_original) * 100)
              : 0
            return `
              <tr>
                <td>${p.id}</td>
                <td>${p.imagem ? `<img src="${p.imagem}" class="promo-img">` : '—'}</td>
                <td>
                  <strong>${p.titulo}</strong>
                  ${p.descricao ? `<br><small style="color:#888;">${p.descricao}</small>` : ''}
                </td>
                <td>${p.produto_nome || '—'}</td>
                <td>
                  ${p.preco_original ? `<span class="preco-de">R$ ${brl(p.preco_original)}</span><br>` : ''}
                  <span class="preco-por">R$ ${brl(p.preco_promocional)}</span>
                  ${desconto > 0 ? `<span class="desconto">-${desconto}%</span>` : ''}
                </td>
                <td>
                  ${p.data_inicio ? dataBr(p.data_inicio) : '—'} até<br>${p.data_fim ? dataBr(p.data_fim) : 'sem fim'}
                </td>
                <td><span class="pill" style="background:${s.cor};">${s.icone} ${s.label}</span></td>
                <td class="acoes">
                  ${p.ativo
                    ? `<a href="/api/promocoes/acao/${p.id}/desativar" style="background:#6c757d;">Desativar</a>`
                    : `<a href="/api/promocoes/acao/${p.id}/ativar" style="background:#198754;">Ativar</a>`}
                  <a href="/api/promocoes/excluir/${p.id}" style="background:#dc3545;" onclick="return confirm('Excluir esta promoção?')">🗑️</a>
                </td>
              </tr>
            `
          }).join('')}
        </table>
      `}
    </div>

    <script>
      // Ao escolher um produto, sugere um preço promocional (10% off)
      document.getElementById('selectProduto').addEventListener('change', function() {
        const opt = this.options[this.selectedIndex];
        const preco = parseFloat(opt.dataset.preco || 0);
        const inputPreco = document.querySelector('input[name="preco_promocional"]');
        if (preco > 0 && !inputPreco.value) {
          inputPreco.value = (preco * 0.9).toFixed(2);
        }
      });

      document.getElementById('formPromo').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const fileInput = form.querySelector('#inputImagem');

        if (fileInput.files.length > 0) {
          const fd = new FormData();
          fd.append('imagem', fileInput.files[0]);
          const res = await fetch('/api/upload', { method: 'POST', body: fd });
          const json = await res.json();
          if (json.url) form.querySelector('#imagem_url').value = json.url;
        }

        const formData = new FormData(form);
        await fetch('/api/promocoes', { method: 'POST', body: formData });
        window.location.reload();
      });
    </script>
  `

  return c.html(renderLayout('Promoções', conteudo, 'promocoes'))
})

export default app