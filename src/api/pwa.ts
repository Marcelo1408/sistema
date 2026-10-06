import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// ---------- STATUS DA LOJA (header do PWA) ----------
app.get('/loja/status', async (c) => {
  const config = await c.env.DB.prepare('SELECT * FROM configuracoes WHERE id = 1').first() as any

  const aberta = config?.loja_aberta === 1

  return c.json({
    nome_empresa: config?.nome_empresa || 'Espetaria',
    logo_url: config?.logo || '',
    aberta: aberta,
    mensagem_fechado: 'Estamos fechados no momento. Abra a loja no painel para receber pedidos.'
  })
})

// ---------- ADICIONAIS (vazio, pois o sistema não usa adicionais) ----------
app.get('/adicionais', (c) => c.json([]))

// ---------- STATUS DO PEDIDO (tracking em tempo real do PIX) ----------
app.get('/pedidos/:id/status', async (c) => {
  const id = parseInt(c.req.param('id'))
  const pedido = await c.env.DB.prepare('SELECT status, status_pagamento FROM pedidos WHERE id = ?').bind(id).first() as any

  if (!pedido) return c.json({ erro: 'Pedido não encontrado' }, 404)

  return c.json({
    status: pedido.status,
    status_pagamento: pedido.status_pagamento
  })
})

export default app