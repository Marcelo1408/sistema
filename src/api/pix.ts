import { Hono } from 'hono'
import { MercadoPagoConfig, Payment } from 'mercadopago'

type Bindings = {
  DB: D1Database
  MP_ACCESS_TOKEN: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Data de hoje no horário de Brasília (para o financeiro)
const hojeBr = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)

// ============================================================
// MERCADO PAGO - CRIAR PAGAMENTO PIX
// ============================================================
app.post('/criar', async (c) => {
  if (!c.env.MP_ACCESS_TOKEN) {
    return c.json({ erro: 'Token do Mercado Pago não configurado (MP_ACCESS_TOKEN).' }, 500)
  }

  const body = await c.req.json().catch(() => ({}))
  const pedido_id = body.pedido_id ? parseInt(body.pedido_id) : null

  if (!pedido_id) {
    return c.json({ erro: 'pedido_id é obrigatório.' }, 400)
  }

  try {
    const pedido = await c.env.DB.prepare(`
      SELECT p.id, p.total, p.status, c.nome, c.telefone
      FROM pedidos p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      WHERE p.id = ?
    `).bind(pedido_id).first() as any

    if (!pedido) {
      return c.json({ erro: 'Pedido não encontrado.' }, 404)
    }

    const client = new MercadoPagoConfig({ accessToken: c.env.MP_ACCESS_TOKEN })
    const payment = new Payment(client)

    const resultado = await payment.create({
      body: {
        transaction_amount: Number(pedido.total),
        description: `Pedido #${pedido.id} - Espetaria`,
        payment_method_id: 'pix',
        payer: {
          email: `pedido${pedido.id}@gmail.com`,
          first_name: pedido.nome || 'Cliente'
        },
        external_reference: String(pedido.id)
      },
      requestOptions: {
        idempotencyKey: `pedido-${pedido.id}-${Date.now()}`
      }
    })

    const pix = resultado.point_of_interaction?.transaction_data || {}

    await c.env.DB.prepare(`
      UPDATE pedidos SET
        id_pagamento = ?,
        status_pagamento = 'PENDENTE',
        status = 'AGUARDANDO_PIX'
      WHERE id = ?
    `).bind(String(resultado.id), pedido.id).run()

    return c.json({
      sucesso: true,
      pedido_id: pedido.id,
      pagamento_id: resultado.id,
      qr_code: pix.qr_code || '',
      qr_code_base64: pix.qr_code_base64 || '',
      ticket_url: pix.ticket_url || ''
    })
  } catch (error: any) {
    console.error('Erro ao gerar PIX:', error.message)
    return c.json({ erro: error.message || 'Erro ao gerar PIX.' }, 500)
  }
})

// ============================================================
// WEBHOOK MERCADO PAGO (confirmação de pagamento)
// ============================================================
app.post('/webhook', async (c) => {
  if (!c.env.MP_ACCESS_TOKEN) return c.json({ ok: true })

  try {
    const body = await c.req.json().catch(() => ({})) as any
    console.log('WEBHOOK MERCADO PAGO:', body)

    const pagamentoId = body?.data?.id || body?.id
    if (!pagamentoId) return c.json({ ok: true })

    const client = new MercadoPagoConfig({ accessToken: c.env.MP_ACCESS_TOKEN })
    const payment = new Payment(client)

    const pagamento = await payment.get({ id: String(pagamentoId) })
    const status = pagamento.status
    const pedidoId = pagamento.external_reference

    console.log('STATUS PAGAMENTO:', status)
    console.log('PEDIDO REFERÊNCIA:', pedidoId)

    if (status === 'approved' && pedidoId) {
      // 1. Atualiza pedido para PAGO e EM_PREPARO (igual ao seu original)
      await c.env.DB.prepare(`
        UPDATE pedidos SET
          status_pagamento = 'PAGO',
          status = 'EM_PREPARO'
        WHERE id = ?
      `).bind(pedidoId).run()

      // 2. Lança ENTRADA automática no financeiro
      const pedido = await c.env.DB.prepare(`
        SELECT p.id, p.total, c.nome, c.telefone
        FROM pedidos p
        LEFT JOIN clientes c ON c.id = p.cliente_id
        WHERE p.id = ?
      `).bind(pedidoId).first() as any

      if (pedido && (pedido.total || 0) > 0) {
        await c.env.DB.prepare(`
          INSERT INTO financeiro (tipo, descricao, valor, data_movimento, forma_pagamento, observacao, categoria, automatico, pedido_id)
          VALUES ('ENTRADA', ?, ?, ?, 'PIX', ?, 'VENDAS', 1, ?)
        `).bind(
          `Pedido #${pedido.id} pago via PIX (Mercado Pago)`,
          pedido.total,
          hojeBr(),
          `Cliente: ${pedido.nome || 'Cliente'} | Pagamento MP: ${pagamentoId}`,
          pedido.id
        ).run()
      }

      // 3. Aqui você pode integrar com seu bot/PWA para notificar o cliente
      // (O bot original chamava /notificar-pedido na porta 4000.
      //  No ambiente Cloudflare, enviaremos a notificação via PWA ou e-mail se necessário.)
    }

    return c.json({ ok: true })
  } catch (error: any) {
    console.error('Erro webhook Mercado Pago:', error.message)
    return c.json({ ok: true })
  }
})

// Mercado Pago às vezes testa o endpoint com GET
app.get('/webhook', (c) => c.json({ ok: true }))

// ============================================================
// CONSULTAR STATUS (polling do painel / PWA)
// ============================================================
app.get('/consultar/:pedidoId', async (c) => {
  const pedidoId = parseInt(c.req.param('pedidoId'))
  const pedido = await c.env.DB.prepare('SELECT id_pagamento, status_pagamento, status FROM pedidos WHERE id = ?').bind(pedidoId).first() as any

  if (!pedido) return c.json({ erro: 'Pedido não encontrado' }, 404)

  if (pedido.status_pagamento === 'PAGO' || pedido.status === 'EM_PREPARO') {
    return c.json({ status_pagamento: 'PAGO', status: pedido.status })
  }

  if (pedido.id_pagamento && c.env.MP_ACCESS_TOKEN) {
    try {
      const client = new MercadoPagoConfig({ accessToken: c.env.MP_ACCESS_TOKEN })
      const payment = new Payment(client)
      const mp = await payment.get({ id: pedido.id_pagamento })

      if (mp?.status === 'approved') {
        await c.env.DB.prepare(`
          UPDATE pedidos SET status_pagamento = 'PAGO', status = 'EM_PREPARO' WHERE id = ?
        `).bind(pedidoId).run()
        return c.json({ status_pagamento: 'PAGO', status: 'EM_PREPARO' })
      }
      return c.json({ status_pagamento: mp?.status || 'PENDENTE', status: pedido.status })
    } catch (e) {
      return c.json({ status_pagamento: pedido.status_pagamento || 'PENDENTE', status: pedido.status })
    }
  }

  return c.json({ status_pagamento: pedido.status_pagamento || 'PENDENTE', status: pedido.status })
})

export default app