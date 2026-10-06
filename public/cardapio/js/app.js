// ============================================================
// PWA Hamburgueria - Cloudflare Workers
// Visual dark/dourado + destaques de promoção + lanches primeiro
// ============================================================
console.log('🚀 app.js carregado (versao dark/gold)');
const $ = s => document.querySelector(s);
const API = '/api';
const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
function imgUrl(p) {
  if (!p.imagem) return 'icons/icon.svg';
  return (p.imagem.startsWith('http') || p.imagem.startsWith('/')) ? p.imagem : ('/r2/' + p.imagem);
}
const state = {
  loja: null,
  produtos: [],
  promos: [],
  carrinho: JSON.parse(localStorage.getItem('carrinho') || '[]'),
  endereco: JSON.parse(localStorage.getItem('endereco') || 'null'),
  cliente: carregarClienteLocal(),
  entrega: null,
  filtro: '',
  categoriaAtiva: null,
  produtoAtual: null,
  qtd: 1,
  pedidoAtual: null,
  tipoPedido: 'entrega',
  _loginFase: 'identificar',
  _voltarPara: null,
  _cartaoBin: null
};
const salvar = () => {
  localStorage.setItem('carrinho', JSON.stringify(state.carrinho));
  localStorage.setItem('endereco', JSON.stringify(state.endereco));
};
function salvarClienteLocal() {
  if (state.cliente) localStorage.setItem('cliente', JSON.stringify(state.cliente));
  else localStorage.removeItem('cliente');
}
function carregarClienteLocal() {
  try { return JSON.parse(localStorage.getItem('cliente') || 'null'); } catch (e) { return null; }
}
function formatarTel(d) {
  d = String(d || '').replace(/\D/g, '');
  if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  return d;
}
// ---------- Sheets ----------
function abrirSheet(id) { fecharSheets(); $('#overlay').classList.remove('oculto'); $(id).classList.add('aberto'); }
function fecharSheets() {
  $('#overlay').classList.add('oculto');
  document.querySelectorAll('.sheet').forEach(s => s.classList.remove('aberto'));
}
// ---------- PROMOCOES (detecta em varios formatos) ----------
function promoDe(p) {
  const precoCheio = Number(p.preco || 0);
  const campos = [
    p.preco_promocional, p.preco_promo, p.preco_promocao, p.promo_preco,
    p.promocao && p.promocao.preco_promocional, p.promocao && p.promocao.preco,
    p.promo && p.promo.preco
  ];
  for (const v of campos) {
    const n = Number(v);
    if (isFinite(n) && n > 0 && n < precoCheio) return { preco: n };
  }
  for (const pr of (state.promos || [])) {
    const pid = Number(pr.produto_id ?? pr.produtoId ?? (pr.produto && pr.produto.id));
    if (pid !== Number(p.id)) continue;
    const ativa = pr.ativa ?? pr.ativo ?? true;
    if (ativa === false || ativa === 0 || ativa === '0') continue;
    const n = Number(pr.preco_promocional ?? pr.preco_promo ?? pr.valor_promocional ?? pr.preco);
    if (isFinite(n) && n > 0 && n < precoCheio) return { preco: n };
    const desc = Number(pr.desconto ?? pr.percentual ?? pr.desconto_percentual);
    if (isFinite(desc) && desc > 0 && desc < 100) return { preco: +(precoCheio * (1 - desc / 100)).toFixed(2) };
  }
  const cat = String(p.categoria || p.categoria_nome || '').toUpperCase();
  if (cat === 'PROMOCOES' && precoCheio > 0) return { preco: precoCheio };
  return null;
}
function precoEfetivo(p) { const pr = promoDe(p); return pr ? pr.preco : Number(p.preco || 0); }
// ---------- Init ----------
async function init() {
  $('#overlay').onclick = fecharSheets;
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = fecharSheets);
  await Promise.all([carregarLoja(), carregarPromos(), carregarCardapio()]);
  eventos();
  if (state.endereco && state.tipoPedido === 'entrega') await calcularEntrega();
  atualizarBarraSacola();
  renderizarResumoEndereco();
}
async function carregarLoja() {
  try {
    const r = await fetch(API + '/loja/status');
    state.loja = await r.json();
    $('#nomeLoja').textContent = state.loja.nome_empresa;
    document.title = state.loja.nome_empresa;
    if (state.loja.logo_url) $('#logoLoja').src = state.loja.logo_url;
    const badge = $('#badgeLoja');
    badge.textContent = state.loja.aberta ? 'Aberto' : 'Fechado';
    badge.classList.toggle('fechada', !state.loja.aberta);
    if (!state.loja.aberta) {
      $('#bannerFechada').classList.remove('oculto');
      $('#bannerFechada').textContent = state.loja.mensagem_fechado || 'Loja fechada no momento.';
    }
  } catch (e) { $('#badgeLoja').textContent = 'Offline'; }
}
async function carregarPromos() {
  try {
    const r = await fetch(API + '/promocoes');
    if (!r.ok) { state.promos = []; return; }
    const d = await r.json();
    state.promos = Array.isArray(d) ? d : (d.promocoes || []);
  } catch (e) { state.promos = []; }
}
async function carregarCardapio() {
  try {
    const rp = await fetch(API + '/produtos');
    if (!rp.ok) throw new Error('/produtos HTTP ' + rp.status);
    state.produtos = await rp.json();
    if (!Array.isArray(state.produtos)) throw new Error('/produtos nao voltou lista');
    renderDestaques();
    renderChips();
    renderCardapio();
  } catch (err) {
    $('#cardapio').innerHTML = '<p class="carregando">Erro: ' + (err && err.message ? err.message : 'desconhecido') + '</p>';
  }
}
// ---------- Categorias (LANCHES sempre primeiro) ----------
function categorias() {
  const ordem = ['LANCHES', 'LANCHES ARTESANAIS', 'COMBOS',  'PORCOES', 'PORÇÕES', 'BEBIDAS', 'ACOMPANHAMENTOS', 'SOBREMESAS'];
  const cats = [...new Set(state.produtos.map(p => p.categoria || p.categoria_nome || 'Outros'))];
  const prio = n => {
    const u = String(n).toUpperCase();
    if (u.includes('LANCH')) return 0;
    const i = ordem.indexOf(u);
    return i === -1 ? 999 : i;
  };
  return cats.sort((a, b) => prio(a) - prio(b) || String(a).localeCompare(String(b)));
}
// ---------- Destaques de promoção (acima das categorias) ----------
function renderDestaques() {
  const wrap = $('#blocoDestaques');
  if (!wrap) return;
  const temFiltro = !!state.filtro || !!state.categoriaAtiva;
  const promos = state.produtos.filter(p => promoDe(p) && Number(p.estoque) > 0);
  if (!promos.length || temFiltro) { wrap.classList.add('oculto'); wrap.innerHTML = ''; return; }
  wrap.classList.remove('oculto');
  wrap.innerHTML =
    '<div class="destaques-topo"><span class="destaques-titulo">🔥 Ofertas do dia</span><span class="destaques-sub">toque para aproveitar</span></div>' +
    '<div class="destaques">' + promos.map(p => {
      const pr = promoDe(p);
      const desc = Math.round((1 - pr.preco / Number(p.preco)) * 100);
      return `<article class="destaque-card" data-id="${p.id}">
        <div class="dc-imgwrap"><img src="${imgUrl(p)}" alt="${p.nome}" loading="lazy" onerror="this.src='icons/icon.svg'">
        ${isFinite(desc) && desc > 0 ? `<span class="dc-selo">-${desc}%</span>` : '<span class="dc-selo">🔥</span>'}</div>
        <div class="dc-nome">${p.nome}</div>
        <div class="dc-precos"><span class="preco-antigo">${fmt(p.preco)}</span><span class="dc-preco">${fmt(pr.preco)}</span></div>
      </article>`;
    }).join('') + '</div>';
  wrap.querySelectorAll('.destaque-card').forEach(el => el.onclick = () => abrirProduto(+el.dataset.id));
}
// ---------- Render ----------
function renderChips() {
  $('#chipsCategorias').innerHTML =
    `<button class="chip ${!state.categoriaAtiva ? 'ativo' : ''}" data-cat="">Tudo</button>` +
    categorias().map(c =>
      `<button class="chip ${state.categoriaAtiva === c ? 'ativo' : ''}" data-cat="${c}">${c}</button>`
    ).join('');
  document.querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    const cat = ch.dataset.cat || null;
    state.categoriaAtiva = state.categoriaAtiva === cat ? null : cat;
    renderDestaques(); renderChips(); renderCardapio();
  });
}
function renderCardapio() {
  const termo = state.filtro.toLowerCase();
  let prods = state.produtos.filter(p =>
    (!state.categoriaAtiva || (p.categoria || p.categoria_nome) === state.categoriaAtiva) &&
    (!termo || p.nome.toLowerCase().includes(termo) || (p.descricao || '').toLowerCase().includes(termo))
  );
  if (!prods.length) { $('#cardapio').innerHTML = '<p class="carregando">Nenhum produto encontrado.</p>'; return; }
  const cats = state.categoriaAtiva ? [state.categoriaAtiva] : categorias();
  $('#cardapio').innerHTML = cats.map(cat => {
    const doGrupo = prods.filter(p => (p.categoria || p.categoria_nome || 'Outros') === cat);
    if (!doGrupo.length) return '';
    return `<section class="secao"><h2>${cat} <span class="qtd">(${doGrupo.length})</span></h2>` +
      doGrupo.map(p => {
        const pr = promoDe(p);
        return `<article class="produto ${pr ? 'em-promo' : ''}" data-id="${p.id}">
          <div class="produto-info">
            <h3>${p.nome}</h3>
            <p>${p.descricao || ''}</p>
            <div class="produto-badges">
              ${pr ? '<span class="produto-badge promo">🔥 Oferta</span>' : ''}
              ${Number(p.estoque) <= 0 ? '<span class="produto-badge">Esgotado</span>' : ''}
            </div>
            <div class="produto-preco-linha">
              <span class="produto-preco">${fmt(precoEfetivo(p))}</span>
              ${pr ? `<span class="preco-antigo">${fmt(p.preco)}</span>` : ''}
              <button class="produto-add" data-add="${p.id}">+ Adicionar</button>
            </div>
          </div>
          <img class="produto-img" src="${imgUrl(p)}" alt="${p.nome}" loading="lazy" onerror="this.src='icons/icon.svg'">
        </article>`;
      }).join('') + '</section>';
  }).join('');
  document.querySelectorAll('.produto').forEach(el => el.onclick = () => abrirProduto(+el.dataset.id));
  document.querySelectorAll('.produto-add').forEach(b => b.onclick = ev => { ev.stopPropagation(); addRapido(+b.dataset.add); });
}
function addRapido(id) {
  const p = state.produtos.find(x => x.id === id);
  if (!p || Number(p.estoque) <= 0) return;
  const preco = precoEfetivo(p);
  const chave = String(p.id);
  const ex = state.carrinho.find(i => i.chave === chave);
  if (ex) ex.quantidade += 1;
  else state.carrinho.push({ chave, id: p.id, nome: p.nome, preco, quantidade: 1, categoria: (p.categoria || p.categoria_nome) });
  state.carrinho.forEach(i => i.subtotal = i.preco * i.quantidade);
  salvar(); atualizarBarraSacola();
}
// ---------- Modal do produto ----------
function abrirProduto(id) {
  const p = state.produtos.find(x => x.id === id);
  if (!p || Number(p.estoque) <= 0) return;
  state.produtoAtual = p;
  state.qtd = 1;
  $('#prodNome').textContent = p.nome;
  $('#prodDesc').textContent = p.descricao || '';
  $('#prodImg').src = imgUrl(p);
  $('#prodImg').onerror = () => $('#prodImg').src = 'icons/icon.svg';
  $('#prodQtd').textContent = 1;
  atualizarTotalProduto();
  abrirSheet('#sheetProduto');
}
function atualizarTotalProduto() {
  const p = state.produtoAtual;
  if (p) $('#prodTotal').textContent = fmt(precoEfetivo(p) * state.qtd);
}
// ---------- Carrinho ----------
function addAoCarrinho() {
  const p = state.produtoAtual;
  if (!p) return;
  const preco = precoEfetivo(p);
  const chave = String(p.id);
  const existente = state.carrinho.find(i => i.chave === chave);
  if (existente) { existente.quantidade += state.qtd; existente.preco = preco; }
  else state.carrinho.push({ chave, id: p.id, nome: p.nome, preco, quantidade: state.qtd, categoria: (p.categoria || p.categoria_nome) });
  state.carrinho.forEach(i => i.subtotal = i.preco * i.quantidade);
  salvar(); atualizarBarraSacola(); fecharSheets();
}
function mudarQtd(chave, delta) {
  const item = state.carrinho.find(i => i.chave === chave);
  if (!item) return;
  item.quantidade += delta;
  if (item.quantidade <= 0) state.carrinho = state.carrinho.filter(i => i.chave !== chave);
  state.carrinho.forEach(i => i.subtotal = i.preco * i.quantidade);
  salvar(); atualizarBarraSacola(); renderSacola();
}
function subtotalCarrinho() { return state.carrinho.reduce((s, i) => s + i.subtotal, 0); }
function taxaAtual() { return state.tipoPedido === 'retirada' ? 0 : (state.entrega?.taxa || 0); }
function atualizarBarraSacola() {
  const n = state.carrinho.reduce((s, i) => s + i.quantidade, 0);
  const subtotal = subtotalCarrinho();
  const taxa = taxaAtual();
  const barra = $('#barraSacola');
  barra.classList.toggle('oculto', n === 0);
  $('#sacolaQtd').textContent = n;
  $('#sacolaTotal').textContent = (state.tipoPedido === 'entrega' && taxa > 0)
    ? fmt(subtotal + taxa) + ' (com entrega)'
    : fmt(subtotal);
}
function renderSacola() {
  const box = $('#sacolaItens');
  if (!state.carrinho.length) { box.innerHTML = '<p class="carregando">Sacola vazia.</p>'; return; }
  box.innerHTML = state.carrinho.map(i => `<div class="item-sacola">
    <div class="info"><b>${i.quantidade}x ${i.nome}</b></div>
    <div class="mini-stepper">
      <button data-acao="-1" data-chave="${i.chave}">-</button>
      <button data-acao="1" data-chave="${i.chave}">+</button>
    </div>
    <span class="preco">${fmt(i.subtotal)}</span>
  </div>`).join('');
  box.querySelectorAll('button').forEach(b => b.onclick = () => mudarQtd(b.dataset.chave, +b.dataset.acao));
  const taxa = taxaAtual();
  const tempo = state.entrega?.tempo;
  $('#sumSubtotal').textContent = fmt(subtotalCarrinho());
  if (state.tipoPedido === 'retirada') $('#sumEntrega').textContent = 'Retirada (sem taxa)';
  else if (taxa != null) $('#sumEntrega').textContent = fmt(taxa) + (tempo ? `(~${tempo} min)` : '');
  else $('#sumEntrega').textContent = 'Calcular endereço';
  $('#sumTotal').textContent = fmt(subtotalCarrinho() + taxa);
}
// ---------- Endereco e Entrega ----------
function renderizarResumoEndereco() {
  const e = state.endereco;
  $('#resumoEndereco').textContent = e ? (e.endereco + ', ' + e.numero + '  - ' + e.bairro + '  >') : 'Informe seu endereco  >';
}
function preencherFormEndereco() {
  const e = state.endereco || {};
  fCep.value = e.cep || ''; fEndereco.value = e.endereco || ''; fNumero.value = e.numero || '';
  fBairro.value = e.bairro || ''; fCidade.value = e.cidade || ''; fUf.value = e.uf || '';
  fComplemento.value = e.complemento || ''; fReferencia.value = e.referencia || '';
}
async function autocompletarCep() {
  const cep = fCep.value.replace(/\D/g, '');
  if (cep.length !== 8) return;
  try {
    const r = await fetch('https://viacep.com.br/ws/' + cep + '/json/');
    const d = await r.json();
    if (d.erro) return;
    fEndereco.value = d.logradouro || fEndereco.value;
    fBairro.value = d.bairro || fBairro.value;
    fCidade.value = d.localidade || fCidade.value;
    fUf.value = d.uf || fUf.value;
  } catch (e) {}
}
async function calcularEntrega() {
  if (!state.endereco || state.tipoPedido === 'retirada') { state.entrega = null; return null; }
  const hash = JSON.stringify(state.endereco);
  if (state.entrega && state.entrega._enderecoHash === hash) return state.entrega;
  try {
    const r = await fetch(API + '/calculo-de-entrega', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.endereco) });
    const d = await r.json();
    if (d.bloqueada) { state.entrega = { bloqueada: true, mensagem: d.mensagem }; atualizarBarraSacola(); return state.entrega; }
    if (d.status === false && d.motivo === 'endereco_vazio') { state.entrega = null; return null; }
    d._enderecoHash = hash; state.entrega = d;
    atualizarBarraSacola();
    if ($('#sheetSacola').classList.contains('aberto')) renderSacola();
    if ($('#sheetPagamento').classList.contains('aberto')) atualizarTotalCheckout();
    return d;
  } catch (e) { state.entrega = null; return null; }
}
async function salvarEndereco() {
  const e = {
    cep: fCep.value.trim(), endereco: fEndereco.value.trim(), numero: fNumero.value.trim(),
    bairro: fBairro.value.trim(), cidade: fCidade.value.trim(), uf: fUf.value.trim().toUpperCase(),
    complemento: fComplemento.value.trim(), referencia: fReferencia.value.trim()
  };
  if (!e.cep || !e.endereco || !e.numero) return alert('Preencha CEP, rua e numero.');
  state.endereco = e; state.entrega = null; salvar(); renderizarResumoEndereco();
  await calcularEntrega();
  const prox = state._voltarPara; state._voltarPara = null; fecharSheets();
  if (prox === 'pagamento') abrirPagamento();
}
// ---------- LOGIN / CADASTRO por WhatsApp ----------
const SVG_CHECK = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
const SVG_INFO = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`;
function setLoginStatus(tipo, msg) {
  const el = $('#loginStatus');
  if (!tipo || !msg) { el.hidden = true; el.className = 'login-status'; el.innerHTML = ''; return; }
  let ico = '';
  if (tipo === 'buscando') ico = '<span class="ls-ico"><span class="spinner"></span></span>';
  else if (tipo === 'ok') ico = `<span class="ls-ico">${SVG_CHECK}</span>`;
  else ico = `<span class="ls-ico">${SVG_INFO}</span>`;
  el.className = 'login-status ' + tipo;
  el.innerHTML = ico + '<span>' + msg + '</span>';
  el.hidden = false;
}
function montarEnderecoDoCliente(cli) {
  if (!cli) return null;
  const end = String(cli.endereco || '').trim(); const num = String(cli.numero || '').trim(); const bai = String(cli.bairro || '').trim();
  if (!end || !num || !bai) return null;
  return { endereco: end, numero: num, complemento: String(cli.complemento || '').trim(), bairro: bai, cidade: String(cli.cidade || '').trim(), uf: String(cli.uf || '').trim(), cep: String(cli.cep || '').replace(/\D/g, ''), referencia: String(cli.referencia || '').trim() };
}
function renderClienteCard(cli) {
  const card = $('#clienteCard');
  const est = montarEnderecoDoCliente(cli);
  let endHtml = '';
  if (est) endHtml = '<div class="cc-end">' + [est.endereco + ', ' + est.numero, est.bairro, est.cep].filter(Boolean).join(' - ') + '</div>';
  card.className = 'cliente-card identificado';
  card.innerHTML = `<div class="cc-selo">${SVG_CHECK}</div>
    <div class="cc-info">
      <div class="cc-label">Cliente identificado</div>
      <div class="cc-nome">${cli.nome || ''}</div>
      <div class="cc-tel">${formatarTel(cli.telefone)}</div>
      ${endHtml}
    </div>`;
}
function mostrarClientePronto(cli) {
  state._loginFase = 'pronto';
  $('#loginTel').value = formatarTel(cli.telefone);
  $('#loginNomeWrap').classList.add('oculto');
  renderClienteCard(cli);
  setLoginStatus('ok', 'Identificado! Confirme seus dados para continuar.');
  const btn = $('#btnLoginAcao'); btn.textContent = 'Continuar para pagamento'; btn.disabled = false;
}
function abrirSheetLogin() {
  if (state.cliente && state.cliente.telefone) { mostrarClientePronto(state.cliente); }
  else {
    state._loginFase = 'identificar';
    $('#loginNomeWrap').classList.add('oculto');
    $('#loginNome').value = ''; $('#loginTel').value = '';
    $('#clienteCard').className = 'cliente-card oculto'; $('#clienteCard').innerHTML = '';
    setLoginStatus('', '');
    const btn = $('#btnLoginAcao'); btn.textContent = 'Continuar'; btn.disabled = true;
  }
  abrirSheet('#sheetLogin');
  setTimeout(() => { const t = $('#loginTel'); if (t) t.focus(); }, 320);
}
async function acaoLogin() {
  const fase = state._loginFase || 'identificar';
  const btn = $('#btnLoginAcao');
  if (fase === 'pronto') { aposIdentificacao(); return; }
  const tel = $('#loginTel').value.replace(/\D/g, '');
  if (tel.length < 10) return;
  if (fase === 'identificar') {
    btn.disabled = true; setLoginStatus('buscando', 'Buscando seu cadastro...');
    try {
      const r = await fetch(API + '/clientes/telefone/' + tel);
      const d = await r.json();
      if (d && (d.encontrado || d.cliente) && (d.cliente || d)) {
        const cli = d.cliente || d;
        state.cliente = { id: cli.id, nome: cli.nome, telefone: tel };
        const est = montarEnderecoDoCliente(cli);
        if (est && !state.endereco) state.endereco = est;
        salvarClienteLocal(); mostrarClientePronto(state.cliente);
      } else {
        state._loginFase = 'novo';
        $('#loginNomeWrap').classList.remove('oculto'); $('#loginNome').value = '';
        setLoginStatus('novo', 'Numero novo! Informe seu nome completo para criar seu cadastro.');
        btn.textContent = 'Cadastrar e continuar'; btn.disabled = true;
        setTimeout(() => { const n = $('#loginNome'); if (n) n.focus(); }, 160);
      }
    } catch (e) { setLoginStatus('erro', 'Erro ao consultar. Verifique a conexao.'); btn.disabled = false; }
    return;
  }
  if (fase === 'novo') {
    const nome = $('#loginNome').value.trim();
    if (nome.length < 3) return;
    state.cliente = { nome: nome, telefone: tel, novo: true };
    salvarClienteLocal();
    setLoginStatus('ok', 'Cadastro criado! Vamos finalizar seu pedido.');
    btn.disabled = true; setTimeout(aposIdentificacao, 450);
  }
}
function aposIdentificacao() {
  fecharSheets();
  if (state.tipoPedido === 'entrega' && !state.endereco) {
    state._voltarPara = 'pagamento'; preencherFormEndereco(); abrirSheet('#sheetEndereco');
  } else {
    state._voltarPara = null;
    if (state.tipoPedido === 'entrega') calcularEntrega().then(() => abrirPagamento());
    else abrirPagamento();
  }
}
function atualizarValidacaoLogin() {
  const fase = state._loginFase || 'identificar';
  const btn = $('#btnLoginAcao');
  if (fase === 'pronto') return;
  const tel = $('#loginTel').value.replace(/\D/g, '');
  if (fase === 'identificar') { btn.disabled = tel.length < 10; return; }
  if (fase === 'novo') btn.disabled = tel.length < 10 || $('#loginNome').value.trim().length < 3;
}
// ---------- Checkout ----------
async function continuarCheckout() {
  if (!state.carrinho.length) return;
  if (state.loja && !state.loja.aberta) return alert('A loja esta fechada no momento.');
  fecharSheets();
  if (!state.cliente || !state.cliente.telefone) { abrirSheetLogin(); return; }
  if (state.tipoPedido === 'entrega') {
    if (!state.endereco) { state._voltarPara = 'pagamento'; preencherFormEndereco(); abrirSheet('#sheetEndereco'); return; }
    if (!state.entrega || state.entrega.bloqueada) {
      await calcularEntrega();
      if (!state.entrega || state.entrega.bloqueada) { state._voltarPara = 'pagamento'; preencherFormEndereco(); abrirSheet('#sheetEndereco'); return; }
    }
  }
  abrirPagamento();
}
function abrirPagamento() {
  const cli = state.cliente || {};
  $('#resumoCliente').innerHTML = `<div class="cliente-card identificado">
    <div class="cc-selo">${SVG_CHECK}</div>
    <div class="cc-info">
      <div class="cc-label">Cliente</div>
      <div class="cc-nome">${cli.nome || ''}</div>
      <div class="cc-tel">${formatarTel(cli.telefone)}</div>
    </div>
    <a href="#" id="trocarCliente" class="cc-trocar">Trocar</a>
  </div>`;
  $('#trocarCliente').onclick = ev => { ev.preventDefault(); state.cliente = null; salvarClienteLocal(); abrirSheetLogin(); };
  const entrega = state.tipoPedido === 'entrega';
  $('#opcaoCartao').classList.toggle('oculto', false);
  $('#opcaoRetiradaPresencial').classList.toggle('oculto', entrega);
  $('#blocoEnderecoEntrega').classList.toggle('oculto', !entrega);
  $('#blocoAvisoRetirada').classList.toggle('oculto', entrega);
  if (entrega && state.endereco) {
    const e = state.endereco; const ent = state.entrega;
    let taxaHtml = 'Calculando...'; let kmHtml = '?';
    if (ent) {
      if (ent.bloqueada) { taxaHtml = '<span style="color:#ff8f7a;">Fora da área</span>'; kmHtml = ent.km ? ent.km.toFixed(1) : '?'; }
      else { taxaHtml = fmt(ent.taxa || 0); kmHtml = ent.km != null ? ent.km.toFixed(1) : '?'; }
    }
    $('#resumoEnderecoCheckout').innerHTML = `<b>${e.endereco}, ${e.numero}</b> ${e.complemento ? '- ' + e.complemento : ''}<br>
      ${e.bairro} - ${e.cidade}/${e.uf} - CEP ${e.cep}<br>
      Entrega: <b>${taxaHtml}</b> (~${kmHtml} km)<br>
      <a href="#" id="trocarEndereco" style="color:var(--dourado);font-weight:700">Trocar endereco</a>`;
    $('#trocarEndereco')?.addEventListener('click', ev => { ev.preventDefault(); state.entrega = null; state._voltarPara = 'pagamento'; preencherFormEndereco(); abrirSheet('#sheetEndereco'); });
  }
  atualizarTotalCheckout();
  abrirSheet('#sheetPagamento');
}
function atualizarTotalCheckout() {
  const subtotal = subtotalCarrinho();
  const taxa = taxaAtual();
  const elSub = document.getElementById('sumSubtotalCheckout');
  const elTaxa = document.getElementById('sumEntregaCheckout');
  const elTotal = document.getElementById('totalCheckout');
  const linhaTaxa = document.getElementById('linhaTaxaCheckout');
  if (elSub) elSub.textContent = fmt(subtotal);
  if (linhaTaxa) linhaTaxa.style.display = state.tipoPedido === 'retirada' ? 'none' : '';
  if (elTaxa) elTaxa.textContent = state.tipoPedido === 'retirada' ? 'Retirada' : fmt(taxa);
  if (elTotal) elTotal.textContent = fmt(subtotal + taxa);
}
// ---------- Fazer Pedido ----------
async function fazerPedido() {
  if (!state.cliente || !state.cliente.nome || !state.cliente.telefone) { abrirSheetLogin(); return; }
  const pagamento = document.querySelector('input[name="pagamento"]:checked').value;
  const taxa = taxaAtual();
  const total = subtotalCarrinho() + taxa;
  const body = {
    nome: state.cliente.nome,
    telefone: String(state.cliente.telefone).replace(/\D/g, ''),
    ...(state.tipoPedido === 'entrega' ? state.endereco : {}),
    pagamento,
    tipo_pedido: state.tipoPedido,
    taxa_entrega: taxa,
    distancia_km: state.entrega?.km || 0,
    total: +total.toFixed(2),
    itens: state.carrinho.map(i => ({ id: i.id, nome: i.nome, preco: i.preco, quantidade: i.quantidade, subtotal: i.subtotal }))
  };
  const btn = $('#btnFazerPedido');
  btn.disabled = true; btn.textContent = 'Enviando pedido...';
  try {
    const r = await fetch(API + '/pedidos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const pedido = await r.json();
    if (!r.ok) throw new Error(pedido.erro || 'Erro ao salvar');
    state.pedidoAtual = pedido.pedido_id;
    state.carrinho = []; salvar(); atualizarBarraSacola(); fecharSheets();
    if (pagamento === 'PIX') await gerarPix(pedido.pedido_id);
    else if (pagamento === 'CARTAO_CREDITO') abrirSheetCartao(pedido.pedido_id, total);
    else mostrarStatusSemPix(pedido.pedido_id, 'Preparamos seu pedido. Pagamento na retirada.');
  } catch (e) {
    alert('Nao foi possivel fazer o pedido: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Fazer pedido';
  }
}
// ---------- CARTAO DE CREDITO ----------
function abrirSheetCartao(pedidoId, total) {
  state.pedidoAtual = pedidoId;
  $('#cartaoValor').textContent = fmt(total);
  $('#cartaoStatus').textContent = '';
  abrirSheet('#sheetCartao');
}
function parseValidade(v) {
  const m = v.replace(/\D/g, '');
  if (m.length < 4) return null;
  let mes = parseInt(m.slice(0, 2), 10);
  let ano = parseInt(m.slice(2, 4), 10);
  if (mes < 1 || mes > 12) return null;
  if (ano < 100) ano += 2000;
  return { mes, ano };
}
async function consultarBin() {
  const num = $('#cartNumero').value.replace(/\s/g, '');
  if (num.length < 6) return;
  const bin = num.slice(0, 6);
  if (state._cartaoBin === bin) return;
  state._cartaoBin = bin;
  try {
    const r = await fetch(API + '/pagamento/bin?bin=' + bin);
    const d = await r.json();
    if (d.payment_method_id) {
      state._cartaoMetodo = d.payment_method_id;
      $('#cartBandeira').textContent = (d.name || d.payment_method_id) + (d.type === 'debit_card' ? '  (débito)' : '');
      const sel = $('#cartParcelas');
      sel.innerHTML = (d.installments || [{ count: 1 }]).map(i => `<option value="${i.count}">${i.count}x</option>`).join('');
    }
  } catch (e) {}
}
async function tokenizarCartao(dados, publicKey) {
  const resp = await fetch('https://api.mercadopago.com/v1/card_tokens?public_key=' + publicKey, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      card_number: dados.numero,
      expiration_month: dados.mes,
      expiration_year: dados.ano,
      security_code: dados.cvv,
      cardholder: { name: dados.nome, identification: { type: 'CPF', number: dados.cpf || '00000000000' } }
    })
  });
  const j = await resp.json();
  if (!resp.ok) throw new Error(j.message || 'Erro ao validar cartão');
  return j.id;
}
async function pagarCartao() {
  const numero = $('#cartNumero').value.replace(/\s/g, '');
  const nome = $('#cartNome').value.trim();
  const val = parseValidade($('#cartValidade').value);
  const cvv = $('#cartCvv').value.trim();
  const cpf = $('#cartCpf').value.replace(/\D/g, '');
  const parcelas = parseInt($('#cartParcelas').value) || 1;
  if (numero.length < 13) return setCartaoStatus('Numero de cartao invalido.');
  if (!nome) return setCartaoStatus('Informe o nome impresso no cartao.');
  if (!val) return setCartaoStatus('Validade invalida (use MM/AA).');
  if (cvv.length < 3) return setCartaoStatus('CVV invalido.');
  setCartaoStatus('Processando pagamento...');
  try {
    const cfg = await (await fetch(API + '/pagamento/config')).json();
    if (!cfg.public_key) throw new Error('Public key nao configurada.');
    const token = await tokenizarCartao({ numero, mes: val.mes, ano: val.ano, cvv, nome, cpf }, cfg.public_key);
    const r = await fetch(API + '/pagamento/cartao', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: state.pedidoAtual, token, payment_method_id: state._cartaoMetodo, installments: parcelas })
    });
    const d = await r.json();
    if (d.sucesso) { fecharSheets(); mostrarStatusSemPix(state.pedidoAtual, 'Pagamento aprovado! Pedido em preparacao.'); pollStatus(state.pedidoAtual); }
    else setCartaoStatus('Pagamento recusado: ' + (d.status_detail || d.erro || 'tente outro cartao.'));
  } catch (e) {
    setCartaoStatus('Erro: ' + e.message);
  }
}
function setCartaoStatus(msg) { $('#cartaoStatus').textContent = msg; }
// ---------- PIX ----------
async function gerarPix(pedidoId) {
  abrirSheet('#sheetPix');
  $('#pixTitulo').textContent = 'Pague com PIX - Pedido #' + pedidoId;
  $('#pixQr').classList.remove('oculto'); $('#pixCopia').classList.remove('oculto'); $('#btnCopiarPix').classList.remove('oculto');
  $('#statusPedido').className = 'status-pedido';
  $('#statusPedido').textContent = 'Gerando QR Code...';
  try {
    const r = await fetch(API + '/pix/criar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pedido_id: pedidoId }) });
    const pix = await r.json();
    if (!r.ok) throw new Error(pix.erro);
    $('#pixQr').src = 'data:image/png;base64,' + pix.qr_code_base64;
    $('#pixCopia').value = pix.qr_code;
    pollStatus(pedidoId);
  } catch (e) {
    $('#statusPedido').textContent = 'Erro: ' + e.message + ' - chame no WhatsApp.';
  }
}
function mostrarStatusSemPix(pedidoId, msg) {
  abrirSheet('#sheetPix');
  $('#pixTitulo').textContent = 'Pedido #' + pedidoId + ' recebido!';
  $('#pixQr').classList.add('oculto'); $('#pixCopia').classList.add('oculto'); $('#btnCopiarPix').classList.add('oculto');
  $('#statusPedido').className = 'status-pedido ok';
  $('#statusPedido').textContent = msg;
  pollStatus(pedidoId);
}
function pollStatus(pedidoId) {
  const mapa = {
    AGUARDANDO_PIX: 'Aguardando pagamento...', PENDENTE: 'Pagamento pendente...',
    PAGO: 'Pagamento confirmado!', EM_PREPARO: 'Pedido em preparacao...',
    PRONTO: 'Pedido pronto!', SAIU_ENTREGA: 'Saiu para entrega!',
    ENTREGUE: 'Pedido entregue. Bom apetite!', CANCELADO: 'Pedido cancelado.'
  };
  const timer = setInterval(async () => {
    try {
      const r = await fetch(API + '/pedidos/' + pedidoId + '/status');
      const s = await r.json();
      const pago = s.status_pagamento === 'PAGO' || s.status_pagamento === 'APPROVED';
      const chave = pago && s.status === 'AGUARDANDO_PIX' ? 'PAGO' : s.status;
      $('#statusPedido').textContent = mapa[chave] || ('Status: ' + s.status);
      if (pago || chave === 'PAGO') $('#statusPedido').classList.add('ok');
      if (s.status === 'ENTREGUE' || s.status === 'CANCELADO') clearInterval(timer);
    } catch (e) {}
  }, 10000);
}
// ---------- Eventos ----------
function eventos() {
  $('#inputBusca').oninput = e => { state.filtro = e.target.value; renderDestaques(); renderCardapio(); };
  $('#btnEndereco').onclick = () => { state._voltarPara = null; preencherFormEndereco(); abrirSheet('#sheetEndereco'); };
  $('#fCep').addEventListener('blur', autocompletarCep);
  $('#btnSalvarEndereco').onclick = salvarEndereco;
  $('#btnVerSacola').onclick = () => { renderSacola(); abrirSheet('#sheetSacola'); };
  $('#btnContinuar').onclick = continuarCheckout;
  $('#btnFazerPedido').onclick = fazerPedido;
  $('#prodMenos').onclick = () => { state.qtd = Math.max(1, state.qtd - 1); $('#prodQtd').textContent = state.qtd; atualizarTotalProduto(); };
  $('#prodMais').onclick = () => { state.qtd++; $('#prodQtd').textContent = state.qtd; atualizarTotalProduto(); };
  $('#btnAddCarrinho').onclick = addAoCarrinho;
  $('#btnCopiarPix').onclick = async () => {
    await navigator.clipboard.writeText($('#pixCopia').value);
    $('#btnCopiarPix').textContent = 'Codigo copiado!';
    setTimeout(() => $('#btnCopiarPix').textContent = 'Copiar codigo PIX', 2000);
  };
  document.querySelectorAll('input[name="tipoPedido"]').forEach(r => r.onchange = () => {
    state.tipoPedido = r.value;
    document.querySelectorAll('.opcoes-tipo-pedido .opcao-pagamento').forEach(o => o.classList.remove('selecionada'));
    r.closest('.opcao-pagamento').classList.add('selecionada');
    atualizarBarraSacola();
    if ($('#sheetPagamento').classList.contains('aberto')) { abrirPagamento(); }
  });
  document.querySelectorAll('input[name="pagamento"]').forEach(r => r.onchange = () => {
    document.querySelectorAll('.opcao-pagamento').forEach(o => o.classList.remove('selecionada'));
    r.closest('.opcao-pagamento').classList.add('selecionada');
  });
  $('#btnLoginAcao').onclick = acaoLogin;
  $('#loginTel').addEventListener('input', () => {
    const tel = $('#loginTel').value.replace(/\D/g, '');
    $('#loginTel').value = tel ? formatarTel(tel) : '';
    atualizarValidacaoLogin();
  });
  $('#loginNome').addEventListener('input', atualizarValidacaoLogin);
  $('#cartNumero').addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 16);
    e.target.value = v.replace(/(\d{4})(?=\d)/g, '$1 ');
    consultarBin();
  });
  $('#cartValidade').addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
    e.target.value = v;
  });
  $('#btnPagarCartao').onclick = pagarCartao;
}
init();