// ============================================================
// PAINEL DE ATENDIMENTO - Churrasquinho Do Chef
// VERSÃO COM DEPURAÇÃO E BOTÃO PIX CORRIGIDO
// ============================================================

const $ = s => document.querySelector(s);
const API = '/api';
const BOT_URL = window.location.origin + ':4000';
const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ===== ESTADO =====
const state = {
  produtos: [],
  carrinho: [],
  pedidoId: null,
  entrega: null,
  tipoPedido: 'entrega',
  pagamento: 'PIX',
  valorTotal: 0,
  qrCodeBase64: null,
  qrCode: null
};

// ============================================================
// 1. CARREGAR DADOS
// ============================================================
async function carregarLoja() {
  try {
    const r = await fetch(API + '/loja/status');
    const loja = await r.json();
    $('#infoLoja').textContent = `${loja.nome_empresa} - ${loja.aberta ? '🟢 Aberto' : '🔴 Fechado'}`;
  } catch (e) {
    $('#infoLoja').textContent = 'Erro ao carregar loja';
  }
}

async function carregarProdutos() {
  try {
    const r = await fetch(API + '/produtos');
    if (!r.ok) throw new Error('Erro ao carregar produtos');
    state.produtos = await r.json();
    renderizarProdutos();
  } catch (e) {
    $('#listaProdutos').innerHTML = `<p class="erro">Erro: ${e.message}</p>`;
  }
}

// ============================================================
// 2. RENDERIZAR PRODUTOS
// ============================================================
function renderizarProdutos(filtro = '') {
  const container = $('#listaProdutos');
  const termo = filtro.toLowerCase();
  let prods = state.produtos;
  if (termo) {
    prods = prods.filter(p =>
      p.nome.toLowerCase().includes(termo) ||
      (p.descricao || '').toLowerCase().includes(termo)
    );
  }
  if (!prods.length) {
    container.innerHTML = '<p>Nenhum produto encontrado.</p>';
    return;
  }
  container.innerHTML = prods.map(p => `
    <div class="produto-item" data-id="${p.id}">
      <div class="info">
        <strong>${p.nome}</strong> - ${fmt(p.preco)}
        <br><small>${p.descricao || ''}</small>
      </div>
      <div>
        <button class="btn-pequeno adicionar-produto" data-id="${p.id}" data-preco="${p.preco}" data-nome="${p.nome}">+ Adicionar</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.adicionar-produto').forEach(btn => {
    btn.addEventListener('click', function() {
      const id = parseInt(this.dataset.id);
      const nome = this.dataset.nome;
      const preco = parseFloat(this.dataset.preco);
      adicionarAoCarrinho(id, nome, preco);
    });
  });
}

// ============================================================
// 3. CARRINHO
// ============================================================
function adicionarAoCarrinho(id, nome, preco) {
  const existente = state.carrinho.find(i => i.id === id);
  if (existente) {
    existente.quantidade += 1;
    existente.subtotal = existente.quantidade * existente.preco;
  } else {
    state.carrinho.push({ id, nome, preco, quantidade: 1, subtotal: preco });
  }
  atualizarSacola();
  if (state.tipoPedido === 'entrega' && temEnderecoCompleto()) {
    calcularEntrega();
  }
}

function removerDoCarrinho(id) {
  const index = state.carrinho.findIndex(i => i.id === id);
  if (index !== -1) {
    const item = state.carrinho[index];
    if (item.quantidade > 1) {
      item.quantidade -= 1;
      item.subtotal = item.quantidade * item.preco;
    } else {
      state.carrinho.splice(index, 1);
    }
    atualizarSacola();
    if (state.tipoPedido === 'entrega' && temEnderecoCompleto()) {
      calcularEntrega();
    }
  }
}

function limparCarrinho() {
  state.carrinho = [];
  state.entrega = null;
  atualizarSacola();
}

function temEnderecoCompleto() {
  const cep = $('#cliCep').value.replace(/\D/g, '');
  const rua = $('#cliRua').value.trim();
  const num = $('#cliNumero').value.trim();
  return cep.length === 8 && rua && num;
}

function atualizarSacola() {
  const container = $('#sacolaPainel');
  if (!state.carrinho.length) {
    container.innerHTML = '<p>Sacola vazia.</p>';
  } else {
    container.innerHTML = state.carrinho.map(i => `
      <div class="sacola-item">
        <span>${i.quantidade}x ${i.nome} - ${fmt(i.subtotal)}</span>
        <div>
          <button class="btn-pequeno remover-produto" data-id="${i.id}">-</button>
          <button class="btn-pequeno adicionar-produto" data-id="${i.id}" data-preco="${i.preco}" data-nome="${i.nome}">+</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.remover-produto').forEach(btn => {
      btn.addEventListener('click', function() {
        removerDoCarrinho(parseInt(this.dataset.id));
      });
    });
    container.querySelectorAll('.adicionar-produto').forEach(btn => {
      btn.addEventListener('click', function() {
        const id = parseInt(this.dataset.id);
        const nome = this.dataset.nome;
        const preco = parseFloat(this.dataset.preco);
        adicionarAoCarrinho(id, nome, preco);
      });
    });
  }
  atualizarTotais();
}

// ============================================================
// 4. CÁLCULO DE ENTREGA
// ============================================================
async function calcularEntrega() {
  if (!temEnderecoCompleto()) {
    state.entrega = null;
    atualizarTotais();
    return;
  }

  const body = {
    cep: $('#cliCep').value.replace(/\D/g, ''),
    endereco: $('#cliRua').value.trim(),
    numero: $('#cliNumero').value.trim(),
    bairro: $('#cliBairro').value.trim(),
    cidade: $('#cliCidade').value.trim(),
    uf: $('#cliUf').value.trim().toUpperCase()
  };

  try {
    const resp = await fetch(API + '/calculo-de-entrega', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await resp.json();

    if (data.bloqueada || !data.calculada) {
      state.entrega = { taxa: 0, km: 0, bloqueada: true, mensagem: data.mensagem || 'Endereço não encontrado' };
      mostrarStatus('⚠️ ' + (data.mensagem || 'Endereço fora da área de entrega.'), 'erro');
    } else {
      state.entrega = { taxa: data.taxa || 0, km: data.km || 0, bloqueada: false };
      mostrarStatus(`✅ Entrega calculada: ${data.km} km - Taxa: ${fmt(data.taxa)}`, 'sucesso');
    }
  } catch (e) {
    console.error('Erro ao calcular entrega:', e);
    state.entrega = { taxa: 0, km: 0, bloqueada: true, mensagem: 'Erro na API de entrega' };
    mostrarStatus('⚠️ Erro ao calcular entrega. Verifique a conexão.', 'erro');
  }
  atualizarTotais();
}

// ============================================================
// 5. TOTAIS
// ============================================================
function getTaxa() {
  if (state.tipoPedido === 'retirada') return 0;
  if (state.entrega && !state.entrega.bloqueada) return state.entrega.taxa || 0;
  return 0;
}

function subtotalCarrinho() {
  return state.carrinho.reduce((s, i) => s + i.subtotal, 0);
}

function totalPedido() {
  return subtotalCarrinho() + getTaxa();
}

function atualizarTotais() {
  const sub = subtotalCarrinho();
  const taxa = getTaxa();
  const total = sub + taxa;
  state.valorTotal = total;
  $('#subtotalPainel').textContent = fmt(sub);
  $('#taxaPainel').textContent = fmt(taxa);
  $('#totalPainel').textContent = fmt(total);
}

// ============================================================
// 6. COLETAR DADOS DO CLIENTE
// ============================================================
function getDadosCliente() {
  return {
    nome: $('#cliNome').value.trim(),
    telefone: $('#cliTelefone').value.replace(/\D/g, ''),
    endereco: {
      cep: $('#cliCep').value.replace(/\D/g, ''),
      endereco: $('#cliRua').value.trim(),
      numero: $('#cliNumero').value.trim(),
      bairro: $('#cliBairro').value.trim(),
      cidade: $('#cliCidade').value.trim(),
      uf: $('#cliUf').value.trim().toUpperCase(),
      complemento: $('#cliComplemento').value.trim(),
      referencia: $('#cliReferencia').value.trim()
    }
  };
}

// ============================================================
// 7. FUNÇÃO PARA ATUALIZAR O BOTÃO PIX (CORTA E SECA)
// ============================================================
function atualizarBotaoPix() {
  const pedidoExiste = state.pedidoId !== null && state.pedidoId !== undefined;
  const pagamentoPix = state.pagamento === 'PIX';
  const btn = $('#btnGerarPix');
  
  // REGRA: habilitar SOMENTE se pedido existe E pagamento é PIX
  const deveHabilitar = pedidoExiste && pagamentoPix;
  
  btn.disabled = !deveHabilitar;
  
  // Log de depuração
  console.log('🔍 [PIX] Estado do botão:');
  console.log('   - pedidoExiste:', pedidoExiste, '(ID:', state.pedidoId, ')');
  console.log('   - pagamentoPix:', pagamentoPix, '(pagamento:', state.pagamento, ')');
  console.log('   - deveHabilitar:', deveHabilitar);
  console.log('   - botão disabled:', btn.disabled);
  
  if (deveHabilitar) {
    btn.title = 'Gerar PIX para o pedido #' + state.pedidoId;
  } else {
    btn.title = pedidoExiste ? 'Selecione PIX como pagamento' : 'Crie o pedido primeiro';
  }
}

// ============================================================
// 8. ENVIAR PEDIDO
// ============================================================
async function enviarPedido() {
  const cliente = getDadosCliente();
  if (!cliente.nome || cliente.telefone.length < 10) {
    mostrarStatus('Preencha nome e WhatsApp do cliente.', 'erro');
    return;
  }
  if (state.carrinho.length === 0) {
    mostrarStatus('Adicione pelo menos um item à sacola.', 'erro');
    return;
  }

  if (state.tipoPedido === 'entrega') {
    if (!temEnderecoCompleto()) {
      mostrarStatus('Preencha CEP, rua e número para entrega.', 'erro');
      return;
    }
    if (!state.entrega || state.entrega.bloqueada) {
      await calcularEntrega();
      if (state.entrega && state.entrega.bloqueada) {
        mostrarStatus('Endereço fora da área de entrega. Verifique os dados.', 'erro');
        return;
      }
    }
  }

  const taxa = getTaxa();
  const total = totalPedido();

  const body = {
    nome: cliente.nome,
    telefone: cliente.telefone,
    ...cliente.endereco,
    tipo_pedido: state.tipoPedido,
    pagamento: state.pagamento,
    taxa_entrega: taxa,
    distancia_km: state.entrega?.km || 0,
    total: +total.toFixed(2),
    itens: state.carrinho.map(i => ({
      id: i.id, nome: i.nome, preco: i.preco, quantidade: i.quantidade,
      subtotal: i.subtotal, adicionais: []
    }))
  };

  const btn = $('#btnEnviarPedido');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    const r = await fetch(API + '/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const pedido = await r.json();
    if (!r.ok) throw new Error(pedido.erro || 'Erro ao salvar');

    // SALVA O ID DO PEDIDO
    state.pedidoId = pedido.pedido_id;
    mostrarStatus(`✅ Pedido #${state.pedidoId} criado com sucesso!`, 'sucesso');
    
    console.log('✅ Pedido criado com ID:', state.pedidoId);
    console.log('📌 Pagamento selecionado:', state.pagamento);

    // === FORÇA A ATUALIZAÇÃO DO BOTÃO PIX ===
    atualizarBotaoPix();

    // Se não for PIX, esconde a área
    if (state.pagamento !== 'PIX') {
      $('#pixArea').classList.add('oculto');
    }

  } catch (e) {
    mostrarStatus('❌ Erro: ' + e.message, 'erro');
    console.error('Erro ao criar pedido:', e);
  } finally {
    btn.disabled = false;
    btn.textContent = '📦 Enviar Pedido';
  }
}

// ============================================================
// 9. GERAR PIX
// ============================================================
async function gerarPix() {
  console.log('🔍 [PIX] Gerar PIX clicado!');
  console.log('   - pedidoId:', state.pedidoId);
  console.log('   - pagamento:', state.pagamento);
  
  if (!state.pedidoId) {
    mostrarStatus('Crie o pedido primeiro.', 'erro');
    return;
  }
  if (state.pagamento !== 'PIX') {
    mostrarStatus('Selecione PIX como forma de pagamento.', 'erro');
    return;
  }

  const btn = $('#btnGerarPix');
  btn.disabled = true;
  btn.textContent = 'Gerando...';

  try {
    console.log('📤 Chamando API PIX para pedido:', state.pedidoId);
    const r = await fetch(API + '/pix/criar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: state.pedidoId })
    });
    const pix = await r.json();
    if (!r.ok) throw new Error(pix.erro || 'Erro ao gerar PIX');

    console.log('✅ PIX gerado com sucesso!');
    state.qrCodeBase64 = pix.qr_code_base64;
    state.qrCode = pix.qr_code;

    // Exibe o PIX
    $('#pixArea').classList.remove('oculto');
    $('#pixPedidoId').textContent = state.pedidoId;
    $('#pixQrPainel').src = 'data:image/png;base64,' + pix.qr_code_base64;
    $('#pixCopiaPainel').value = pix.qr_code;

    mostrarStatus(`✅ PIX gerado para o pedido #${state.pedidoId}`, 'sucesso');

    // Envia via bot
    await enviarPixViaBot();

  } catch (e) {
    console.error('❌ Erro ao gerar PIX:', e);
    mostrarStatus('❌ Erro ao gerar PIX: ' + e.message, 'erro');
  } finally {
    btn.disabled = false;
    btn.textContent = '💳 Gerar PIX';
    // Reaplica o estado do botão
    atualizarBotaoPix();
  }
}

// ============================================================
// 10. ENVIAR PIX VIA BOT
// ============================================================
async function enviarPixViaBot() {
  const telefone = $('#cliTelefone').value.replace(/\D/g, '');
  if (!telefone) {
    mostrarStatus('Número de telefone não informado.', 'erro');
    return;
  }

  try {
    console.log('📤 Enviando PIX via bot para:', telefone);
    const resp = await fetch(`${BOT_URL}/enviar-pix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telefone: telefone,
        pedido_id: state.pedidoId,
        qr_code_base64: state.qrCodeBase64,
        qr_code: state.qrCode,
        valor: state.valorTotal
      })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.erro || 'Erro ao enviar PIX via bot');
    mostrarStatus('📱 PIX enviado com sucesso para o WhatsApp do cliente!', 'sucesso');
    console.log('✅ PIX enviado via bot com sucesso!');
  } catch (e) {
    console.error('❌ Erro ao enviar PIX via bot:', e);
    mostrarStatus('⚠️ PIX gerado, mas não foi possível enviar via WhatsApp. Envie manualmente.', 'erro');
  }
}

// ============================================================
// 11. ENVIAR PROMOÇÃO
// ============================================================
async function enviarPromocao() {
  const mensagem = $('#promocaoMensagem').value.trim();
  const imagem = $('#promocaoImagem').value.trim();
  if (!mensagem) {
    mostrarStatus('Digite uma mensagem para a promoção.', 'erro');
    return;
  }
  const btn = $('#btnEnviarPromocao');
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  const statusEl = $('#statusPromocao');

  try {
    const resp = await fetch(`${BOT_URL}/enviar-promocao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagem, imagem_url: imagem || undefined })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.erro || 'Erro ao enviar promoção');
    statusEl.textContent = `✅ Promoção enviada para ${data.enviados} clientes. Falhas: ${data.falhas}`;
    statusEl.className = 'sucesso';
    mostrarStatus(`Promoção enviada para ${data.enviados} clientes.`, 'sucesso');
  } catch (e) {
    console.error('Erro ao enviar promoção:', e);
    statusEl.textContent = `❌ Erro: ${e.message}`;
    statusEl.className = 'erro';
    mostrarStatus(`Erro ao enviar promoção: ${e.message}`, 'erro');
  } finally {
    btn.disabled = false;
    btn.textContent = '📢 Enviar para todos';
  }
}

// ============================================================
// 12. UTILITÁRIOS
// ============================================================
function mostrarStatus(msg, tipo = 'info') {
  const el = $('#statusMsg');
  el.textContent = msg;
  el.className = tipo;
}

function copiarPix() {
  const texto = $('#pixCopiaPainel').value;
  if (!texto) { mostrarStatus('Nenhum PIX gerado.', 'erro'); return; }
  navigator.clipboard.writeText(texto).then(() => {
    mostrarStatus('✅ Código PIX copiado!', 'sucesso');
  }).catch(() => {
    alert('Copie manualmente: ' + texto);
  });
}

function limparTudo() {
  if (!confirm('Tem certeza que deseja limpar todos os dados?')) return;
  $('#cliNome').value = '';
  $('#cliTelefone').value = '';
  $('#cliCep').value = '';
  $('#cliRua').value = '';
  $('#cliNumero').value = '';
  $('#cliBairro').value = '';
  $('#cliCidade').value = '';
  $('#cliUf').value = '';
  $('#cliComplemento').value = '';
  $('#cliReferencia').value = '';
  state.carrinho = [];
  state.pedidoId = null;
  state.entrega = null;
  state.qrCodeBase64 = null;
  state.qrCode = null;
  $('#pixArea').classList.add('oculto');
  $('#statusPromocao').textContent = '';
  $('#statusPromocao').className = '';
  atualizarSacola();
  atualizarBotaoPix(); // IMPORTANTE: atualiza o botão
  mostrarStatus('Dados limpos.', 'info');
}

// ============================================================
// 13. EVENTOS
// ============================================================
function initEventos() {
  // Busca produtos
  $('#inputBuscaPainel').addEventListener('input', function() {
    renderizarProdutos(this.value);
  });

  // Tipo de pedido
  $('#tipoPedidoPainel').addEventListener('change', function() {
    state.tipoPedido = this.value;
    if (state.tipoPedido === 'entrega' && temEnderecoCompleto()) {
      calcularEntrega();
    } else {
      state.entrega = null;
      atualizarTotais();
    }
  });

  // Forma de pagamento - ESSENCIAL para ativar o botão
  $('#pagamentoPainel').addEventListener('change', function() {
    state.pagamento = this.value;
    console.log('🔄 Pagamento alterado para:', state.pagamento);
    // ATUALIZA O BOTÃO IMEDIATAMENTE
    atualizarBotaoPix();
    // Se não for PIX, esconde a área
    if (state.pagamento !== 'PIX') {
      $('#pixArea').classList.add('oculto');
    }
  });

  // Calcular entrega
  $('#btnCalcularEntrega').addEventListener('click', function() {
    if (state.tipoPedido === 'entrega') {
      calcularEntrega();
    } else {
      mostrarStatus('Para calcular frete, selecione "Entregar" como tipo de pedido.', 'info');
    }
  });

  // CEP autopreenche
  $('#cliCep').addEventListener('blur', async function() {
    const cep = this.value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await r.json();
      if (data.erro) return;
      $('#cliRua').value = data.logradouro || '';
      $('#cliBairro').value = data.bairro || '';
      $('#cliCidade').value = data.localidade || '';
      $('#cliUf').value = data.uf || '';
      if (state.tipoPedido === 'entrega' && temEnderecoCompleto()) {
        await calcularEntrega();
      }
    } catch (e) { /* ignora */ }
  });

  // Auto-formatar telefone
  $('#cliTelefone').addEventListener('input', function() {
    this.value = formatarTel(this.value);
  });

  // Botões principais
  $('#btnEnviarPedido').addEventListener('click', enviarPedido);
  $('#btnGerarPix').addEventListener('click', gerarPix);
  $('#btnLimpar').addEventListener('click', limparTudo);
  $('#btnCopiarPixPainel').addEventListener('click', copiarPix);
  $('#btnEnviarWhatsApp').addEventListener('click', enviarPixViaBot);
  $('#btnEnviarPromocao').addEventListener('click', enviarPromocao);
}

// ============================================================
// 14. FORMATAR TELEFONE
// ============================================================
function formatarTel(d) {
  d = String(d || '').replace(/\D/g, '');
  if (d.length === 11) return '(' + d.slice(0,2) + ') ' + d.slice(2,7) + '-' + d.slice(7);
  if (d.length === 10) return '(' + d.slice(0,2) + ') ' + d.slice(2,6) + '-' + d.slice(6);
  return d;
}

// ============================================================
// 15. BOTÃO DE DEPURAÇÃO (OPCIONAL - REMOVA DEPOIS)
// ============================================================
// Adiciona um botão invisível para forçar a ativação (para testes)
// Pressione Ctrl+Shift+D no teclado para ativar
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    console.log('🔧 FORÇANDO HABILITAÇÃO DO BOTÃO PIX (DEBUG)');
    state.pedidoId = state.pedidoId || 999;
    state.pagamento = 'PIX';
    $('#pagamentoPainel').value = 'PIX';
    atualizarBotaoPix();
    mostrarStatus('🔧 Modo debug: botão PIX forçado!', 'info');
  }
});

// ============================================================
// 16. INICIALIZAÇÃO
// ============================================================
async function init() {
  await carregarLoja();
  await carregarProdutos();
  initEventos();
  atualizarSacola();
  
  // Estado inicial do botão
  state.pagamento = 'PIX';
  $('#pagamentoPainel').value = 'PIX';
  atualizarBotaoPix();
  
  console.log('✅ Painel de Atendimento carregado!');
  console.log('📌 Para debug: Ctrl+Shift+D para forçar ativação do PIX');
}

init();