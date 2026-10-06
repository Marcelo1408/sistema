import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Tela principal de pedidos
app.get('/', async (c) => {
  const config = await c.env.DB.prepare('SELECT * FROM configuracoes ORDER BY id ASC LIMIT 1').first() as any
  const lojaAberta = config?.loja_aberta === 1
  const expedienteInicio = config?.expediente_aberto_em

  // Dashboard
  let aguardando = 0, pagos = 0, preparo = 0, entregues = 0, emEntrega = 0, faturamento = 0
  let whereExpediente = '1=0'
  
  if (lojaAberta && expedienteInicio) {
    whereExpediente = `criado_em >= '${expedienteInicio}'`
    
    const r1 = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM pedidos WHERE ${whereExpediente} AND (status='AGUARDANDO_PAGAMENTO' OR status='AGUARDANDO_PIX')`).first() as any
    aguardando = r1?.total || 0
    
    const r2 = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM pedidos WHERE ${whereExpediente} AND status='PAGO'`).first() as any
    pagos = r2?.total || 0
    
    const r3 = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM pedidos WHERE ${whereExpediente} AND status='EM_PREPARO'`).first() as any
    preparo = r3?.total || 0
    
    const r4 = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM pedidos WHERE ${whereExpediente} AND (status='ENTREGUE' OR status='CONFIRMADO_CLIENTE')`).first() as any
    entregues = r4?.total || 0

    const rEntrega = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM pedidos WHERE ${whereExpediente} AND status='SAIU_ENTREGA'`).first() as any
    emEntrega = rEntrega?.total || 0
    
    const r5 = await c.env.DB.prepare(`SELECT COALESCE(SUM(total),0) as total FROM pedidos WHERE ${whereExpediente}`).first() as any
    faturamento = r5?.total || 0
  }

  const filtro = c.req.query('filtro') || ''
  let where = 'WHERE 1=0'
  if (lojaAberta && expedienteInicio) {
    where = `WHERE p.criado_em >= '${expedienteInicio}'`
    if (filtro) where += ` AND p.status='${filtro}'`
  }

  const pedidos = await c.env.DB.prepare(`
    SELECT p.*, c.nome, c.telefone, c.bairro, com.mesa_numero, com.nome_cliente AS comanda_cliente,
           e.nome AS entregador_nome
    FROM pedidos p
    LEFT JOIN clientes c ON c.id = p.cliente_id
    LEFT JOIN comandas com ON com.pedido_id = p.id
    LEFT JOIN (
      SELECT pedido_id, entregador_id FROM entregas WHERE status IN ('ATRIBUIDA', 'A_CAMINHO')
    ) ent ON ent.pedido_id = p.id
    LEFT JOIN entregadores e ON e.id = ent.entregador_id
    ${where}
    ORDER BY p.id DESC
  `).all()

  const conteudo = `
    <style>
      .top-controls { display: flex; gap: 15px; align-items: center; margin-bottom: 20px; flex-wrap: wrap; }
      .btn-loja { padding: 12px 24px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px; }
      .btn-loja.abrir { background: #28a745; color: white; }
      .btn-loja.fechar { background: #dc3545; color: white; }
      .status-loja { padding: 8px 16px; border-radius: 20px; font-weight: bold; }
      .status-loja.aberta { background: #d4edda; color: #155724; }
      .status-loja.fechada { background: #f8d7da; color: #721c24; }
      .btn-som { padding: 8px 16px; border: 1px solid #ddd; border-radius: 8px; background: white; cursor: pointer; }
      .btn-som.ativo { background: #17a2b8; color: white; border-color: #17a2b8; }
      .info-expediente { background: #e7f3ff; padding: 12px; border-radius: 8px; margin-bottom: 20px; }
      .loja-fechada-banner { background: #fff3cd; padding: 30px; border-radius: 15px; text-align: center; margin-bottom: 20px; }
      .dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 25px; }
      .card-info { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.05); text-align: center; }
      .card-info h2 { font-size: 32px; color: #ff6b00; margin: 0; }
      .card-info p { color: #666; margin: 5px 0 0; font-size: 14px; }
      .filtros { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
      .filtros a { padding: 8px 16px; background: white; border-radius: 20px; text-decoration: none; color: #333; border: 1px solid #ddd; font-size: 14px; }
      .filtros a:hover, .filtros a.ativo { background: #ff6b00; color: white; border-color: #ff6b00; }
      .pedidos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
      .pedido-card { background: white; border-radius: 15px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,.08); transition: 0.3s; position: relative; }
      .pedido-card.novo-pedido { animation: piscar 1s infinite; border: 3px solid #ff6b00; }
      @keyframes piscar { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      .pedido-card h3 { margin: 0 0 10px; color: #333; }
      .pedido-card p { margin: 5px 0; color: #555; }
      .status { display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin: 10px 0; }
      .status.AGUARDANDO_PIX { background: #ffc107; color: #000; }
      .status.PAGO { background: #28a745; color: white; }
      .status.EM_PREPARO { background: #17a2b8; color: white; }
      .status.PRONTO { background: #007bff; color: white; }
      .status.SAIU_ENTREGA { background: #6f42c1; color: white; }
      .status.ENTREGUE { background: #20c997; color: white; }
      .status.CANCELADO { background: #dc3545; color: white; }
      .status.COMANDA_ABERTA { background: #e83e8c; color: white; }
      .entregador-badge { background: #6f42c1; color: white; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin: 8px 0; display: inline-block; }
      .acoes { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 15px; }
      .acoes a, .acoes button { padding: 6px 12px; border-radius: 5px; text-decoration: none; font-size: 13px; font-weight: bold; border: none; cursor: pointer; }
      .btn.ver { background: #6c757d; color: white; }
      .btn.pago { background: #28a745; color: white; }
      .btn.preparo { background: #17a2b8; color: white; }
      .btn.pronto { background: #007bff; color: white; }
      .btn.entrega { background: #ff6b00; color: white; }
      .btn.entregue { background: #20c997; color: white; }
      .btn.cancelar { background: #dc3545; color: white; }
      .btn.excluir { background: #000; color: white; }
      .vazio { text-align: center; padding: 60px; background: white; border-radius: 15px; }
      .vazio h2 { font-size: 60px; margin: 0; }
      .badge-novo { position: absolute; top: 10px; right: 10px; background: #ff6b00; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; }
    </style>

    <div class="top-controls">
      <button id="btnLoja" class="btn-loja ${lojaAberta ? 'fechar' : 'abrir'}" onclick="toggleLoja()">
        ${lojaAberta ? '🔴 Fechar Loja' : '🟢 Abrir Loja'}
      </button>
      <span id="statusLoja" class="status-loja ${lojaAberta ? 'aberta' : 'fechada'}">
        ${lojaAberta ? '🟢 Loja Aberta' : '🔴 Loja Fechada'}
      </span>
      <button id="btnSom" class="btn-som" onclick="toggleSom()">🔇 Som Desativado</button>
    </div>

    ${lojaAberta ? `
      <div class="info-expediente">
        <strong>📅 Expediente Atual:</strong> Mostrando pedidos desde ${new Date(expedienteInicio).toLocaleString('pt-BR')}
      </div>
    ` : `
      <div class="loja-fechada-banner">
        <h2>🔴 Loja Fechada</h2>
        <p>Os pedidos antigos não estão sendo exibidos. Clique em "Abrir Loja" para iniciar um novo expediente limpo.</p>
      </div>
    `}

    <div class="dashboard">
      <div class="card-info"><h2>${aguardando}</h2><p>Aguardando Pagamento</p></div>
      <div class="card-info"><h2>${pagos}</h2><p>Pagos</p></div>
      <div class="card-info"><h2>${preparo}</h2><p>Em Preparo</p></div>
      <div class="card-info"><h2>${emEntrega}</h2><p>Em Entrega</p></div>
      <div class="card-info"><h2>${entregues}</h2><p>Entregues</p></div>
      <div class="card-info"><h2>R$ ${parseFloat(faturamento).toFixed(2).replace('.', ',')}</h2><p>Faturamento Hoje</p></div>
    </div>

    <div class="filtros">
      <a href="/pedidos" class="${!filtro ? 'ativo' : ''}">Todos</a>
      <a href="?filtro=AGUARDANDO_PIX" class="${filtro === 'AGUARDANDO_PIX' ? 'ativo' : ''}">Aguardando PIX</a>
      <a href="?filtro=PAGO" class="${filtro === 'PAGO' ? 'ativo' : ''}">Pago</a>
      <a href="?filtro=EM_PREPARO" class="${filtro === 'EM_PREPARO' ? 'ativo' : ''}">Preparo</a>
      <a href="?filtro=PRONTO" class="${filtro === 'PRONTO' ? 'ativo' : ''}">Pronto</a>
      <a href="?filtro=SAIU_ENTREGA" class="${filtro === 'SAIU_ENTREGA' ? 'ativo' : ''}">🛵 Em Entrega</a>
      <a href="?filtro=ENTREGUE" class="${filtro === 'ENTREGUE' ? 'ativo' : ''}">Entregue</a>
      <a href="?filtro=COMANDA_ABERTA" class="${filtro === 'COMANDA_ABERTA' ? 'ativo' : ''}">🧾 Comandas</a>
    </div>

    ${(pedidos.results as any[]).length === 0 ? `
      <div class="vazio">
        <h2>🍢</h2>
        <h3>${lojaAberta ? 'Aguardando novos pedidos' : 'Loja fechada'}</h3>
        <p>${lojaAberta ? 'Nenhum pedido encontrado desde a abertura deste expediente.' : 'Abra a loja para iniciar um novo expediente.'}</p>
      </div>
    ` : `
      <div class="pedidos-grid">
        ${(pedidos.results as any[]).map((p: any) => `
          <div class="pedido-card" data-id="${p.id}">
            <h3>Pedido #${p.id} ${p.origem === 'COMANDA' ? '🧾' : ''}</h3>
            ${p.origem === 'COMANDA' ? `
              <p><strong>🍽️ Mesa ${p.mesa_numero || '-'}</strong></p>
              <p>👤 ${p.comanda_cliente || p.nome || 'Cliente não informado'}</p>
              <p>🏪 Atendimento presencial</p>
            ` : `
              <p><strong>${p.nome || 'Cliente não encontrado'}</strong></p>
              <p>📞 ${p.telefone || '-'}</p>
              <p>📍 ${p.bairro || '-'}</p>
            `}
            <p>💰 R$ ${parseFloat(p.total).toFixed(2).replace('.', ',')}</p>
            <p>Origem: ${p.origem}</p>
            <span class="status ${p.status}">${(p.status || '').replace(/_/g, ' ')}</span>
            ${p.entregador_nome ? `<div class="entregador-badge">🛵 ${p.entregador_nome}</div>` : ''}
            <div class="acoes">
              <a href="/pedidos/detalhes/${p.id}" class="btn ver">Ver</a>
              <a href="/pedidos/imprimir/${p.id}" target="_blank" class="btn ver">🖨️</a>
              ${!p.entregador_nome && p.status !== 'ENTREGUE' && p.status !== 'CANCELADO' ? `
                <button class="btn entrega" onclick="atribuirEntrega(${p.id})">🛵 Entregar</button>
              ` : ''}
              <a href="/api/pedidos/status/${p.id}/PAGO" class="btn pago">Pago</a>
              <a href="/api/pedidos/status/${p.id}/EM_PREPARO" class="btn preparo">Preparo</a>
              <a href="/api/pedidos/status/${p.id}/PRONTO" class="btn pronto">Pronto</a>
              <a href="/api/pedidos/status/${p.id}/ENTREGUE" class="btn entregue">Entregue</a>
              <a href="/api/pedidos/status/${p.id}/CANCELADO" class="btn cancelar">Cancelar</a>
              <a href="/pedidos/excluir/${p.id}" class="btn excluir" onclick="return confirm('⚠️ EXCLUIR DEFINITIVAMENTE o Pedido #${p.id}?\\n\\nIsso removerá:\\n- Todos os itens do pedido\\n- Atribuição de entregador\\n- Comanda (se houver)\\n- Lançamento financeiro\\n\\nEsta ação não pode ser desfeita!')">🗑️ Excluir</a>
            </div>
          </div>
        `).join('')}
      </div>
    `}

    <script>
      let somAtivado = localStorage.getItem('somAtivado') === '1';
      
      function beep() {
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = 880;
          gain.gain.value = 0.4;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          setTimeout(() => { osc.stop(); ctx.close(); }, 900);
        } catch(e) {}
      }

      async function toggleLoja() {
        const res = await fetch('/api/pedidos/toggle-loja');
        const data = await res.json();
        if (data.sucesso) {
          localStorage.removeItem('pedidosAbertos');
          location.reload();
        }
      }

      function toggleSom() {
        somAtivado = !somAtivado;
        localStorage.setItem('somAtivado', somAtivado ? '1' : '0');
        const btn = document.getElementById('btnSom');
        if (somAtivado) {
          btn.textContent = '🔊 Som Ativado';
          btn.classList.add('ativo');
          beep();
        } else {
          btn.textContent = '🔇 Som Desativado';
          btn.classList.remove('ativo');
        }
      }

      async function atribuirEntrega(pedidoId) {
        if (!confirm('Enviar este pedido para entrega agora?')) return;
        const r = await fetch('/api/entregadores/atribuir/' + pedidoId);
        const d = await r.json();
        if (d.sucesso) {
          alert('🛵 Pedido atribuído a ' + d.entregador + '!');
          location.reload();
        } else {
          alert('⚠️ ' + d.erro);
        }
      }

      async function verificarNovosPedidos() {
        try {
          const res = await fetch('/api/pedidos/ultimo-pedido');
          const data = await res.json();
          const ultimo = parseInt(data.ultimo || 0);
          if (window.ultimoPedido === undefined) {
            window.ultimoPedido = ultimo;
            return;
          }
          if (ultimo > window.ultimoPedido) {
            window.ultimoPedido = ultimo;
            if (somAtivado) beep();
            setTimeout(() => location.reload(), 2000);
          }
        } catch(e) {}
      }

      if (somAtivado) {
        document.getElementById('btnSom').textContent = '🔊 Som Ativado';
        document.getElementById('btnSom').classList.add('ativo');
      }

      setInterval(verificarNovosPedidos, 5000);
    </script>
  `

  return c.html(renderLayout('Pedidos', conteudo, 'pedidos'))
})

// Detalhes do Pedido
app.get('/detalhes/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  
  const pedido = await c.env.DB.prepare(`
    SELECT p.*, c.nome, c.telefone, c.endereco, c.numero, c.bairro, c.complemento, c.referencia,
           com.mesa_numero, com.nome_cliente AS comanda_cliente,
           e.nome AS entregador_nome
    FROM pedidos p
    LEFT JOIN clientes c ON c.id = p.cliente_id
    LEFT JOIN comandas com ON com.pedido_id = p.id
    LEFT JOIN (
      SELECT pedido_id, entregador_id FROM entregas WHERE status IN ('ATRIBUIDA', 'A_CAMINHO')
    ) ent ON ent.pedido_id = p.id
    LEFT JOIN entregadores e ON e.id = ent.entregador_id
    WHERE p.id = ?
  `).bind(id).first() as any

  if (!pedido) return c.html('<h1>Pedido não encontrado</h1>')

  const itens = await c.env.DB.prepare(`
    SELECT ip.*, pr.nome AS produto
    FROM itens_pedido ip
    LEFT JOIN produtos pr ON pr.id = ip.produto_id
    WHERE ip.pedido_id = ?
  `).bind(id).all()

  const conteudo = `
    <style>
      .detalhes-card { background: white; border-radius: 15px; padding: 30px; box-shadow: 0 4px 15px rgba(0,0,0,.08); }
      .titulo { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; flex-wrap: wrap; gap: 10px; }
      .titulo h2 { margin: 0; color: #333; }
      .bloco { margin-bottom: 25px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
      .bloco h3 { color: #ff6b00; margin-bottom: 15px; }
      .info { margin: 8px 0; color: #555; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
      th { background: #f8f9fa; color: #495057; }
      .total { font-size: 24px; font-weight: bold; color: #28a745; text-align: right; margin-top: 20px; padding-top: 20px; border-top: 2px solid #eee; }
      .botoes { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 30px; }
      .botoes a, .botoes button { padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; border: none; cursor: pointer; }
      .btn.voltar { background: #6c757d; color: white; }
      .btn.imprimir { background: #17a2b8; color: white; }
      .btn.preparo { background: #17a2b8; color: white; }
      .btn.pronto { background: #007bff; color: white; }
      .btn.entrega { background: #ff6b00; color: white; }
      .btn.entregue { background: #20c997; color: white; }
      .btn.cancelado { background: #dc3545; color: white; }
      .btn.excluir { background: #000; color: white; }
      .entregador-info { background: #f3e8ff; border-left: 4px solid #6f42c1; padding: 15px; border-radius: 8px; margin: 15px 0; }
    </style>

    <div class="detalhes-card">
      <div class="titulo">
        <h2>Pedido #${pedido.id}</h2>
        <span class="status ${pedido.status}" style="padding:8px 16px; border-radius:20px; font-weight:bold; background:#ff6b00; color:white;">${pedido.status.replace(/_/g, ' ')}</span>
      </div>

      ${pedido.entregador_nome ? `
        <div class="entregador-info">
          <strong>🛵 Entregador:</strong> ${pedido.entregador_nome}
        </div>
      ` : ''}

      <div class="bloco">
        <h3>Cliente</h3>
        <p class="info"><strong>Nome:</strong> ${pedido.nome || '-'}</p>
        <p class="info"><strong>Telefone:</strong> ${pedido.telefone || '-'}</p>
      </div>

      <div class="bloco">
        <h3>Entrega</h3>
        <p class="info"><strong>Endereço:</strong> ${pedido.endereco || '-'}, ${pedido.numero || ''} - ${pedido.bairro || ''}</p>
        <p class="info"><strong>Complemento:</strong> ${pedido.complemento || '-'}</p>
        <p class="info"><strong>Referência:</strong> ${pedido.referencia || '-'}</p>
      </div>

      <div class="bloco">
        <h3>Itens do Pedido</h3>
        <table>
          <tr><th>Produto</th><th>Qtd</th><th>Valor Unit.</th><th>Subtotal</th></tr>
          ${(itens.results as any[]).map((item: any) => `
            <tr>
              <td>${item.produto || 'Produto'}</td>
              <td>${item.quantidade}</td>
              <td>R$ ${parseFloat(item.valor_unitario).toFixed(2).replace('.', ',')}</td>
              <td><strong>R$ ${parseFloat(item.subtotal).toFixed(2).replace('.', ',')}</strong></td>
            </tr>
          `).join('')}
        </table>
      </div>

      <div class="bloco">
        <h3>Pagamento</h3>
        <p class="info"><strong>Origem:</strong> ${pedido.origem}</p>
        <p class="info"><strong>Pagamento:</strong> ${pedido.pagamento}</p>
        <p class="info"><strong>Status Pagamento:</strong> ${pedido.status_pagamento}</p>
      </div>

      <div class="bloco">
        <h3>💠 Cobrança PIX (Mercado Pago)</h3>
        <div id="pix-area">
          <button style="background:#32bcad; color:#fff; border:none; padding:10px 18px; border-radius:8px; cursor:pointer; font-weight:bold;" onclick="gerarPix(${pedido.id}, ${pedido.total})">
            💠 Gerar PIX de R$ ${parseFloat(pedido.total).toFixed(2).replace('.', ',')}
          </button>
        </div>
      </div>

      <div class="total">Total: R$ ${parseFloat(pedido.total).toFixed(2).replace('.', ',')}</div>

      <div class="botoes">
        <a href="/pedidos" class="btn voltar">Voltar</a>
        <a href="/pedidos/imprimir/${pedido.id}" target="_blank" class="btn imprimir">Imprimir</a>
        ${!pedido.entregador_nome && pedido.status !== 'ENTREGUE' && pedido.status !== 'CANCELADO' ? `
          <button class="btn entrega" onclick="atribuirEntrega(${pedido.id})">🛵 Enviar para Entrega</button>
        ` : ''}
        <a href="/api/pedidos/status/${pedido.id}/EM_PREPARO" class="btn preparo">Em Preparo</a>
        <a href="/api/pedidos/status/${pedido.id}/PRONTO" class="btn pronto">Pronto</a>
        <a href="/api/pedidos/status/${pedido.id}/ENTREGUE" class="btn entregue">Entregue</a>
        <a href="/api/pedidos/status/${pedido.id}/CANCELADO" class="btn cancelado">Cancelar</a>
        <a href="/pedidos/excluir/${pedido.id}" class="btn excluir" onclick="return confirm('⚠️ EXCLUIR DEFINITIVAMENTE o Pedido #${pedido.id}?\\n\\nIsso removerá:\\n- Todos os itens do pedido\\n- Atribuição de entregador\\n- Comanda (se houver)\\n- Lançamento financeiro\\n\\nEsta ação não pode ser desfeita!')">🗑️ Excluir Pedido</a>
      </div>
    </div>

    <script>
      let pollPix = null;

      async function atribuirEntrega(pedidoId) {
        if (!confirm('Enviar este pedido para entrega agora?')) return;
        const r = await fetch('/api/entregadores/atribuir/' + pedidoId);
        const d = await r.json();
        if (d.sucesso) {
          alert('🛵 Pedido atribuído a ' + d.entregador + '!');
          location.reload();
        } else {
          alert('⚠️ ' + d.erro);
        }
      }

      async function gerarPix(pedidoId, valor) {
        const area = document.getElementById('pix-area');
        area.innerHTML = '<p style="color:#888;">Gerando cobrança no Mercado Pago...</p>';

        const res = await fetch('/api/pix/criar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pedido_id: pedidoId, valor })
        });
        const json = await res.json();

        if (!json.sucesso) {
          area.innerHTML = '<p style="color:#dc3545; font-weight:bold;">' + json.erro + '</p>';
          return;
        }

        const imgSrc = json.qr_code_base64
          ? ('data:image/png;base64,' + json.qr_code_base64)
          : '';

        area.innerHTML = '<div style="text-align:center;">' +
          (imgSrc ? '<img src="' + imgSrc + '" style="width:220px; height:220px; border:1px solid #ddd; border-radius:10px; padding:8px; background:#fff;">' : '') +
          '<p style="margin:10px 0 5px; color:#555;">' +
          'Valor: <strong>R$ ' + json.valor.toFixed(2).replace('.', ',') + '</strong>' +
          ' · <span id="pix-status" style="color:#ffc107; font-weight:bold;">aguardando pagamento...</span>' +
          '</p>' +
          '<textarea id="pix-copia" readonly style="width:100%; height:70px; font-size:12px; border:1px solid #ddd; border-radius:8px; padding:8px; box-sizing:border-box;">' + json.qr_code + '</textarea>' +
          '<button style="margin-top:8px; background:#ff6b00; color:#fff; border:none; padding:10px 18px; border-radius:8px; cursor:pointer; font-weight:bold;" onclick="copiarPix()">📋 Copiar código PIX</button>' +
          '</div>';

        if (pollPix) clearInterval(pollPix);
        pollPix = setInterval(async () => {
          const r = await fetch('/api/pix/consultar/' + pedidoId);
          const j = await r.json();
          const st = document.getElementById('pix-status');
          if (st) st.textContent = 'status: ' + j.status_pagamento;
          if (j.status_pagamento === 'PAGO') {
            clearInterval(pollPix);
            alert('✅ PIX confirmado pelo Mercado Pago! Pedido pago.');
            location.reload();
          }
        }, 5000);
      }

      function copiarPix() {
        const t = document.getElementById('pix-copia');
        t.select();
        navigator.clipboard.writeText(t.value);
        alert('Código PIX copiado!');
      }
    </script>
  `

  return c.html(renderLayout('Pedido #' + id, conteudo, 'pedidos'))
})

// Imprimir Pedido
app.get('/imprimir/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  
  const pedido = await c.env.DB.prepare(`
    SELECT p.*, c.nome, c.telefone, c.endereco, c.numero, c.bairro, c.complemento, c.referencia,
           com.mesa_numero, com.nome_cliente AS comanda_cliente
    FROM pedidos p
    LEFT JOIN clientes c ON c.id = p.cliente_id
    LEFT JOIN comandas com ON com.pedido_id = p.id
    WHERE p.id = ?
  `).bind(id).first() as any

  const itens = await c.env.DB.prepare(`
    SELECT ip.*, pr.nome AS produto
    FROM itens_pedido ip
    LEFT JOIN produtos pr ON pr.id = ip.produto_id
    WHERE ip.pedido_id = ?
  `).bind(id).all()

  const config = await c.env.DB.prepare('SELECT * FROM configuracoes WHERE id = 1').first() as any

  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Imprimir Pedido #${id}</title>
      <style>
        body { font-family: 'Courier New', monospace; max-width: 300px; margin: 20px auto; padding: 20px; }
        .comanda { border: 2px dashed #000; padding: 20px; }
        .centro { text-align: center; }
        .logo { max-width: 100px; margin-bottom: 10px; }
        h2 { margin: 10px 0; }
        hr { border: none; border-top: 1px dashed #000; margin: 15px 0; }
        .item { margin: 10px 0; }
        .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 15px; }
        .btn-print { background: #ff6b00; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; margin-bottom: 20px; }
        @media print { .btn-print { display: none; } }
      </style>
    </head>
    <body>
      <button class="btn-print" onclick="window.print()">Imprimir Pedido</button>
      <div class="comanda">
        <div class="centro">
          <h2>${config?.nome_empresa || 'ESPETARIA'}</h2>
          <p>${config?.telefone || ''}</p>
          <p>${config?.endereco || ''}</p>
        </div>
        <hr>
        <p><strong>PEDIDO:</strong> #${pedido.id}</p>
        <p><strong>Data:</strong> ${new Date(pedido.criado_em).toLocaleString('pt-BR')}</p>
        <p><strong>Status:</strong> ${pedido.status}</p>
        <hr>
        ${pedido.origem === 'COMANDA' ? `
          <p><strong>COMANDA:</strong> Mesa ${pedido.mesa_numero || '-'}</p>
          <p><strong>Cliente:</strong> ${pedido.comanda_cliente || 'Consumação'}</p>
          <p><strong>Tipo:</strong> Atendimento presencial</p>
        ` : `
          <p><strong>Cliente:</strong> ${pedido.nome || '-'}</p>
          <p><strong>Telefone:</strong> ${pedido.telefone || '-'}</p>
          <p><strong>Endereço:</strong> ${pedido.endereco || '-'}, ${pedido.numero || ''} - ${pedido.bairro || ''}</p>
        `}
        <p><strong>ITENS DO PEDIDO</strong></p>
        ${(itens.results as any[]).map((item: any) => `
          <div class="item">
            <strong>${item.quantidade}x ${item.produto}</strong><br>
            <span>R$ ${parseFloat(item.valor_unitario).toFixed(2).replace('.', ',')} cada</span><br>
            <span>Subtotal: R$ ${parseFloat(item.subtotal).toFixed(2).replace('.', ',')}</span>
          </div>
        `).join('')}
        <hr>
        <p><strong>Pagamento:</strong> ${pedido.pagamento}</p>
        <p class="total">TOTAL: R$ ${parseFloat(pedido.total).toFixed(2).replace('.', ',')}</p>
        <hr>
        <div class="centro">
          <p>Obrigado pela preferência!</p>
        </div>
      </div>
      <script>window.onload = () => setTimeout(() => window.print(), 500)</script>
    </body>
    </html>
  `)
})

// Excluir Pedido (com cascata)
app.get('/excluir/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  
  try {
    // 1. Excluir itens do pedido
    await c.env.DB.prepare('DELETE FROM itens_pedido WHERE pedido_id = ?').bind(id).run()
    
    // 2. Excluir entregas associadas
    await c.env.DB.prepare('DELETE FROM entregas WHERE pedido_id = ?').bind(id).run()
    
    // 3. Excluir comanda se existir
    await c.env.DB.prepare('DELETE FROM comandas WHERE pedido_id = ?').bind(id).run()
       
    // 3.5 Excluir venda avulsa vinculada (se houver)
    await c.env.DB.prepare('DELETE FROM vendas_avulsas WHERE pedido_id = ?').bind(id).run()
    
    // 4. Excluir movimentação financeira se existir
    await c.env.DB.prepare(`DELETE FROM financeiro WHERE descricao LIKE ? OR observacao LIKE ?`)
      .bind(`%Pedido #${id}%`, `%pedido_id":${id}%`).run()
    
    // 5. Excluir o pedido
    await c.env.DB.prepare('DELETE FROM pedidos WHERE id = ?').bind(id).run()
    
    return c.redirect('/pedidos')
  } catch (e: any) {
    return c.html(`
      <!doctype html><html><head><meta charset="utf-8"><title>Erro</title>
      <style>body{font-family:Arial;padding:40px;text-align:center;} .box{max-width:500px;margin:auto;background:#fff;padding:30px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.1);}
      a{display:inline-block;margin-top:20px;padding:10px 20px;background:#ff6b00;color:#fff;text-decoration:none;border-radius:5px;}</style></head>
      <body><div class="box"><h2>⚠️ Erro ao excluir</h2><p>${e.message}</p><a href="/pedidos">Voltar</a></div></body></html>
    `, 500)
  }
})

export default app