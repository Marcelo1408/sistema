import { Hono } from 'hono'
import { MercadoPagoConfig, Payment } from 'mercadopago'

type Bindings = {
  DB: D1Database
  MP_ACCESS_TOKEN: string
  MP_PUBLIC_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

const hojeBr = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)

// ---------- Public key para o app tokenizar o cartão ----------
app.get('/config', (c) => {
  return c.json({ public_key: c.env.MP_PUBLIC_KEY || '' })
})

// ---------- Descobrir bandeira + parcelas a partir do BIN ----------
app.get('/bin', async (c) => {
  const bin = c.req.query('bin') || ''
  if (!c.env.MP_ACCESS_TOKEN) return c.json({ erro: 'Token MP não configurado' }, 500)
  if (bin.length < 6) return c.json({ erro: 'BIN inválido' }, 400)

  try {
    const resp = await fetch(`https://api.mercadopago.com/v1/payment_methods?bin=${bin}`, {
      headers: { Authorization: `Bearer ${c.env.MP_ACCESS_TOKEN}` }
    })
    const data = await resp.json() as any
    if (!resp.ok || !Array.isArray(data) || !data.length) {
      return c.json({ erro: 'Cartão não reconhecido' }, 404)
    }
    const pm = data[0]
    return c.json({
      payment_method_id: pm.id,
      type: pm.payment_type_id, // credit_card | debit_card
      name: pm.name,
      installments: (pm.settings?.installments || []).map((i: any) => ({
        count: i.installments,
        label: i.recommended_message || `${i.installments}x`
      }))
    })
  } catch (e: any) {
    return c.json({ erro: e.message }, 500)
  }
})

// ---------- Cobrar cartão (crédito) no app ----------
app.post('/cartao', async (c) => {
  if (!c.env.MP_ACCESS_TOKEN) return c.json({ erro: 'Token MP não configurado' }, 500)

  const body = await c.req.json().catch(() => ({}))
  const pedido_id = body.pedido_id ? parseInt(body.pedido_id) : null
  const token = body.token
  const payment_method_id = body.payment_method_id
  const installments = parseInt(body.installments) || 1

  if (!pedido_id || !token || !payment_method_id) {
    return c.json({ erro: 'Dados de pagamento incompletos' }, 400)
  }

  const pedido = await c.env.DB.prepare(`
    SELECT p.id, p.total, c.nome, c.telefone
    FROM pedidos p LEFT JOIN clientes c ON c.id = p.cliente_id
    WHERE p.id = ?
  `).bind(pedido_id).first() as any

  if (!pedido) return c.json({ erro: 'Pedido não encontrado' }, 404)

  try {
    const client = new MercadoPagoConfig({ accessToken: c.env.MP_ACCESS_TOKEN })
    const payment = new Payment(client)

    const resultado = await payment.create({
      body: {
        transaction_amount: Number(pedido.total),
        token: token,
        description: `Pedido #${pedido.id} - Espetaria`,
        installments: installments,
        payment_method_id: payment_method_id,
        payer: {
          email: `pedido${pedido.id}@gmail.com`,
          first_name: pedido.nome || 'Cliente'
        },
        external_reference: String(pedido.id)
      },
      requestOptions: { idempotencyKey: `cartao-${pedido.id}-${Date.now()}` }
    })

    const status = resultado.status

    // Se aprovado, atualiza pedido + lança no financeiro (igual ao PIX)
    if (status === 'approved') {
      await c.env.DB.batch([
        c.env.DB.prepare("UPDATE pedidos SET status_pagamento='PAGO', status='EM_PREPARO', pagamento='CARTAO_CREDITO' WHERE id=?").bind(pedido_id),
        c.env.DB.prepare(`
          INSERT INTO financeiro (tipo, descricao, valor, data_movimento, forma_pagamento, observacao, categoria, automatico, pedido_id)
          VALUES ('ENTRADA', ?, ?, ?, 'CARTAO_CREDITO', ?, 'VENDAS', 1, ?)
        `).bind(
          `Pedido #${pedido.id} pago no cartão (Mercado Pago)`,
          pedido.total,
          hojeBr(),
          `Cliente: ${pedido.nome || 'Cliente'} | Payment MP: ${resultado.id}`,
          pedido.id
        )
      ])
    }

    return c.json({
      sucesso: status === 'approved',
      status: status,
      status_detail: resultado.status_detail,
      payment_id: resultado.id
    })
  } catch (e: any) {
    return c.json({ erro: e.message || 'Erro ao processar cartão' }, 500)
  }
})

export default app