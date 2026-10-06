import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

const brl = (v: number) => (v || 0).toFixed(2).replace('.', ',')
const dataBr = (d: string) => {
  if (!d) return '-'
  const [a, m, dia] = d.split('-')
  return `${dia}/${m}/${a}`
}

app.get('/', async (c) => {
  const agora = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const padraoInicio = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-01`
  const padraoFim = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate())}`

  const dataInicio = c.req.query('data_inicio') || padraoInicio
  const dataFim = c.req.query('data_fim') || padraoFim
  const tipo = c.req.query('tipo') || ''

  let where = 'WHERE data_movimento BETWEEN ? AND ?'
  const params: any[] = [dataInicio, dataFim]
  if (tipo) { where += ' AND tipo = ?'; params.push(tipo) }

  const movimentos = await c.env.DB.prepare(`
    SELECT * FROM financeiro ${where} ORDER BY data_movimento DESC, id DESC
  `).bind(...params).all()

  const res = await c.env.DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN valor ELSE 0 END), 0) AS entradas,
      COALESCE(SUM(CASE WHEN tipo = 'SAIDA' THEN valor ELSE 0 END), 0) AS saidas
    FROM financeiro
    WHERE data_movimento BETWEEN ? AND ?
  `).bind(dataInicio, dataFim).first() as any

  const entradas = res?.entradas || 0
  const saidas = res?.saidas || 0
  const saldo = entradas - saidas

  const porCategoria = await c.env.DB.prepare(`
    SELECT categoria, SUM(valor) AS total
    FROM financeiro
    WHERE tipo = 'SAIDA' AND data_movimento BETWEEN ? AND ?
    GROUP BY categoria ORDER BY total DESC
  `).bind(dataInicio, dataFim).all() as any
  const maxCat = porCategoria.results.length ? porCategoria.results[0].total : 1

  const conteudo = `
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>

    <style>
      .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:18px; margin-bottom:25px; }
      .card { background:#fff; border-radius:15px; padding:20px; box-shadow:0 3px 15px rgba(0,0,0,.08); }
      .card h3 { margin:0; font-size:26px; }
      .card p { margin:5px 0 0; color:#777; font-size:13px; }
      .card.entrada h3 { color:#28a745; }
      .card.saida h3 { color:#dc3545; }
      .card.saldo h3 { color:${saldo >= 0 ? '#ff6b00' : '#dc3545'}; }
      .box { background:#fff; border-radius:15px; padding:20px 25px; box-shadow:0 3px 15px rgba(0,0,0,.08); margin-bottom:20px; }
      .box h3 { margin:0 0 15px; color:#333; font-size:17px; }
      .filtros { display:flex; gap:10px; flex-wrap:wrap; align-items:end; }
      .filtros label { display:block; font-size:13px; color:#555; font-weight:bold; margin-bottom:4px; }
      .filtros input, .filtros select { padding:10px; border:1px solid #ddd; border-radius:8px; }
      .btn-filtrar { background:#ff6b00; color:#fff; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:bold; }
      .btn-pdf { border:none; padding:10px 16px; border-radius:8px; cursor:pointer; font-weight:bold; font-size:13px; color:#fff; }
      .btn-pdf-entrada { background:#28a745; }
      .btn-pdf-saida { background:#dc3545; }
      .btn-pdf-ambos { background:#0d6efd; }
      .form-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:15px; }
      .form-group { margin-bottom:15px; }
      .form-group label { display:block; margin-bottom:5px; font-weight:bold; color:#555; }
      .form-group input, .form-group select, .form-group textarea { width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; }
      .btn-salvar { background:#198754; color:#fff; border:none; padding:12px 20px; border-radius:8px; cursor:pointer; font-weight:bold; }
      table { width:100%; border-collapse:collapse; }
      th, td { padding:11px 10px; text-align:left; border-bottom:1px solid #eee; font-size:14px; }
      th { background:#f8f9fa; color:#495057; font-size:12px; text-transform:uppercase; }
      tr:hover { background:#f9f9f9; }
      .pill { padding:4px 10px; border-radius:20px; font-size:11px; font-weight:bold; color:#fff; }
      .pill.entrada { background:#28a745; }
      .pill.saida { background:#dc3545; }
      .valor-entrada { color:#28a745; font-weight:bold; }
      .valor-saida { color:#dc3545; font-weight:bold; }
      .btn-excluir { background:#dc3545; color:#fff; padding:6px 10px; border-radius:5px; text-decoration:none; font-size:12px; }
      .btn-ver { background:#0d6efd; color:#fff; padding:6px 10px; border-radius:5px; text-decoration:none; font-size:12px; border:none; cursor:pointer; margin-right:4px; }
      .barra-item { margin-bottom:12px; }
      .barra-item .linha { display:flex; justify-content:space-between; font-size:14px; margin-bottom:5px; color:#444; }
      .barra-item .trilho { background:#f0f0f0; border-radius:10px; height:10px; overflow:hidden; }
      .barra-item .preenchimento { background:#dc3545; height:100%; border-radius:10px; }
      .duas-colunas { display:grid; grid-template-columns:2fr 1fr; gap:20px; }
      .pdf-actions { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px; }
      .toast { position:fixed; top:20px; left:50%; transform:translateX(-50%) translateY(-90px); background:#0d6efd; color:#fff; padding:14px 28px; border-radius:12px; font-weight:bold; box-shadow:0 6px 20px rgba(0,0,0,.25); z-index:3000; transition:transform .35s ease; }
      .toast.visivel { transform:translateX(-50%) translateY(0); }
      .modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:2000; justify-content:center; align-items:flex-start; padding:40px 15px; overflow-y:auto; }
      .modal-overlay.aberto { display:flex; }
      .modal-box { background:#fff; border-radius:16px; width:100%; max-width:640px; box-shadow:0 10px 40px rgba(0,0,0,.3); animation:modalIn .25s ease; }
      @keyframes modalIn { from { transform:translateY(-25px); opacity:0; } to { transform:translateY(0); opacity:1; } }
      .modal-header { display:flex; justify-content:space-between; align-items:center; padding:18px 22px; border-bottom:1px solid #eee; }
      .modal-header h3 { margin:0; color:#333; font-size:18px; }
      .modal-x { background:#f1f1f1; border:none; width:34px; height:34px; border-radius:50%; font-size:15px; cursor:pointer; color:#555; }
      .modal-x:hover { background:#e2e2e2; }
      .modal-body { padding:22px; }
      .detail-row { display:flex; padding:10px 0; border-bottom:1px solid #f0f0f0; }
      .detail-label { flex:0 0 140px; font-weight:bold; color:#555; font-size:13px; }
      .detail-value { flex:1; color:#333; font-size:14px; }
      .badge-tipo { display:inline-block; padding:4px 12px; border-radius:20px; color:#fff; font-size:12px; font-weight:bold; }
      .tabela-itens { width:100%; border-collapse:collapse; font-size:13px; }
      .tabela-itens th { background:#f8f9fa; padding:8px; text-align:left; font-size:11px; text-transform:uppercase; color:#555; }
      .tabela-itens td { padding:8px; border-bottom:1px solid #eee; }
      @media (max-width: 900px) { .duas-colunas { grid-template-columns:1fr; } }
    </style>

    <h1 style="margin-bottom:25px; color:#333;">💰 Financeiro</h1>

    <div class="cards">
      <div class="card entrada"><h3>+ R$ ${brl(entradas)}</h3><p>Entradas no período</p></div>
      <div class="card saida"><h3>- R$ ${brl(saidas)}</h3><p>Saídas no período</p></div>
      <div class="card saldo"><h3>R$ ${brl(saldo)}</h3><p>Saldo do período</p></div>
    </div>

    <div class="box">
      <h3>🔍 Filtrar Período</h3>
      <form method="GET" class="filtros">
        <div><label>Data Início</label><input type="date" name="data_inicio" value="${dataInicio}"></div>
        <div><label>Data Fim</label><input type="date" name="data_fim" value="${dataFim}"></div>
        <div>
          <label>Tipo</label>
          <select name="tipo">
            <option value="">Todos</option>
            <option value="ENTRADA" ${tipo === 'ENTRADA' ? 'selected' : ''}>Entradas</option>
            <option value="SAIDA" ${tipo === 'SAIDA' ? 'selected' : ''}>Saídas</option>
          </select>
        </div>
        <button class="btn-filtrar" type="submit">Filtrar</button>
      </form>
    </div>

    <div class="box">
      <h3>📄 Relatórios em PDF (para o contador)</h3>
      <p style="color:#666; font-size:14px; margin-bottom:15px;">
        Os PDFs de <b>Saídas</b> e <b>Completo</b> incluem o <b>detalhamento das notas fiscais</b>: dados do fornecedor (CNPJ, endereço, nº da nota) e a lista legível de todos os itens comprados.
      </p>
      <div class="pdf-actions">
        <button class="btn-pdf btn-pdf-entrada" onclick="gerarPDF('ENTRADA')">📄 PDF Entradas (Vendas)</button>
        <button class="btn-pdf btn-pdf-saida" onclick="gerarPDF('SAIDA')">📄 PDF Saídas + Notas</button>
        <button class="btn-pdf btn-pdf-ambos" onclick="gerarPDF(null)">📄 PDF Completo (Ambos)</button>
      </div>
    </div>

    <div class="box">
      <h3>➕ Novo Lançamento</h3>
      <form method="POST" action="/api/financeiro">
        <div class="form-grid">
          <div class="form-group">
            <label>Tipo</label>
            <select name="tipo" required>
              <option value="ENTRADA">💵 Entrada</option>
              <option value="SAIDA">💸 Saída</option>
            </select>
          </div>
          <div class="form-group"><label>Descrição</label><input type="text" name="descricao" placeholder="Ex: Venda balcão, Compra de carne..." required></div>
          <div class="form-group"><label>Valor (R$)</label><input type="number" step="0.01" min="0.01" name="valor" required></div>
          <div class="form-group"><label>Data</label><input type="date" name="data_movimento" value="${new Date().toISOString().slice(0, 10)}" required></div>
          <div class="form-group">
            <label>Forma de Pagamento</label>
            <select name="forma_pagamento">
              <option value="">Selecione...</option>
              <option value="PIX">PIX</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="CARTAO_CREDITO">Cartão de Crédito</option>
              <option value="CARTAO_DEBITO">Cartão de Débito</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>
          <div class="form-group">
            <label>Categoria</label>
            <select name="categoria">
              <option value="">Selecione...</option>
              <option value="VENDAS">Vendas</option>
              <option value="INSUMOS">Insumos / Mercadoria</option>
              <option value="EMBALAGENS">Embalagens</option>
              <option value="ALUGUEL">Aluguel</option>
              <option value="SALARIOS">Salários</option>
              <option value="MARKETING">Marketing</option>
              <option value="TAXAS">Taxas / Comissões</option>
              <option value="OUTROS">Outros</option>
            </select>
          </div>
        </div>
        <div class="form-group"><label>Observação</label><textarea name="observacao" rows="2" placeholder="Anotações opcionais..."></textarea></div>
        <button type="submit" class="btn-salvar">💾 Lançar Movimentação</button>
      </form>
    </div>

    <div class="duas-colunas">
      <div class="box">
        <h3>📋 Movimentações do Período (${(movimentos.results as any[]).length})</h3>
        ${(movimentos.results as any[]).length === 0 ? `
          <p style="text-align:center; color:#888; padding:20px;">Nenhuma movimentação neste período.</p>
        ` : `
          <table>
            <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th><th></th></tr>
            ${(movimentos.results as any[]).map((m: any) => `
              <tr>
                <td>${dataBr(m.data_movimento)}</td>
                <td><strong>${m.descricao}</strong></td>
                <td>${m.categoria || '-'}</td>
                <td><span class="pill ${m.tipo === 'ENTRADA' ? 'entrada' : 'saida'}">${m.tipo === 'ENTRADA' ? 'ENTRADA' : 'SAÍDA'}</span></td>
                <td class="${m.tipo === 'ENTRADA' ? 'valor-entrada' : 'valor-saida'}">${m.tipo === 'ENTRADA' ? '+' : '-'} R$ ${brl(m.valor)}</td>
                <td>
                  <button class="btn-ver" onclick="verDetalhes(${m.id})" title="Ver nota completa">👁️ Ver</button>
                  <a href="/api/financeiro/excluir/${m.id}" class="btn-excluir" onclick="return confirm('Excluir esta movimentação?')">🗑️</a>
                </td>
              </tr>
            `).join('')}
          </table>
        `}
      </div>

      <div class="box">
        <h3>📊 Gastos por Categoria</h3>
        ${porCategoria.results.length === 0 ? `
          <p style="color:#888;">Nenhuma saída no período.</p>
        ` : `
          ${porCategoria.results.map((cat: any) => `
            <div class="barra-item">
              <div class="linha"><span>${cat.categoria || 'Sem categoria'}</span><strong>R$ ${brl(cat.total)}</strong></div>
              <div class="trilho"><div class="preenchimento" style="width:${Math.round((cat.total / maxCat) * 100)}%"></div></div>
            </div>
          `).join('')}
        `}
      </div>
    </div>

    <div id="modalDetalhes" class="modal-overlay">
      <div class="modal-box">
        <div class="modal-header">
          <h3>📋 Detalhes da Movimentação</h3>
          <button class="modal-x" onclick="fecharModal()">✕</button>
        </div>
        <div class="modal-body" id="modalConteudo">
          <p style="text-align:center; color:#888;">Carregando...</p>
        </div>
      </div>
    </div>

    <div id="toastFin" class="toast"></div>

    <script>
      var dadosPeriodo = {
        dataInicio: '${dataInicio}',
        dataFim: '${dataFim}',
        entradas: ${entradas},
        saidas: ${saidas},
        saldo: ${saldo}
      };

      function escHtml(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      }
      function brl(v) { return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ','); }
      function dataBr(d) {
        if (!d) return '-';
        var p = String(d).split('-');
        if (p.length !== 3) return String(d);
        return p[2] + '/' + p[1] + '/' + p[0];
      }
      function formatarCNPJ(v) {
        var n = String(v || '').replace(/\D/g, '').slice(0, 14);
        return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
      }
      // "0.31x TOMATE ITALIANO KG = R$ 4.00" -> { qtd, nome, valor }
      function parseItemNota(s) {
        var m = String(s).match(/^([0-9.,]+)\s*x\s*(.*)=\s*R\$\s*([0-9.,]+)\s*$/i);
        if (m) return { qtd: m[1], nome: m[2].trim(), valor: 'R$ ' + m[3] };
        return { qtd: '', nome: String(s), valor: '' };
      }
      function mostrarToast(msg) {
        var t = document.getElementById('toastFin');
        t.textContent = msg;
        t.classList.add('visivel');
        setTimeout(function () { t.classList.remove('visivel'); }, 3500);
      }

      // ---------- MODAL DE DETALHES (LEGÍVEL) ----------
      function verDetalhes(id) {
        var modal = document.getElementById('modalDetalhes');
        var body = document.getElementById('modalConteudo');
        body.innerHTML = '<p style="text-align:center; color:#888;">Carregando...</p>';
        modal.classList.add('aberto');
        fetch('/api/financeiro/' + id)
          .then(function (r) { return r.json(); })
          .then(function (m) {
            var tipoBadge = m.tipo === 'ENTRADA'
              ? '<span class="badge-tipo" style="background:#28a745;">ENTRADA</span>'
              : '<span class="badge-tipo" style="background:#dc3545;">SAÍDA</span>';
            var html = '';
            html += '<div class="detail-row"><div class="detail-label">ID</div><div class="detail-value">#' + m.id + '</div></div>';
            html += '<div class="detail-row"><div class="detail-label">Tipo</div><div class="detail-value">' + tipoBadge + '</div></div>';
            html += '<div class="detail-row"><div class="detail-label">Descrição</div><div class="detail-value"><strong>' + escHtml(m.descricao) + '</strong></div></div>';
            html += '<div class="detail-row"><div class="detail-label">Valor</div><div class="detail-value" style="font-size:18px; font-weight:bold; color:' + (m.tipo === 'ENTRADA' ? '#28a745' : '#dc3545') + ';">' + (m.tipo === 'ENTRADA' ? '+' : '-') + ' ' + brl(m.valor) + '</div></div>';
            html += '<div class="detail-row"><div class="detail-label">Data</div><div class="detail-value">' + dataBr(m.data_movimento) + '</div></div>';
            html += '<div class="detail-row"><div class="detail-label">Categoria</div><div class="detail-value">' + escHtml(m.categoria || '-') + '</div></div>';
            html += '<div class="detail-row"><div class="detail-label">Pagamento</div><div class="detail-value">' + escHtml(m.forma_pagamento || '-') + '</div></div>';

            if (m.observacao) {
              var d = null;
              try { d = JSON.parse(m.observacao); } catch (e) { d = null; }

              if (d && d.fornecedor) {
                var f = d.fornecedor;
                html += '<div style="margin-top:18px;"><div class="detail-label" style="margin-bottom:10px;">🏪 Dados do Fornecedor</div>';
                html += '<div style="background:#fff5ec; padding:16px; border-radius:10px; border-left:4px solid #ff6b00;">';
                if (f.nome_comercio) html += '<div style="margin-bottom:8px; font-size:15px;"><strong>🏬 ' + escHtml(f.nome_comercio) + '</strong></div>';
                if (f.cnpj) html += '<div style="margin-bottom:6px; font-size:13px;"><strong>📄 CNPJ:</strong> ' + formatarCNPJ(f.cnpj) + '</div>';
                if (f.endereco) html += '<div style="margin-bottom:6px; font-size:13px;"><strong>📍 Endereço:</strong> ' + escHtml(f.endereco) + '</div>';
                if (f.telefone) html += '<div style="margin-bottom:6px; font-size:13px;"><strong>📞 Telefone:</strong> ' + escHtml(f.telefone) + '</div>';
                if (f.numero_nota) html += '<div style="margin-bottom:6px; font-size:13px;"><strong>🧾 Nº da Nota:</strong> ' + escHtml(f.numero_nota) + '</div>';
                if (f.data_emissao) html += '<div style="font-size:13px;"><strong>📅 Emissão:</strong> ' + dataBr(f.data_emissao) + '</div>';
                html += '</div></div>';
              }

              var itens = (d && Array.isArray(d.itens)) ? d.itens : null;
              if (itens && itens.length) {
                html += '<div style="margin-top:18px;"><div class="detail-label" style="margin-bottom:10px;">📦 Itens da Nota (' + itens.length + ')</div>';
                html += '<table class="tabela-itens">';
                html += '<tr><th style="width:60px;">Qtd</th><th>Produto</th><th style="width:90px; text-align:right;">Valor</th></tr>';
                for (var k = 0; k < itens.length; k++) {
                  var p = parseItemNota(itens[k]);
                  html += '<tr><td>' + escHtml(p.qtd) + '</td><td>' + escHtml(p.nome) + '</td><td style="text-align:right; font-weight:bold;">' + escHtml(p.valor) + '</td></tr>';
                }
                html += '<tr><td colspan="2" style="text-align:right; font-weight:bold; padding-top:10px;">Total da nota:</td><td style="text-align:right; font-weight:bold; color:#dc3545; padding-top:10px;">' + brl(m.valor) + '</td></tr>';
                html += '</table></div>';
              } else if (!d) {
                html += '<div style="margin-top:15px;"><div class="detail-label" style="margin-bottom:8px;">📝 Observações</div><div style="background:#f8f9fa; padding:12px; border-radius:8px; font-size:13px; white-space:pre-wrap;">' + escHtml(m.observacao) + '</div></div>';
              }
            }
            body.innerHTML = html;
          })
          .catch(function (e) {
            body.innerHTML = '<p style="color:#dc3545; text-align:center;">Erro ao carregar: ' + e.message + '</p>';
          });
      }

      function fecharModal() {
        document.getElementById('modalDetalhes').classList.remove('aberto');
      }
      document.getElementById('modalDetalhes').addEventListener('click', function (e) {
        if (e.target.id === 'modalDetalhes') fecharModal();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') fecharModal();
      });

      // ---------- GERAR PDF COM DETALHAMENTO DAS NOTAS ----------
      async function gerarPDF(filtroTipo) {
        mostrarToast('⏳ Gerando PDF...');
        try {
          var url = '/api/financeiro?data_inicio=' + dadosPeriodo.dataInicio + '&data_fim=' + dadosPeriodo.dataFim;
          if (filtroTipo) url += '&tipo=' + filtroTipo;
          var r = await fetch(url);
          var movs = await r.json();
          if (!movs.length) { alert('Nenhuma movimentação no período selecionado.'); return; }

          var doc = new window.jspdf.jsPDF();
          var titulo = 'Relatório Financeiro';
          if (filtroTipo === 'ENTRADA') titulo = 'Relatório de Entradas (Vendas)';
          else if (filtroTipo === 'SAIDA') titulo = 'Relatório de Saídas (Despesas)';

          // Cabeçalho
          doc.setFillColor(255, 107, 0);
          doc.rect(0, 0, 210, 25, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(18); doc.setFont('helvetica', 'bold');
          doc.text('CHEF DA BRASA', 14, 12);
          doc.setFontSize(10); doc.setFont('helvetica', 'normal');
          doc.text(titulo, 14, 19);
          doc.text('Emitido em: ' + new Date().toLocaleString('pt-BR'), 196, 12, { align: 'right' });

          doc.setTextColor(50, 50, 50); doc.setFontSize(11);
          doc.text('Período: ' + dataBr(dadosPeriodo.dataInicio) + ' a ' + dataBr(dadosPeriodo.dataFim), 14, 35);
          doc.text('Total Entradas: ' + brl(dadosPeriodo.entradas), 14, 42);
          doc.text('Total Saídas: ' + brl(dadosPeriodo.saidas), 14, 48);
          doc.setFont('helvetica', 'bold');
          doc.text('Saldo: ' + brl(dadosPeriodo.saldo), 14, 54);
          doc.setFont('helvetica', 'normal');

          // Tabela principal
          var corpo = movs.map(function (m) {
            return [
              dataBr(m.data_movimento),
              (m.descricao || '').substring(0, 45),
              m.categoria || '-',
              m.forma_pagamento || '-',
              (m.tipo === 'ENTRADA' ? '+' : '-') + ' ' + brl(m.valor)
            ];
          });
          doc.autoTable({
            startY: 62,
            head: [['Data', 'Descrição', 'Categoria', 'Pagamento', 'Valor']],
            body: corpo,
            headStyles: { fillColor: [52, 58, 64], textColor: 255, fontSize: 10 },
            bodyStyles: { fontSize: 9 },
            alternateRowStyles: { fillColor: [248, 249, 250] },
            columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 65 }, 2: { cellWidth: 30 }, 3: { cellWidth: 30 }, 4: { cellWidth: 30, halign: 'right' } }
          });

          var totalLinhas = movs.reduce(function (s, m) { return s + Number(m.valor || 0); }, 0);
          var y = doc.lastAutoTable.finalY + 8;
          doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
          var labelTotal = 'Total do relatório';
          if (filtroTipo === 'ENTRADA') labelTotal = 'Total de Entradas';
          else if (filtroTipo === 'SAIDA') labelTotal = 'Total de Saídas';
          doc.text(labelTotal + ': ' + brl(totalLinhas), 196, y, { align: 'right' });

          // ===== DETALHAMENTO DAS NOTAS FISCAIS (para o contador) =====
          if (filtroTipo !== 'ENTRADA') {
            var notas = [];
            movs.forEach(function (m) {
              if (m.tipo !== 'SAIDA' || !m.observacao) return;
              var d = null;
              try { d = JSON.parse(m.observacao); } catch (e) { d = null; }
              if (d && (d.fornecedor || d.itens)) notas.push({ mov: m, d: d });
            });

            if (notas.length) {
              y += 12;
              if (y > 240) { doc.addPage(); y = 20; }
              doc.setFontSize(14); doc.setFont('helvetica', 'bold');
              doc.setTextColor(255, 107, 0);
              doc.text('DETALHAMENTO DAS NOTAS FISCAIS', 14, y);
              y += 8;

              for (var n = 0; n < notas.length; n++) {
                var nota = notas[n];
                var f = nota.d.fornecedor || {};
                if (y > 230) { doc.addPage(); y = 20; }

                doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
                doc.text('Fornecedor: ' + (f.nome_comercio || nota.mov.descricao || '-'), 14, y); y += 5;
                doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 90, 90);
                if (f.cnpj) { doc.text('CNPJ: ' + formatarCNPJ(f.cnpj), 14, y); y += 4.5; }
                if (f.endereco) { doc.text('Endereco: ' + f.endereco, 14, y); y += 4.5; }
                var extra = '';
                if (f.numero_nota) extra += 'Nota nº ' + f.numero_nota + '    ';
                if (f.data_emissao) extra += 'Emissao: ' + dataBr(f.data_emissao) + '    ';
                if (f.telefone) extra += 'Tel: ' + f.telefone;
                if (extra) { doc.text(extra, 14, y); y += 4.5; }

                var itens = Array.isArray(nota.d.itens) ? nota.d.itens : [];
                var linhasItens = itens.map(function (s) {
                  var p = parseItemNota(s);
                  return [p.qtd, p.nome, p.valor];
                });
                if (linhasItens.length) {
                  doc.autoTable({
                    startY: y + 2,
                    head: [['Qtd', 'Item', 'Valor']],
                    body: linhasItens,
                    headStyles: { fillColor: [255, 107, 0], textColor: 255, fontSize: 9 },
                    bodyStyles: { fontSize: 8.5 },
                    alternateRowStyles: { fillColor: [255, 245, 236] },
                    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 130 }, 2: { cellWidth: 30, halign: 'right' } },
                    margin: { left: 14, right: 14 }
                  });
                  y = doc.lastAutoTable.finalY + 6;
                } else { y += 4; }

                doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(220, 53, 69);
                doc.text('Total da nota: ' + brl(nota.mov.valor), 196, y, { align: 'right' });
                y += 12;
              }
            }
          }

          // Rodapé com paginação
          var paginas = doc.internal.getNumberOfPages();
          for (var i = 1; i <= paginas; i++) {
            doc.setPage(i);
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150);
            doc.text('Chef da Brasa - Relatório gerado automaticamente em ' + new Date().toLocaleString('pt-BR'), 14, 290);
            doc.text('Página ' + i + ' de ' + paginas, 196, 290, { align: 'right' });
          }

          var nomeArquivo = 'financeiro_' + dadosPeriodo.dataInicio + '_a_' + dadosPeriodo.dataFim;
          if (filtroTipo === 'ENTRADA') nomeArquivo += '_entradas';
          else if (filtroTipo === 'SAIDA') nomeArquivo += '_saidas_com_notas';
          else nomeArquivo += '_completo';
          nomeArquivo += '.pdf';
          doc.save(nomeArquivo);
          mostrarToast('✅ PDF gerado com notas detalhadas!');
        } catch (e) {
          alert('Erro ao gerar PDF: ' + e.message);
        }
      }
    </script>
  `

  return c.html(renderLayout('Financeiro', conteudo, 'financeiro'))
})

export default app