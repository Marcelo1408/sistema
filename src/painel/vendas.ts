import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const produtos = await c.env.DB.prepare('SELECT id, nome, preco FROM produtos WHERE ativo = 1 ORDER BY nome ASC').all() as any
  const produtosJson = JSON.stringify((produtos.results as any[]).map((p) => ({ id: p.id, nome: p.nome, preco: Number(p.preco) || 0 }))).replace(/</g, '\\u003c')

  const conteudo = `
    <style>
      .box { background:#fff; border-radius:15px; padding:20px; box-shadow:0 3px 15px rgba(0,0,0,.08); margin-bottom:20px; }
      .box h3 { margin:0 0 15px; color:#333; font-size:17px; }
      .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .form-group { margin-bottom:12px; }
      .form-group label { display:block; margin-bottom:5px; font-weight:bold; color:#555; font-size:13px; }
      .form-group input, .form-group select, .form-group textarea { width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; font-size:16px; }
      .secao-titulo { font-size:13px; font-weight:bold; color:#ff6b00; text-transform:uppercase; margin:16px 0 8px; letter-spacing:.5px; }
      .va-item { display:grid; grid-template-columns:1.2fr 1fr 56px 96px 84px 36px; gap:8px; align-items:center; margin-bottom:8px; }
      .va-item select, .va-item input { padding:10px; border:1px solid #ddd; border-radius:8px; width:100%; box-sizing:border-box; font-size:15px; background:#fff; }
      .va-item input[readonly] { background:#f2f2f2; color:#555; }
      .va-sub { font-size:13px; color:#666; text-align:right; }
      .va-rm { background:#dc3545; color:#fff; border:none; border-radius:6px; min-height:38px; cursor:pointer; }
      .btn-add-item { background:#6f42c1; color:#fff; border:none; padding:10px 16px; border-radius:8px; cursor:pointer; font-weight:bold; margin-bottom:12px; }
      .totais-linha { display:flex; justify-content:space-between; padding:6px 0; font-size:15px; color:#444; }
      .totais-linha.total { font-size:20px; font-weight:bold; color:#28a745; border-top:2px dashed #ddd; padding-top:10px; margin-top:6px; }
      .btn-salvar { background:#198754; color:#fff; border:none; padding:14px 22px; border-radius:10px; cursor:pointer; font-weight:bold; font-size:16px; width:100%; min-height:50px; }
      .filtros { display:flex; gap:10px; flex-wrap:wrap; align-items:end; margin-bottom:15px; }
      .filtros label { display:block; font-size:13px; color:#555; font-weight:bold; margin-bottom:4px; }
      .filtros input { padding:10px; border:1px solid #ddd; border-radius:8px; font-size:16px; }
      .btn-filtrar { background:#ff6b00; color:#fff; border:none; padding:12px 20px; border-radius:8px; cursor:pointer; font-weight:bold; min-height:44px; }
      .dia-grupo { margin-bottom:22px; }
      .dia-titulo { display:flex; justify-content:space-between; align-items:center; background:#1a1a2e; color:#fff; padding:10px 14px; border-radius:10px 10px 0 0; font-weight:bold; font-size:14px; }
      .dia-titulo .dia-total { color:#7CFC9B; }
      .vend-linha { background:#fafafa; border:1px solid #eee; border-bottom:none; padding:12px 14px; }
      .vend-linha:last-child { border-bottom:1px solid #eee; border-radius:0 0 10px 10px; }
      .vend-topo { display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; align-items:center; }
      .badge-origem { padding:3px 10px; border-radius:20px; color:#fff; font-size:11px; font-weight:bold; }
      .badge-ONLINE { background:#0d6efd; }
      .badge-COMANDA { background:#28a745; }
      .badge-AVULSA { background:#ff6b00; }
      .vend-cliente { font-weight:bold; color:#333; font-size:15px; }
      .vend-id { color:#888; font-size:12px; margin-left:6px; }
      .vend-hora { color:#888; font-size:12px; }
      .vend-itens { color:#666; font-size:13px; margin:6px 0; }
      .vend-end { color:#0d6efd; font-size:12px; margin-bottom:6px; }
      .vend-valores { display:flex; gap:10px; flex-wrap:wrap; align-items:center; font-size:13px; color:#555; }
      .vend-valores b.total { color:#28a745; font-size:16px; }
      .btn-mini { display:inline-block; padding:4px 10px; border-radius:6px; text-decoration:none; font-size:12px; font-weight:bold; color:#fff; }
      .btn-mini.etiqueta { background:#17a2b8; }
      .btn-mini.ver { background:#6f42c1; }
      .toast { position:fixed; top:20px; left:50%; transform:translateX(-50%) translateY(-90px); background:#198754; color:#fff; padding:14px 28px; border-radius:12px; font-weight:bold; box-shadow:0 6px 20px rgba(0,0,0,.25); z-index:2000; transition:transform .35s ease; }
      .toast.visivel { transform:translateX(-50%) translateY(0); }
      .link-pedidos { display:inline-block; margin-bottom:15px; padding:10px 16px; background:#f3e8ff; color:#6f42c1; border-radius:8px; text-decoration:none; font-weight:bold; font-size:14px; }
      @media (max-width:760px) {
        .form-grid { grid-template-columns:1fr; }
        .va-item { grid-template-columns:1fr 56px 96px 36px; }
        .va-nome { grid-column:1 / -1; }
        .va-sub { display:none; }
      }
    </style>

    <h1 style="margin-bottom:20px; color:#333; font-size:22px;">💵 Vendas Avulsas + Histórico Geral</h1>

    <div class="box">
      <h3>➕ Registrar Venda Avulsa (balcão / telefone / WhatsApp)</h3>
      <p style="color:#666; font-size:14px; margin-bottom:15px;">
        Cada venda avulsa é salva como um <b>pedido</b> no sistema (com etiqueta e entrega) e aparece também na página
        <a href="/pedidos?filtro=PAGO" style="color:#ff6b00; font-weight:bold;">Pedidos</a>.
      </p>
      <form id="formVenda">
        <div class="secao-titulo">Cliente</div>
        <div class="form-grid">
          <div class="form-group"><label>Nome do cliente *</label><input type="text" id="vNome" required placeholder="Ex: Maria Silva"></div>
          <div class="form-group"><label>Telefone</label><input type="tel" id="vTel" placeholder="(19) 99999-9999" inputmode="numeric"></div>
          <div class="form-group">
            <label>Tipo</label>
            <select id="vTipo">
              <option value="BALCAO">🏪 Balcão</option>
              <option value="ENTREGA">🛵 Entrega</option>
              <option value="RETIRADA">🛍️ Retirada</option>
            </select>
          </div>
          <div class="form-group">
            <label>Pagamento</label>
            <select id="vPag">
              <option value="DINHEIRO">💵 Dinheiro</option>
              <option value="PIX">💠 PIX</option>
              <option value="CARTAO_CREDITO">💳 Crédito</option>
              <option value="CARTAO_DEBITO">💳 Débito</option>
            </select>
          </div>
          <div class="form-group"><label>Data da venda</label><input type="date" id="vData"></div>
          <div class="form-group"><label>Taxa de entrega (R$)</label><input type="number" step="0.01" min="0" id="vTaxa" value="0"></div>
        </div>

        <div class="secao-titulo">Endereço de entrega (opcional)</div>
        <div class="form-grid">
          <div class="form-group"><label>Endereço</label><input type="text" id="vEnd" placeholder="Rua / avenida"></div>
          <div class="form-group"><label>Número</label><input type="text" id="vNum" placeholder="123" inputmode="numeric"></div>
          <div class="form-group"><label>Bairro</label><input type="text" id="vBairro" placeholder="Centro"></div>
          <div class="form-group"><label>Cidade</label><input type="text" id="vCidade" placeholder="Hortolândia"></div>
        </div>

        <div class="secao-titulo">Itens vendidos</div>
        <div class="form-group">
          <div id="vaItens"></div>
          <button type="button" class="btn-add-item" onclick="addLinhaItem()">+ Adicionar item</button>
        </div>

        <div class="totais-linha"><span>Subtotal</span><span id="vSubtotal">R$ 0,00</span></div>
        <div class="totais-linha"><span>Entrega</span><span id="vTaxaShow">R$ 0,00</span></div>
        <div class="totais-linha total"><span>TOTAL</span><span id="vTotal">R$ 0,00</span></div>

        <div class="form-group" style="margin-top:12px;"><label>Observação</label><textarea id="vObs" rows="2" placeholder="Anotações opcionais..."></textarea></div>

        <button type="submit" class="btn-salvar">💾 Salvar Venda (lança ENTRADA no financeiro)</button>
      </form>
    </div>

    <div class="box">
      <h3>📜 Histórico de Vendas (online + comandas + avulsas)</h3>
      <form class="filtros" id="formFiltro">
        <div><label>Data início</label><input type="date" id="fInicio"></div>
        <div><label>Data fim</label><input type="date" id="fFim"></div>
        <button class="btn-filtrar" type="submit">🔍 Filtrar</button>
      </form>
      <div id="histArea"><p style="color:#888; text-align:center; padding:20px;">Carregando...</p></div>
    </div>

    <div id="toastVendas" class="toast"></div>

    <script>
      var PRODUTOS = ${produtosJson};

      function brl(v) { return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ','); }
      function dataBr(d) {
        if (!d) return '-';
        var p = String(d).split('-');
        if (p.length !== 3) return String(d);
        return p[2] + '/' + p[1] + '/' + p[0];
      }
      function escHtml(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      }
      function mostrarToast(msg) {
        var t = document.getElementById('toastVendas');
        t.textContent = msg;
        t.classList.add('visivel');
        setTimeout(function () { t.classList.remove('visivel'); }, 4000);
      }
      function hojeISO() { return new Date().toISOString().slice(0, 10); }
      function inicioMesISO() { return hojeISO().slice(0, 8) + '01'; }

      // ---------- Máscara de telefone ----------
      function formatarTel(v) {
        var n = String(v || '').replace(/\\D/g, '').slice(0, 11);
        if (n.length === 11) return '(' + n.slice(0,2) + ') ' + n.slice(2,7) + '-' + n.slice(7);
        if (n.length === 10) return '(' + n.slice(0,2) + ') ' + n.slice(2,6) + '-' + n.slice(6);
        if (n.length > 6) return '(' + n.slice(0,2) + ') ' + n.slice(2,6) + '-' + n.slice(6);
        if (n.length > 2) return '(' + n.slice(0,2) + ') ' + n.slice(2);
        return n;
      }
      document.getElementById('vTel').addEventListener('input', function (e) {
        e.target.value = formatarTel(e.target.value);
      });

      // ---------- Linhas de itens (com select de produtos) ----------
      function addLinhaItem() {
        var div = document.createElement('div');
        div.className = 'va-item';
        var opts = '<option value="">✏️ Item personalizado</option>';
        PRODUTOS.forEach(function (p) {
          opts += '<option value="' + p.id + '" data-preco="' + p.preco + '" data-nome="' + escHtml(p.nome) + '">' + escHtml(p.nome) + ' - ' + brl(p.preco) + '</option>';
        });
        div.innerHTML =
          '<select class="va-prod">' + opts + '</select>' +
          '<input type="text" class="va-nome" placeholder="Nome do item (se personalizado)">' +
          '<input type="number" class="va-qtd" min="1" value="1">' +
          '<input type="number" class="va-preco" step="0.01" min="0" placeholder="0,00">' +
          '<span class="va-sub">R$ 0,00</span>' +
          '<button type="button" class="va-rm">✕</button>';
        document.getElementById('vaItens').appendChild(div);
        recalcular();
      }

      document.getElementById('vaItens').addEventListener('change', function (e) {
        if (!e.target.classList.contains('va-prod')) return;
        var row = e.target.closest('.va-item');
        var opt = e.target.selectedOptions[0];
        var nomeInput = row.querySelector('.va-nome');
        var precoInput = row.querySelector('.va-preco');
        if (e.target.value) {
          nomeInput.value = opt.getAttribute('data-nome') || '';
          nomeInput.readOnly = true;
          precoInput.value = opt.getAttribute('data-preco') || '';
        } else {
          nomeInput.value = '';
          nomeInput.readOnly = false;
          precoInput.value = '';
        }
        recalcular();
      });

      document.getElementById('vaItens').addEventListener('click', function (e) {
        if (e.target.classList.contains('va-rm')) {
          e.target.closest('.va-item').remove();
          recalcular();
        }
      });

      function recalcular() {
        var linhas = document.querySelectorAll('#vaItens .va-item');
        var subtotal = 0;
        linhas.forEach(function (l) {
          var q = Number(l.querySelector('.va-qtd').value) || 0;
          var p = Number(l.querySelector('.va-preco').value) || 0;
          var sub = q * p;
          l.querySelector('.va-sub').textContent = brl(sub);
          subtotal += sub;
        });
        var taxa = Number(document.getElementById('vTaxa').value) || 0;
        document.getElementById('vSubtotal').textContent = brl(subtotal);
        document.getElementById('vTaxaShow').textContent = brl(taxa);
        document.getElementById('vTotal').textContent = brl(subtotal + taxa);
      }

      document.getElementById('vaItens').addEventListener('input', recalcular);
      document.getElementById('vTaxa').addEventListener('input', recalcular);

      // ---------- Salvar venda ----------
      document.getElementById('formVenda').addEventListener('submit', function (e) {
        e.preventDefault();
        var itens = [];
        document.querySelectorAll('#vaItens .va-item').forEach(function (l) {
          var nome = l.querySelector('.va-nome').value.trim();
          var qtd = Number(l.querySelector('.va-qtd').value) || 1;
          var preco = Number(l.querySelector('.va-preco').value) || 0;
          if (nome && preco > 0) itens.push({ nome: nome, quantidade: qtd, preco_unitario: preco });
        });
        var body = {
          cliente_nome: document.getElementById('vNome').value.trim(),
          cliente_telefone: document.getElementById('vTel').value.trim(),
          tipo_pedido: document.getElementById('vTipo').value,
          pagamento: document.getElementById('vPag').value,
          data_venda: document.getElementById('vData').value || hojeISO(),
          taxa_entrega: Number(document.getElementById('vTaxa').value) || 0,
          endereco: document.getElementById('vEnd').value.trim(),
          numero: document.getElementById('vNum').value.trim(),
          bairro: document.getElementById('vBairro').value.trim(),
          cidade: document.getElementById('vCidade').value.trim(),
          observacao: document.getElementById('vObs').value.trim(),
          itens: itens
        };
        if (!body.cliente_nome) return alert('Informe o nome do cliente.');
        if (!itens.length) return alert('Adicione pelo menos um item com nome e preço.');

        fetch('/api/vendas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }).then(function (r) { return r.json(); }).then(function (d) {
          if (!d.sucesso) throw new Error(d.erro || 'Erro ao salvar');
          var msg = '✅ Venda de ' + brl(d.total) + ' salva!';
          if (d.pedido_id) msg += ' Pedido #' + d.pedido_id + ' criado (veja em /pedidos).';
          mostrarToast(msg);
          document.getElementById('formVenda').reset();
          document.getElementById('vData').value = hojeISO();
          document.getElementById('vaItens').innerHTML = '';
          addLinhaItem();
          recalcular();
          carregarHistorico();
        }).catch(function (e) { alert(e.message); });
      });

      // ---------- Histórico ----------
      function carregarHistorico() {
        var ini = document.getElementById('fInicio').value || inicioMesISO();
        var fim = document.getElementById('fFim').value || hojeISO();
        var area = document.getElementById('histArea');
        area.innerHTML = '<p style="color:#888; text-align:center; padding:20px;">Carregando...</p>';
        fetch('/api/vendas/historico?data_inicio=' + ini + '&data_fim=' + fim)
          .then(function (r) { return r.json(); })
          .then(function (d) {
            var linhas = d.linhas || [];
            if (!linhas.length) {
              area.innerHTML = '<p style="color:#888; text-align:center; padding:20px;">Nenhuma venda neste período.</p>';
              return;
            }
            var grupos = {};
            linhas.forEach(function (l) { (grupos[l.data] = grupos[l.data] || []).push(l); });
            var datas = Object.keys(grupos).sort().reverse();
            var html = '';
            datas.forEach(function (dt) {
              var g = grupos[dt];
              var somaDia = g.reduce(function (s, l) { return s + (Number(l.total) || 0); }, 0);
              html += '<div class="dia-grupo">';
              html += '<div class="dia-titulo"><span>📅 ' + dataBr(dt) + ' · ' + g.length + ' venda(s)</span><span class="dia-total">' + brl(somaDia) + '</span></div>';
              g.forEach(function (l) {
                html += '<div class="vend-linha">';
                html += '<div class="vend-topo">';
                html += '<span class="vend-cliente">' + escHtml(l.cliente) + (l.pedido_id ? '<span class="vend-id">#' + l.pedido_id + '</span>' : '') + '</span>';
                html += '<span><span class="badge-origem badge-' + l.origem + '">' + (l.origem === 'ONLINE' ? '🛵 ONLINE' : l.origem === 'COMANDA' ? '🍽️ COMANDA' : '💵 AVULSA') + '</span> <span class="vend-hora">' + (l.hora || '') + '</span></span>';
                html += '</div>';
                if (l.itens) html += '<div class="vend-itens">' + escHtml(l.itens) + '</div>';
                if (l.endereco) html += '<div class="vend-end">📍 ' + escHtml(l.endereco) + '</div>';
                html += '<div class="vend-valores">';
                if (l.pedido_id) {
                  html += '<a href="/pedidos/detalhes/' + l.pedido_id + '" class="btn-mini ver">👁️ Ver pedido</a>';
                  html += '<a href="/pedidos/imprimir/' + l.pedido_id + '" target="_blank" class="btn-mini etiqueta">🖨️ Etiqueta</a>';
                }
                html += '<span>Pagto: <b>' + escHtml(l.pagamento) + '</b></span>';
                html += '<span>Entrega: <b>' + (Number(l.taxa) > 0 ? brl(l.taxa) : '—') + '</b></span>';
                html += '<span class="total">Total: ' + brl(l.total) + '</span>';
                html += '</div></div>';
              });
              html += '</div>';
            });
            area.innerHTML = html;
          })
          .catch(function (e) {
            area.innerHTML = '<p style="color:#dc3545; text-align:center;">Erro: ' + e.message + '</p>';
          });
      }

      document.getElementById('formFiltro').addEventListener('submit', function (e) {
        e.preventDefault();
        carregarHistorico();
      });

      // Init
      document.getElementById('vData').value = hojeISO();
      document.getElementById('fInicio').value = inicioMesISO();
      document.getElementById('fFim').value = hojeISO();
      addLinhaItem();
      recalcular();
      carregarHistorico();
    </script>
  `

  return c.html(renderLayout('Vendas Avulsas', conteudo, 'vendas'))
})

export default app