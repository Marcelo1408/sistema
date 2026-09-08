// ============================================================
// PWA ESPETARIA - estilo iFood (100% ASCII)
// sem "Todos" + ESPETINHOS primeiro + LOGIN/CADASTRO por WhatsApp
// com cálculo dinâmico de taxa de entrega via API
// ============================================================
console.log('🚀 app.js carregado (versão integrada)');

const $ = s => document.querySelector(s);
const API = '/api';
const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const state = {
  loja: null,
  produtos: [],
  adicionais: [],
  carrinho: JSON.parse(localStorage.getItem('carrinho') || '[]'),
  endereco: JSON.parse(localStorage.getItem('endereco') || 'null'),
  cliente: carregarClienteLocal(),
  entrega: null,          // Objeto com { taxa, km, tempo, ... } da API
  filtro: '',
  categoriaAtiva: null,
  produtoAtual: null,
  qtd: 1,
  adicionaisSel: new Set(),
  pedidoAtual: null,
  _loginFase: 'identificar',
  _voltarPara: null
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
$('#overlay').onclick = fecharSheets;
document.querySelectorAll('[data-close]').forEach(b => b.onclick = fecharSheets);

// ---------- Init ----------
async function init() {
  console.log('🔁 Inicializando...');
  await Promise.all([carregarLoja(), carregarCardapio()]);
  eventos();
  // Se já houver endereço salvo, calcula a entrega
  if (state.endereco) {
    console.log('📦 Endereço salvo encontrado, calculando entrega...');
    await calcularEntrega();
  }
  atualizarBarraSacola();
  renderizarResumoEndereco();
  console.log('✅ Inicialização concluída');
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
  } catch (e) { console.warn('Erro loja:', e); $('#badgeLoja').textContent = 'Offline'; }
}

async function carregarCardapio() {
  try {
    const rp = await fetch(API + '/produtos');
    const ra = await fetch(API + '/adicionais');
    if (!rp.ok) throw new Error('/produtos HTTP ' + rp.status);
    if (!ra.ok) throw new Error('/adicionais HTTP ' + ra.status);
    state.produtos = await rp.json();
    state.adicionais = await ra.json();
    if (!Array.isArray(state.produtos)) throw new Error('/produtos nao voltou lista');
    renderChips();
    renderCardapio();
  } catch (err) {
    console.error('ERRO cardapio:', err);
    $('#cardapio').innerHTML = '<p class="carregando">Erro: ' + (err && err.message ? err.message : 'desconhecido') + '</p>';
  }
}

// ---------- Render ----------
function categorias() {
  const ordem = ['ESPETINHOS','COMBOS','JANTINHA','BEBIDAS','ADICIONAIS','PROMOCOES','PORCOES'];
  const cats = [...new Set(state.produtos.map(p => p.categoria || 'Outros'))];
  return cats.sort((a, b) => {
    const ia = ordem.indexOf(a);
    const ib = ordem.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

function renderChips() {
  const cats = categorias();
  $('#chipsCategorias').innerHTML = cats.map(c =>
    `<button class="chip ${state.categoriaAtiva === c ? 'ativo' : ''}" data-cat="${c}">${c}</button>`
  ).join('');
  document.querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    state.categoriaAtiva = state.categoriaAtiva === ch.dataset.cat ? null : ch.dataset.cat;
    renderChips(); renderCardapio();
  });
}

function renderCardapio() {
  const termo = state.filtro.toLowerCase();
  let prods = state.produtos.filter(p =>
    (!state.categoriaAtiva || p.categoria === state.categoriaAtiva) &&
    (!termo || p.nome.toLowerCase().includes(termo) || (p.descricao || '').toLowerCase().includes(termo))
  );

  if (!prods.length) { $('#cardapio').innerHTML = '<p class="carregando">Nenhum produto encontrado.</p>'; return; }

  const cats = state.categoriaAtiva ? [state.categoriaAtiva] : categorias();
  $('#cardapio').innerHTML = cats.map(cat => {
    const doGrupo = prods.filter(p => (p.categoria || 'Outros') === cat);
    if (!doGrupo.length) return '';
    return `<section class="secao"><h2>${cat} <span class="qtd">(${doGrupo.length})</span></h2>
      ${doGrupo.map(p => `
        <article class="produto" data-id="${p.id}">
          <div class="produto-info">
            <h3>${p.nome}</h3>
            <p>${p.descricao || ''}</p>
            <span class="produto-preco">${fmt(p.preco)}</span>
            ${Number(p.estoque) <= 0 ? '<span class="produto-sem-estoque"> - Esgotado</span>' : ''}
          </div>
          <img class="produto-img" src="${p.imagem ? ('/uploads/' + p.imagem) : '/icons/icon.svg'}" alt="${p.nome}" loading="lazy" onerror="this.src='/icons/icon.svg'">
        </article>
      `).join('')}</section>`;
  }).join('');

  document.querySelectorAll('.produto').forEach(el => el.onclick = () => abrirProduto(+el.dataset.id));
}

// ---------- Modal do produto ----------
function abrirProduto(id) {
  const p = state.produtos.find(x => x.id === id);
  if (!p || Number(p.estoque) <= 0) return;
  state.produtoAtual = p; 
  state.qtd = 1;
  $('#prodNome').textContent = p.nome;
  $('#prodDesc').textContent = p.descricao || '';
  $('#prodImg').src = p.imagem ? `/uploads/${p.imagem}` : '/icons/icon.svg';
  $('#prodImg').onerror = () => $('#prodImg').src = '/icons/icon.svg';
  $('#prodQtd').textContent = 1;
  $('#adicionaisTitulo').classList.add('oculto');
  $('#prodAdicionais').innerHTML = '';
  atualizarTotalProduto();
  abrirSheet('#sheetProduto');
}

function atualizarTotalProduto() {
  const p = state.produtoAtual;
  $('#prodTotal').textContent = fmt(Number(p.preco) * state.qtd);
}

// ---------- Carrinho ----------
function addAoCarrinho() {
  const p = state.produtoAtual;
  if (!p) return;
  const chave = String(p.id);
  const unit = Number(p.preco);
  const existente = state.carrinho.find(i => i.chave === chave);
  if (existente) {
    existente.quantidade += state.qtd;
  } else {
    state.carrinho.push({
      chave, 
      id: p.id, 
      nome: p.nome, 
      preco: unit, 
      quantidade: state.qtd,
      adicionais: [],
      categoria: p.categoria
    });
  }
  state.carrinho.forEach(i => i.subtotal = i.preco * i.quantidade);
  salvar();
  atualizarBarraSacola();
  fecharSheets();
}

function mudarQtd(chave, delta) {
  const item = state.carrinho.find(i => i.chave === chave);
  if (!item) return;
  item.quantidade += delta;
  if (item.quantidade <= 0) state.carrinho = state.carrinho.filter(i => i.chave !== chave);
  state.carrinho.forEach(i => i.subtotal = i.preco * i.quantidade);
  salvar();
  atualizarBarraSacola();
  renderSacola();
}

function subtotalCarrinho() { 
  return state.carrinho.reduce((s, i) => s + i.subtotal, 0); 
}

// ---------- Barra inferior (com entrega) ----------
function atualizarBarraSacola() {
  const n = state.carrinho.reduce((s, i) => s + i.quantidade, 0);
  const subtotal = subtotalCarrinho();
  const taxa = state.entrega?.taxa || 0;
  const total = subtotal + taxa;
  const barra = $('#barraSacola');
  barra.classList.toggle('oculto', n === 0);
  $('#sacolaQtd').textContent = n;
  if (state.entrega && taxa > 0) {
    $('#sacolaTotal').textContent = fmt(total) + ' (com entrega)';
  } else {
    $('#sacolaTotal').textContent = fmt(subtotal);
  }
}

// ---------- Sacola (detalhada) ----------
function renderSacola() {
  const box = $('#sacolaItens');
  if (!state.carrinho.length) { 
    box.innerHTML = '<p class="carregando">Sacola vazia.</p>'; 
    return; 
  }
  box.innerHTML = state.carrinho.map(i => `
    <div class="item-sacola">
      <div class="info">
        <b>${i.quantidade}x ${i.nome}</b>
        <small>${i.adicionais && i.adicionais.length ? '+ ' + i.adicionais.map(a => a.nome).join(', ') : ''}</small>
      </div>
      <div class="mini-stepper">
        <button data-acao="-1" data-chave="${i.chave}">-</button>
        <button data-acao="1" data-chave="${i.chave}">+</button>
      </div>
      <span class="preco">${fmt(i.subtotal)}</span>
    </div>`).join('');
  box.querySelectorAll('button').forEach(b => 
    b.onclick = () => mudarQtd(b.dataset.chave, +b.dataset.acao)
  );
  const taxa = state.entrega?.taxa;
  const tempo = state.entrega?.tempo;
  $('#sumSubtotal').textContent = fmt(subtotalCarrinho());
  if (taxa != null) {
    $('#sumEntrega').textContent = fmt(taxa) + (tempo ? ` (~${tempo} min)` : '');
  } else {
    $('#sumEntrega').textContent = 'Calcular endereço';
  }
  $('#sumTotal').textContent = fmt(subtotalCarrinho() + (taxa || 0));
}

// ---------- Endereco e Cálculo de Entrega ----------
function renderizarResumoEndereco() {
  const e = state.endereco;
  $('#resumoEndereco').textContent = e
    ? (e.endereco + ', ' + e.numero + ' - ' + e.bairro + ' >') : 'Informe seu endereco >';
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

// === FUNÇÃO PRINCIPAL: CALCULAR ENTREGA ===
async function calcularEntrega() {
  if (!state.endereco) {
    state.entrega = null;
    return null;
  }
  // Cache: se o endereço não mudou, reutiliza
  const hash = JSON.stringify(state.endereco);
  if (state.entrega && state.entrega._enderecoHash === hash) {
    console.log('🔄 Usando cache da entrega:', state.entrega);
    return state.entrega;
  }
  try {
    console.log('📡 Chamando API de entrega com:', state.endereco);
    const r = await fetch(API + '/calculo-de-entrega', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.endereco)
    });
    const d = await r.json();
    console.log('📦 Resposta da API:', d);

    if (d.bloqueada) {
      state.entrega = { bloqueada: true, mensagem: d.mensagem };
      atualizarBarraSacola();
      return state.entrega;
    }
    if (d.status === false && d.motivo === 'endereco_vazio') {
      state.entrega = null;
      return null;
    }
    d._enderecoHash = hash;
    state.entrega = d;
    // Atualiza todas as interfaces
    atualizarBarraSacola();
    if ($('#sheetSacola').classList.contains('aberto')) renderSacola();
    if ($('#sheetPagamento').classList.contains('aberto')) {
      atualizarTotalCheckout();
    }
    console.log('✅ Entrega calculada: taxa=', d.taxa, 'tempo=', d.tempo);
    return d;
  } catch (e) {
    console.error('❌ Erro ao calcular entrega:', e);
    state.entrega = null;
    return null;
  }
}

// === SALVAR ENDEREÇO (AGORA CHAMA A API) ===
async function salvarEndereco() {
  const e = {
    cep: fCep.value.trim(), endereco: fEndereco.value.trim(), numero: fNumero.value.trim(),
    bairro: fBairro.value.trim(), cidade: fCidade.value.trim(), uf: fUf.value.trim().toUpperCase(),
    complemento: fComplemento.value.trim(), referencia: fReferencia.value.trim()
  };
  if (!e.cep || !e.endereco || !e.numero) return alert('Preencha CEP, rua e numero.');
  state.endereco = e;
  state.entrega = null;
  salvar();
  renderizarResumoEndereco();
  // Chama a API
  await calcularEntrega();
  const prox = state._voltarPara;
  state._voltarPara = null;
  fecharSheets();
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
  else if (tipo === 'novo') ico = `<span class="ls-ico">${SVG_INFO}</span>`;
  else if (tipo === 'erro') ico = `<span class="ls-ico">${SVG_INFO}</span>`;
  el.className = 'login-status ' + tipo;
  el.innerHTML = ico + '<span>' + msg + '</span>';
  el.hidden = false;
}

function montarEnderecoDoCliente(cli) {
  if (!cli) return null;
  const end = String(cli.endereco || '').trim();
  const num = String(cli.numero || '').trim();
  const bai = String(cli.bairro || '').trim();
  if (!end || !num || !bai) return null;
  if (end.indexOf(' - ') !== -1 || end.indexOf('/') !== -1) return null;
  return {
    endereco: end, numero: num, complemento: String(cli.complemento || '').trim(),
    bairro: bai, cidade: String(cli.cidade || '').trim(), uf: String(cli.uf || '').trim(),
    cep: String(cli.cep || '').replace(/\D/g, ''), referencia: String(cli.referencia || '').trim()
  };
}

function renderClienteCard(cli) {
  const card = $('#clienteCard');
  const tel = formatarTel(cli.telefone);
  const est = montarEnderecoDoCliente(cli);
  let endHtml = '';
  if (est) {
    const partes = [est.endereco + ', ' + est.numero, est.bairro, est.cep].filter(Boolean);
    endHtml = '<div class="cc-end">' + partes.join(' - ') + '</div>';
  }
  card.className = 'cliente-card identificado';
  card.innerHTML = `
    <div class="cc-selo">${SVG_CHECK}</div>
    <div class="cc-info">
      <div class="cc-label">Cliente identificado</div>
      <div class="cc-nome">${cli.nome || ''}</div>
      <div class="cc-tel">${tel}</div>
      ${endHtml}
    </div>
  `;
}

function mostrarClientePronto(cli) {
  state._loginFase = 'pronto';
  $('#loginTel').value = formatarTel(cli.telefone);
  $('#loginNomeWrap').classList.add('oculto');
  renderClienteCard(cli);
  setLoginStatus('ok', 'Identificado! Confirme seus dados para continuar.');
  const btn = $('#btnLoginAcao');
  btn.textContent = 'Continuar para pagamento';
  btn.disabled = false;
}

function abrirSheetLogin() {
  if (state.cliente && state.cliente.telefone) {
    mostrarClientePronto(state.cliente);
  } else {
    state._loginFase = 'identificar';
    $('#loginNomeWrap').classList.add('oculto');
    $('#loginNome').value = '';
    $('#loginTel').value = '';
    $('#clienteCard').className = 'cliente-card oculto';
    $('#clienteCard').innerHTML = '';
    setLoginStatus('', '');
    const btn = $('#btnLoginAcao');
    btn.textContent = 'Continuar';
    btn.disabled = true;
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
    btn.disabled = true;
    setLoginStatus('buscando', 'Buscando seu cadastro...');
    try {
      const r = await fetch(API + '/clientes/telefone/' + tel);
      const d = await r.json();
      if (d && d.encontrado && d.cliente) {
        const cli = d.cliente;
        state.cliente = { id: cli.id, nome: cli.nome, telefone: tel };
        const est = montarEnderecoDoCliente(cli);
        if (est && !state.endereco) state.endereco = est;
        salvarClienteLocal();
        mostrarClientePronto(state.cliente);
        if (est) renderClienteCard(cli);
      } else {
        state._loginFase = 'novo';
        $('#loginNomeWrap').classList.remove('oculto');
        $('#loginNome').value = '';
        setLoginStatus('novo', 'Numero novo! Informe seu nome completo para criar seu cadastro.');
        btn.textContent = 'Cadastrar e continuar';
        btn.disabled = true;
        setTimeout(() => { const n = $('#loginNome'); if (n) n.focus(); }, 160);
      }
    } catch (e) {
      setLoginStatus('erro', 'Erro ao consultar. Verifique a conexao e tente de novo.');
      btn.disabled = false;
    }
    return;
  }
  if (fase === 'novo') {
    const nome = $('#loginNome').value.trim();
    if (nome.length < 3) return;
    state.cliente = { nome: nome, telefone: tel, novo: true };
    salvarClienteLocal();
    setLoginStatus('ok', 'Cadastro criado! Vamos finalizar seu pedido.');
    btn.disabled = true;
    setTimeout(aposIdentificacao, 450);
    return;
  }
}

function aposIdentificacao() {
  fecharSheets();
  if (!state.endereco) {
    state._voltarPara = 'pagamento';
    preencherFormEndereco();
    abrirSheet('#sheetEndereco');
  } else {
    state._voltarPara = null;
    // Recalcula a entrega antes de abrir pagamento
    calcularEntrega().then(() => abrirPagamento());
  }
}

function atualizarValidacaoLogin() {
  const fase = state._loginFase || 'identificar';
  const btn = $('#btnLoginAcao');
  if (fase === 'pronto') return;
  const tel = $('#loginTel').value.replace(/\D/g, '');
  if (fase === 'identificar') { btn.disabled = tel.length < 10; return; }
  if (fase === 'novo') { btn.disabled = tel.length < 10 || $('#loginNome').value.trim().length < 3; }
}

// ---------- Checkout ----------
async function continuarCheckout() {
  if (!state.carrinho.length) return;
  if (state.loja && !state.loja.aberta) return alert('A loja esta fechada no momento.');
  fecharSheets();
  if (!state.cliente || !state.cliente.telefone) { abrirSheetLogin(); return; }
  if (!state.endereco) {
    state._voltarPara = 'pagamento';
    preencherFormEndereco();
    abrirSheet('#sheetEndereco');
    return;
  }
  // Se não calculou a entrega ou está bloqueada, recalcula
  if (!state.entrega || state.entrega.bloqueada) {
    await calcularEntrega();
    if (!state.entrega || state.entrega.bloqueada) {
      state._voltarPara = 'pagamento';
      preencherFormEndereco();
      abrirSheet('#sheetEndereco');
      return;
    }
  }
  abrirPagamento();
}

function abrirPagamento() {
  const cli = state.cliente || {};
  $('#resumoCliente').innerHTML = `
    <div class="cliente-card identificado">
      <div class="cc-selo">${SVG_CHECK}</div>
      <div class="cc-info">
        <div class="cc-label">Cliente</div>
        <div class="cc-nome">${cli.nome || ''}</div>
        <div class="cc-tel">${formatarTel(cli.telefone)}</div>
      </div>
      <a href="#" id="trocarCliente" class="cc-trocar">Trocar</a>
    </div>
  `;
  $('#trocarCliente').onclick = ev => {
    ev.preventDefault();
    state.cliente = null; salvarClienteLocal();
    abrirSheetLogin();
  };

  const e = state.endereco;
  const entrega = state.entrega;
  if (e) {
    let taxaHtml = 'Calculando...';
    let kmHtml = '?';
    if (entrega) {
      if (entrega.bloqueada) {
        taxaHtml = '<span style="color:red;">Fora da área</span>';
        kmHtml = entrega.km ? entrega.km.toFixed(1) : '?';
      } else {
        taxaHtml = fmt(entrega.taxa || 0);
        kmHtml = entrega.km != null ? entrega.km.toFixed(1) : '?';
      }
    }
    $('#resumoEnderecoCheckout').innerHTML = `
      <b>${e.endereco}, ${e.numero}</b> ${e.complemento ? '- ' + e.complemento : ''}<br>
      ${e.bairro} - ${e.cidade}/${e.uf} - CEP ${e.cep}<br>
      Entrega: <b>${taxaHtml}</b> (~${kmHtml} km)
      <br><a href="#" id="trocarEndereco" style="color:#EA1D2C;font-weight:700">Trocar endereco</a>
    `;
  } else {
    $('#resumoEnderecoCheckout').innerHTML = 'Endereço não definido. <a href="#" id="trocarEndereco" style="color:#EA1D2C;font-weight:700">Adicionar</a>';
  }

  // Evento para trocar endereço
  $('#trocarEndereco')?.addEventListener('click', ev => {
    ev.preventDefault();
    state.entrega = null;
    state._voltarPara = 'pagamento';
    preencherFormEndereco();
    abrirSheet('#sheetEndereco');
  });

  // Atualiza os totais
  atualizarTotalCheckout();

  abrirSheet('#sheetPagamento');
}

// Função para atualizar os totais no checkout
function atualizarTotalCheckout() {
  const subtotal = subtotalCarrinho();
  const taxa = state.entrega?.taxa || 0;
  const total = subtotal + taxa;
  const elSub = document.getElementById('sumSubtotalCheckout');
  const elTaxa = document.getElementById('sumEntregaCheckout');
  const elTotal = document.getElementById('totalCheckout');
  if (elSub) elSub.textContent = fmt(subtotal);
  if (elTaxa) elTaxa.textContent = fmt(taxa);
  if (elTotal) elTotal.textContent = fmt(total);
}

// ---------- Fazer Pedido ----------
async function fazerPedido() {
  if (!state.cliente || !state.cliente.nome || !state.cliente.telefone) {
    alert('Identifique-se antes de finalizar o pedido.');
    abrirSheetLogin();
    return;
  }
  const pagamento = document.querySelector('input[name="pagamento"]:checked').value;
  const taxa = state.entrega?.taxa || 0;
  const total = subtotalCarrinho() + taxa;

  const body = {
    nome: state.cliente.nome,
    telefone: String(state.cliente.telefone).replace(/\D/g, ''),
    ...state.endereco,
    pagamento,
    taxa_entrega: taxa,
    distancia_km: state.entrega?.km || 0,
    total: +total.toFixed(2),
    itens: state.carrinho.map(i => ({
      id: i.id, nome: i.nome, preco: i.preco, quantidade: i.quantidade,
      subtotal: i.subtotal, adicionais: i.adicionais
    }))
  };

  const btn = $('#btnFazerPedido');
  btn.disabled = true; btn.textContent = 'Enviando pedido...';
  try {
    const r = await fetch(API + '/pedidos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const pedido = await r.json();
    if (!r.ok) throw new Error(pedido.erro || 'Erro ao salvar');
    state.pedidoAtual = pedido.pedido_id;
    state.carrinho = []; salvar(); atualizarBarraSacola();
    fecharSheets();
    pagamento === 'PIX' ? await gerarPix(pedido.pedido_id) : mostrarStatusSemPix(pedido.pedido_id);
  } catch (e) {
    alert('Nao foi possivel fazer o pedido: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Fazer pedido';
  }
}

// ---------- PIX ----------
async function gerarPix(pedidoId) {
  abrirSheet('#sheetPix');
  $('#pixTitulo').textContent = 'Pague com PIX - Pedido #' + pedidoId;
  $('#statusPedido').className = 'status-pedido';
  $('#statusPedido').textContent = 'Gerando QR Code...';
  try {
    const r = await fetch(API + '/pix/criar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: pedidoId })
    });
    const pix = await r.json();
    if (!r.ok) throw new Error(pix.erro);
    $('#pixQr').src = 'data:image/png;base64,' + pix.qr_code_base64;
    $('#pixCopia').value = pix.qr_code;
    pollStatus(pedidoId);
  } catch (e) {
    $('#statusPedido').textContent = 'Erro: ' + e.message + ' - chame no WhatsApp.';
  }
}

function mostrarStatusSemPix(pedidoId) {
  abrirSheet('#sheetPix');
  $('#pixTitulo').textContent = 'Pedido #' + pedidoId + ' recebido!';
  $('#pixQr').classList.add('oculto');
  $('#pixCopia').classList.add('oculto');
  $('#btnCopiarPix').classList.add('oculto');
  $('.pix-info').textContent = 'Preparamos seu pedido. Pagamento na entrega.';
  pollStatus(pedidoId);
}

function pollStatus(pedidoId) {
  const mapa = {
    AGUARDANDO_PIX: 'Aguardando pagamento...', PENDENTE: 'Pagamento pendente...',
    PAGO: 'Pagamento confirmado!', CONFIRMADO: 'Pedido em preparacao...',
    PREPARANDO: 'Pedido em preparacao...', SAIU_PARA_ENTREGA: 'Saiu para entrega!',
    ENTREGUE: 'Pedido entregue. Bom apetite!'
  };
  const timer = setInterval(async () => {
    try {
      const r = await fetch(API + '/pedidos/' + pedidoId + '/status');
      const s = await r.json();
      const chave = s.status_pagamento === 'APPROVED' || s.status_pagamento === 'PAGO' ? 'PAGO' : s.status;
      $('#statusPedido').textContent = mapa[chave] || mapa[s.status] || ('Status: ' + s.status);
      if (chave === 'PAGO' || chave === 'CONFIRMADO') $('#statusPedido').classList.add('ok');
      if (s.status === 'ENTREGUE' || s.status === 'CANCELADO') clearInterval(timer);
    } catch (e) {}
  }, 10000);
}

// ---------- Eventos ----------
function eventos() {
  $('#inputBusca').oninput = e => { state.filtro = e.target.value; renderCardapio(); };
  $('#btnEndereco').onclick = () => {
    state._voltarPara = null;
    preencherFormEndereco(); abrirSheet('#sheetEndereco');
  };
  $('#fCep').addEventListener('blur', autocompletarCep);
  $('#btnSalvarEndereco').onclick = salvarEndereco;
  $('#btnVerSacola').onclick = () => { renderSacola(); abrirSheet('#sheetSacola'); };
  $('#btnContinuar').onclick = continuarCheckout;
  $('#btnFazerPedido').onclick = fazerPedido;
  $('#prodMenos').onclick = () => { state.qtd = Math.max(1, state.qtd - 1);
    $('#prodQtd').textContent = state.qtd; atualizarTotalProduto(); };
  $('#prodMais').onclick = () => { state.qtd++; $('#prodQtd').textContent = state.qtd; atualizarTotalProduto(); };
  $('#btnAddCarrinho').onclick = addAoCarrinho;
  $('#btnCopiarPix').onclick = async () => {
    await navigator.clipboard.writeText($('#pixCopia').value);
    $('#btnCopiarPix').textContent = 'Codigo copiado!';
    setTimeout(() => $('#btnCopiarPix').textContent = 'Copiar codigo PIX', 2000);
  };
  document.querySelectorAll('input[name="pagamento"]').forEach(r => r.onchange = () => {
    document.querySelectorAll('.opcao-pagamento').forEach(o => o.classList.remove('selecionada'));
    r.closest('.opcao-pagamento').classList.add('selecionada');
  });

  // login
  $('#btnLoginAcao').onclick = acaoLogin;
  $('#loginTel').addEventListener('input', () => {
    const tel = $('#loginTel').value.replace(/\D/g, '');
    $('#loginTel').value = tel ? formatarTel(tel) : '';
    atualizarValidacaoLogin();
  });
  $('#loginNome').addEventListener('input', atualizarValidacaoLogin);
}

// ---------- Iniciar ----------
init();