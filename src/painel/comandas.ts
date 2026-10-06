import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

const brl = (v: number) => (v || 0).toFixed(2).replace('.', ',')
const horaBr = (dt: string) => {
  try {
    return new Date(dt.replace(' ', 'T') + 'Z').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

app.get('/', async (c) => {
  const abertas = await c.env.DB.prepare(`SELECT * FROM comandas WHERE status = 'aberta' ORDER BY id DESC`).all() as any
  for (const com of abertas.results) {
    const itens = await c.env.DB.prepare(`
      SELECT ip.*, pr.nome AS produto
      FROM itens_pedido ip
      LEFT JOIN produtos pr ON pr.id = ip.produto_id
      WHERE ip.pedido_id = ?
      ORDER BY ip.id ASC
    `).bind(com.pedido_id).all()
    com.itens = itens.results
  }

  const historico = await c.env.DB.prepare(`
    SELECT * FROM comandas WHERE status != 'aberta'
    ORDER BY COALESCE(data_fechamento, criado_em) DESC LIMIT 20
  `).all() as any

  const vendasHoje = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(total), 0) AS t, COUNT(*) AS q
    FROM comandas
    WHERE status = 'fechada' AND date(data_fechamento, '-3 hours') = date('now', '-3 hours')
  `).first() as any

  const produtos = await c.env.DB.prepare('SELECT id, nome, preco FROM produtos WHERE ativo = 1 ORDER BY nome ASC').all() as any

  const conteudo = `
    <style>
      /* ========== MOBILE-FIRST ========== */
      .cards { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:18px; }
      .card { background:#fff; border-radius:14px; padding:14px; box-shadow:0 3px 15px rgba(0,0,0,.08); }
      .card h3 { margin:0; font-size:22px; color:#111; }
      .card p { margin:4px 0 0; color:#777; font-size:12px; }
      .card.destaque h3 { color:#ff6b00; }
      .box { background:#fff; border-radius:14px; padding:16px; box-shadow:0 3px 15px rgba(0,0,0,.08); margin-bottom:16px; overflow-x:auto; }
      .box h3 { margin:0 0 12px; color:#333; font-size:16px; }

      .form-linha { display:flex; flex-direction:column; gap:10px; }
      .form-linha input { width:100%; padding:14px; border:1px solid #ddd; border-radius:10px; font-size:16px; box-sizing:border-box; }
      .btn { border:none; padding:14px 18px; border-radius:10px; cursor:pointer; font-weight:bold; color:#fff; font-size:16px; min-height:48px; }
      .btn:active { opacity:.85; }
      .btn-abrir { background:#198754; width:100%; }

      .comandas-grid { display:flex; flex-direction:column; gap:14px; }
      .comanda-card { background:#fff; border-radius:14px; padding:16px; box-shadow:0 4px 15px rgba(0,0,0,.08); border-top:5px solid #28a745; }
      .comanda-topo { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
      .comanda-topo h3 { margin:0; color:#333; font-size:19px; }
      .pill { padding:4px 12px; border-radius:20px; font-size:12px; font-weight:bold; color:#fff; }
      .pill.aberta { background:#28a745; }
      .pill.fechada { background:#007bff; }
      .pill.cancelada { background:#dc3545; }

      .itens-lista { margin:10px 0; border-top:1px dashed #ddd; border-bottom:1px dashed #ddd; padding:8px 0; min-height:36px; }
      .item-linha { display:flex; justify-content:space-between; align-items:center; padding:7px 0; font-size:15px; gap:8px; }
      .item-linha button { background:#dc3545; color:#fff; border:none; border-radius:6px; cursor:pointer; min-width:34px; min-height:34px; font-size:15px; margin-left:6px; }

      .add-item { display:flex; flex-wrap:wrap; gap:8px; margin:10px 0; }
      .add-item select { flex:1 1 100%; min-height:48px; padding:10px; border:1px solid #ddd; border-radius:10px; font-size:16px; background:#fff; }
      .add-item input { flex:1; min-height:48px; padding:10px; border:1px solid #ddd; border-radius:10px; font-size:16px; }
      .add-item button { flex:0 0 64px; min-height:48px; font-size:22px; background:#ff6b00; }

      .comanda-total { text-align:right; font-size:21px; font-weight:bold; color:#28a745; margin:10px 0; }

      .fechar-linha { display:flex; flex-wrap:wrap; gap:8px; }
      .fechar-linha select { flex:1 1 100%; min-height:48px; padding:10px; border:1px solid #ddd; border-radius:10px; font-size:16px; background:#fff; }
      .btn-fechar { flex:2; background:#007bff; min-height:50px; }
      .btn-cancelar { flex:1; background:#dc3545; min-height:50px; }

      .table-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; }
      table { width:100%; border-collapse:collapse; min-width:520px; }
      th, td { padding:10px 8px; text-align:left; border-bottom:1px solid #eee; font-size:13px; }
      th { background:#f8f9fa; color:#495057; font-size:11px; text-transform:uppercase; }

      /* ========== TABLET / DESKTOP ========== */
      @media (min-width:768px) {
        .cards { grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:18px; }
        .card h3 { font-size:28px; }
        .box { padding:20px 25px; }
        .form-linha { flex-direction:row; }
        .form-linha input#novaMesa { width:140px; flex:none; }
        .form-linha input#novoNome { flex:1; }
        .btn-abrir { width:auto; }
        .comandas-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:20px; }
        .add-item select { flex:1 1 auto; }
        .add-item input { flex:0 0 80px; }
        .add-item button { flex:0 0 56px; }
        .fechar-linha select { flex:1 1 auto; }
        table { min-width:0; }
        th, td { font-size:14px; }
      }
    </style>

    <h1 style="margin-bottom:20px; color:#333; font-size:22px;">🧾 Comandas (Atendimento Presencial)</h1>

    <div class="cards">
      <div class="card destaque">
        <h3>${abertas.results.length}</h3>
        <p>Comandas abertas agora</p>
      </div>
      <div class="card">
        <h3 style="color:#28a745;">R$ ${brl(vendasHoje.t)}</h3>
        <p>Vendas hoje (${vendasHoje.q})</p>
      </div>
    </div>

    <div class="box">
      <h3>➕ Abrir Nova Comanda</h3>
      <div class="form-linha">
        <input type="text" id="novaMesa" placeholder="Mesa (ex: 05)" inputmode="numeric">
        <input type="text" id="novoNome" placeholder="Nome do cliente (opcional)">
        <button class="btn btn-abrir" onclick="abrirComanda()">🍽️ Abrir Comanda</button>
      </div>
    </div>

    ${abertas.results.length === 0 ? `
      <div class="box" style="text-align:center; color:#888; padding:40px 16px;">
        <h3 style="color:#888;">Nenhuma comanda aberta no momento.</h3>
      </div>
    ` : `
      <div class="comandas-grid">
        ${abertas.results.map((com: any) => `
          <div class="comanda-card">
            <div class="comanda-topo">
              <h3>🍽️ Mesa ${com.mesa_numero}</h3>
              <span class="pill aberta">aberta</span>
            </div>
            <p style="color:#666; font-size:13px; margin:0;">
              👤 ${com.nome_cliente || 'Cliente não informado'} · 🕐 ${horaBr(com.data_abertura)}
            </p>

            <div class="itens-lista">
              ${com.itens.length === 0 ? '<p style="color:#aaa; font-size:13px; text-align:center;">Nenhum item lançado.</p>' :
                com.itens.map((i: any) => `
                  <div class="item-linha">
                    <span>${i.quantidade}x ${i.produto || i.nome_item}</span>
                    <span style="white-space:nowrap;">
                      R$ ${brl(i.subtotal)}
                      <button onclick="removerItem(${com.id}, ${i.id})" title="Remover">✕</button>
                    </span>
                  </div>
                `).join('')
              }
            </div>

            <div class="add-item">
              <select id="prod-${com.id}">
                ${produtos.results.map((p: any) => `<option value="${p.id}">${p.nome} - R$ ${brl(p.preco)}</option>`).join('')}
              </select>
              <input type="number" id="qtd-${com.id}" value="1" min="1" inputmode="numeric">
              <button class="btn" onclick="addItem(${com.id})">+</button>
            </div>

            <div class="comanda-total">Total: R$ ${brl(com.total)}</div>

            <div class="fechar-linha">
              <select id="pag-${com.id}">
                <option value="DINHEIRO">💵 Dinheiro</option>
                <option value="PIX">💠 PIX</option>
                <option value="CARTAO_CREDITO">💳 Crédito</option>
                <option value="CARTAO_DEBITO">💳 Débito</option>
              </select>
              <button class="btn btn-fechar" onclick="fecharComanda(${com.id})">✅ Fechar</button>
              <button class="btn btn-cancelar" onclick="cancelarComanda(${com.id})">✖</button>
            </div>
          </div>
        `).join('')}
      </div>
    `}

    <div class="box">
      <h3>📜 Histórico Recente</h3>
      ${historico.results.length === 0 ? '<p style="color:#888; text-align:center;">Nenhuma comanda finalizada ainda.</p>' : `
        <div class="table-scroll">
          <table>
            <tr><th>#</th><th>Mesa</th><th>Cliente</th><th>Total</th><th>Status</th><th>Fechamento</th></tr>
            ${historico.results.map((h: any) => `
              <tr>
                <td>${h.id}</td>
                <td>Mesa ${h.mesa_numero}</td>
                <td>${h.nome_cliente || '—'}</td>
                <td>R$ ${brl(h.total)}</td>
                <td><span class="pill ${h.status}">${h.status}</span></td>
                <td>${h.data_fechamento ? horaBr(h.data_fechamento) : '—'}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      `}
    </div>

    <script>
      async function abrirComanda() {
        const mesa = document.getElementById('novaMesa').value.trim();
        const nome = document.getElementById('novoNome').value.trim();
        if (!mesa) return alert('Informe o número da mesa!');
        const res = await fetch('/api/comandas/abrir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mesa_numero: mesa, nome_cliente: nome })
        });
        const json = await res.json();
        if (json.sucesso) location.reload();
        else alert(json.erro);
      }

      async function addItem(comandaId) {
        const produto_id = document.getElementById('prod-' + comandaId).value;
        const quantidade = document.getElementById('qtd-' + comandaId).value;
        const res = await fetch('/api/comandas/itens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comanda_id: comandaId, produto_id, quantidade })
        });
        const json = await res.json();
        if (json.sucesso) location.reload();
        else alert(json.erro);
      }

      async function removerItem(comandaId, itemId) {
        if (!confirm('Remover este item da comanda?')) return;
        const res = await fetch('/api/comandas/remover-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comanda_id: comandaId, item_id: itemId })
        });
        const json = await res.json();
        if (json.sucesso) location.reload();
        else alert(json.erro);
      }

      async function fecharComanda(comandaId) {
        const pagamento = document.getElementById('pag-' + comandaId).value;
        if (!confirm('Fechar esta comanda? O valor será lançado no financeiro.')) return;
        const res = await fetch('/api/comandas/fechar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comanda_id: comandaId, pagamento })
        });
        const json = await res.json();
        if (json.sucesso) location.reload();
        else alert(json.erro);
      }

      async function cancelarComanda(comandaId) {
        if (!confirm('CANCELAR esta comanda? Os itens serão descartados.')) return;
        const res = await fetch('/api/comandas/cancelar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comanda_id: comandaId })
        });
        const json = await res.json();
        if (json.sucesso) location.reload();
        else alert(json.erro);
      }
    </script>
  `

  return c.html(renderLayout('Comandas', conteudo, 'comandas'))
})

export default app