// ============================================================
// API ESPETARIA — serve o PWA e integra com banco_espetaria
// Mesmos endpoints usados pelo bot WhatsApp (index.js)
// ============================================================
const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();
const pool = require('./db');

const app = express();
app.use(express.json());

const ENTREGA = {
  lojaLat: parseFloat(process.env.LOJA_LAT),
  lojaLng: parseFloat(process.env.LOJA_LNG),
  valorKm: parseFloat(process.env.ENTREGA_VALOR_KM) || 2.5,
  kmMaximo: parseFloat(process.env.ENTREGA_KM_MAXIMO) || 20,
  multiplicador: parseFloat(process.env.ENTREGA_MULTIPLICADOR_LINHA_RETA) || 1.2,
  kmPadrao: parseFloat(process.env.ENTREGA_KM_PADRAO_LOCAL) || 3
};

// ---------- Estáticos (PWA) ----------
app.use(express.static(path.join(__dirname, 'public')));

// Imagens de produtos/logo (uploads do painel)
const basesUploads = [
  path.join(__dirname, 'uploads'),
  path.join(__dirname, '..', 'painel', 'uploads'),
  '/var/www/html/painel/uploads'
];
app.use('/uploads', (req, res, next) => {
  const nome = path.basename(req.path);
  for (const base of basesUploads) {
    const arquivo = path.join(base, nome);
    if (fs.existsSync(arquivo)) return res.sendFile(arquivo);
  }
  next();
});

// ---------- Utilidades ----------
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocodificar(e) {
  const q = [e.endereco, e.numero, e.bairro, e.cidade, e.uf, e.cep].filter(Boolean).join(', ');
  const r = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: { q, format: 'json', limit: 1, countrycodes: 'br' },
    headers: { 'User-Agent': 'EspetariaPWA/1.0' },
    timeout: 8000
  });
  const hit = r.data[0];
  return hit ? { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) } : null;
}

// ============================================================
// STATUS DA LOJA
// ============================================================
app.get('/loja/status', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM configuracoes LIMIT 1');
    const cfg = rows[0] || {};
    const agora = new Date();
    const atual = agora.getHours() * 60 + agora.getMinutes();
    const [hA, mA] = String(cfg.horario_abertura || '18:00').split(':').map(Number);
    const [hF, mF] = String(cfg.horario_fechamento || '00:00').split(':').map(Number);
    const abre = hA * 60 + (mA || 0), fecha = hF * 60 + (mF || 0);
    let aberta = Number(cfg.loja_aberta) === 1;
    if (aberta) aberta = fecha > abre
      ? (atual >= abre && atual <= fecha)
      : (atual >= abre || atual <= fecha); // vira a meia-noite

    res.json({
      aberta,
      nome_empresa: cfg.nome_empresa || 'Espetaria',
      horario_abertura: cfg.horario_abertura,
      horario_fechamento: cfg.horario_fechamento,
      logo: cfg.logo,
      logo_url: cfg.logo ? `/uploads/${cfg.logo}` : null,
      endereco: cfg.endereco,
      cidade: cfg.cidade,
      tempo_preparo: cfg.tempo_preparo || 30,
      mensagem_fechado: `Olá! No momento a loja está fechada.\nHorário: ${cfg.horario_abertura} às ${cfg.horario_fechamento}.`
    });
  } catch (e) {
    res.status(500).json({ aberta: false, mensagem_fechado: 'Erro ao consultar a loja.' });
  }
});

// ============================================================
// CARDÁPIO
// ============================================================
app.get('/categorias', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM categorias WHERE ativo = 1 ORDER BY id');
  res.json(rows);
});

app.get('/produtos', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT p.*, c.nome AS categoria
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.ativo = 1
    ORDER BY p.ordem ASC, p.id ASC`);
  res.json(rows);
});

app.get('/adicionais', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM adicionais WHERE ativo = 1 ORDER BY nome');
  res.json(rows);
});

app.get('/promocoes', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT pr.*, p.nome AS produto
    FROM promocoes pr LEFT JOIN produtos p ON p.id = pr.produto_id
    WHERE pr.ativo = 1 AND (pr.data_fim IS NULL OR pr.data_fim >= CURDATE())`);
  res.json(rows);
});

// ============================================================
// CLIENTE (usado também pelo bot)
// ============================================================
app.get('/clientes/telefone/:telefone', async (req, res) => {
  const telefone = req.params.telefone.replace(/\D/g, '');
  const [rows] = await pool.query('SELECT * FROM clientes WHERE telefone = ?', [telefone]);
  res.json(rows.length ? { encontrado: true, cliente: rows[0] } : { encontrado: false, cliente: null });
});

// ============================================================
// CÁLCULO DE ENTREGA (km real via geocoding + Haversine)
// ============================================================
app.post('/calculo-de-entrega', async (req, res) => {
  try {
    const { cep, endereco, numero, bairro, cidade, uf } = req.body;
    let km;
    try {
      const coord = await geocodificar({ endereco, numero, bairro, cidade, uf: uf || 'SP', cep });
      if (!coord) throw new Error('endereco_nao_encontrado');
      km = haversine(ENTREGA.lojaLat, ENTREGA.lojaLng, coord.lat, coord.lng) * ENTREGA.multiplicador;
    } catch {
      const [cfg] = await pool.query('SELECT entrega_taxa_fallback FROM configuracoes LIMIT 1');
      return res.json({
        km: ENTREGA.kmPadrao,
        taxa: Number(cfg[0]?.entrega_taxa_fallback || 15),
        calculada: false, estimada: true, bloqueada: false, origem: 'fallback',
        aviso: 'Não localizamos o endereço no mapa — taxa estimada, a loja confirma o valor final.'
      });
    }
    if (km > ENTREGA.kmMaximo) {
      return res.json({
        status: false, bloqueada: true, km: +km.toFixed(1), taxa: 0, calculada: false,
        motivo: 'fora_da_area',
        mensagem: `Endereço fora da área de entrega (máx. ${ENTREGA.kmMaximo} km). Retirada no balcão disponível.`
      });
    }
    const kmCobrado = Math.max(Math.ceil(km), ENTREGA.kmPadrao);
    res.json({
      km: +km.toFixed(1), km_cobrado: kmCobrado,
      taxa: +(kmCobrado * ENTREGA.valorKm).toFixed(2),
      calculada: true, bloqueada: false, estimada: false,
      origem: 'geocoding', valor_km: ENTREGA.valorKm
    });
  } catch (e) {
    res.status(500).json({ status: false, bloqueada: true, mensagem: 'Erro ao calcular a entrega.' });
  }
});

// ============================================================
// CRIAR PEDIDO (transação: cliente + pedido + itens + estoque + financeiro)
// ============================================================
app.post('/pedidos', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const b = req.body;
    const telefone = String(b.telefone || '').replace(/\D/g, '');
    const enderecoCompleto = [
      b.endereco, b.numero, b.complemento, b.bairro,
      b.cidade && b.uf ? `${b.cidade}/${b.uf}` : b.cidade, b.cep
    ].filter(Boolean).join(' - ');

    // Cliente (upsert por telefone)
    let [cli] = await conn.query('SELECT id FROM clientes WHERE telefone = ?', [telefone]);
    let clienteId;
    if (cli.length) {
      clienteId = cli[0].id;
      await conn.query(`UPDATE clientes SET nome=?, endereco=?, numero=?, bairro=?, complemento=?, cep=?,
        referencia=?, total_pedidos = total_pedidos + 1, valor_gasto = valor_gasto + ? WHERE id=?`,
        [b.nome, enderecoCompleto, b.numero || null, b.bairro || null, b.complemento || null,
         b.cep || null, b.referencia || null, b.total, clienteId]);
    } else {
      const [r] = await conn.query(`INSERT INTO clientes
        (nome, telefone, endereco, numero, bairro, complemento, cep, referencia, total_pedidos, valor_gasto)
        VALUES (?,?,?,?,?,?,?,?,1,?)`,
        [b.nome, telefone, enderecoCompleto, b.numero || null, b.bairro || null,
         b.complemento || null, b.cep || null, b.referencia || null, b.total]);
      clienteId = r.insertId;
    }

    // Pedido
    const obs = `Endereço: ${enderecoCompleto} | Referência: ${b.referencia || 'Não informado'}`;
    const [rp] = await conn.query(`INSERT INTO pedidos
      (cliente_id, total, pagamento, observacao, status, taxa_entrega, origem, status_pagamento)
      VALUES (?,?,?,?, 'AGUARDANDO_PIX', ?, 'SITE', 'PENDENTE')`,
      [clienteId, b.total, b.pagamento || 'PIX', obs, b.taxa_entrega || 0]);
    const pedidoId = rp.insertId;

    // Itens + baixa de estoque + adicionais
    for (const item of (b.itens || [])) {
      const [ri] = await conn.query(`INSERT INTO itens_pedido
        (pedido_id, produto_id, tipo_item, item_id, nome_item, quantidade, valor_unitario, subtotal)
        VALUES (?,?,?,?,?,?,?,?)`,
        [pedidoId, item.id, 'produto', item.id, item.nome, item.quantidade, item.preco, item.subtotal]);

      for (const ad of (item.adicionais || [])) {
        await conn.query(`INSERT INTO itens_pedido_adicionais
          (item_pedido_id, pedido_id, produto_id, adicional_id, nome, preco)
          VALUES (?,?,?,?,?,?)`,
          [ri.insertId, pedidoId, item.id, ad.id, ad.nome, ad.preco]);
      }
      await conn.query('UPDATE produtos SET estoque = GREATEST(estoque - ?, 0) WHERE id = ?',
        [item.quantidade, item.id]);
      await conn.query(`INSERT INTO estoque_movimentacoes (produto_id, tipo, quantidade, observacao)
        VALUES (?, 'SAIDA', ?, ?)`, [item.id, item.quantidade, `Venda automática - Pedido #${pedidoId}`]);
    }

    // Financeiro automático (padrão do seu sistema)
    await conn.query(`INSERT INTO financeiro
      (tipo, descricao, valor, data_movimento, forma_pagamento, observacao, pedido_id, automatico, categoria)
      VALUES ('ENTRADA', ?, ?, CURDATE(), ?, ?, ?, 1, 'VENDA')`,
      [`Venda automática - Pedido #${pedidoId}`, b.total, b.pagamento || 'PIX',
       'Entrada gerada automaticamente pelo pedido do site.', pedidoId]);

    await conn.commit();
    res.json({ pedido_id: pedidoId, total: b.total });
  } catch (e) {
    await conn.rollback();
    console.error('Erro ao salvar pedido:', e.message);
    res.status(500).json({ erro: e.message });
  } finally {
    conn.release();
  }
});

// ============================================================
// PIX — Mercado Pago
// ============================================================
app.post('/pix/criar', async (req, res) => {
  try {
    const { pedido_id } = req.body;
    const [rows] = await pool.query('SELECT * FROM pedidos WHERE id = ?', [pedido_id]);
    if (!rows.length) return res.status(404).json({ erro: 'Pedido não encontrado' });
    const pedido = rows[0];

    const r = await axios.post('https://api.mercadopago.com/v1/payments', {
      transaction_amount: Number(pedido.total),
      description: `Pedido #${pedido_id} - Espetaria`,
      payment_method_id: 'pix',
      external_reference: String(pedido_id),
      payer: { email: `pedido${pedido_id}@espetaria.com` }
    }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        'X-Idempotency-Key': crypto.randomUUID()
      },
      timeout: 15000
    });

    const tx = r.data.point_of_interaction?.transaction_data || {};
    await pool.query('UPDATE pedidos SET id_pagamento = ? WHERE id = ?', [String(r.data.id), pedido_id]);

    res.json({
      qr_code: tx.qr_code,
      qr_code_base64: tx.qr_code_base64,
      ticket_url: tx.ticket_url,
      pagamento_id: r.data.id
    });
  } catch (e) {
    console.error('Erro PIX:', e.response?.data || e.message);
    res.status(500).json({ erro: 'Falha ao gerar o PIX', detalhe: e.response?.data });
  }
});

// ============================================================
// STATUS DO PEDIDO (tracking do PWA) + confirmação (bot)
// ============================================================
app.get('/pedidos/:id/status', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, status, status_pagamento, total, criado_em FROM pedidos WHERE id = ?',
    [req.params.id]);
  if (!rows.length) return res.status(404).json({ erro: 'Pedido não encontrado' });
  res.json(rows[0]);
});

app.post('/pedidos/confirmar-entrega', async (req, res) => {
  const telefone = String(req.body.telefone || '').replace(/\D/g, '');
  const [rows] = await pool.query(`SELECT p.id FROM pedidos p
    JOIN clientes c ON c.id = p.cliente_id WHERE c.telefone = ? ORDER BY p.id DESC LIMIT 1`, [telefone]);
  if (!rows.length) return res.status(404).json({ erro: 'Nenhum pedido encontrado' });
  await pool.query("UPDATE pedidos SET status = 'ENTREGUE' WHERE id = ?", [rows[0].id]);
  res.json({ pedido_id: rows[0].id });
});

// Fallback SPA
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(process.env.PORT || 3000, () =>
  console.log(`🍢 API + PWA rodando em http://localhost:${process.env.PORT || 3000}`));