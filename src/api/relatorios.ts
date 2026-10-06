import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// KPIs principais
app.get('/kpis', async (c) => {
  const db = c.env.DB

  const totalPedidos = await db.prepare('SELECT COUNT(*) as total FROM pedidos').first() as any
  const totalClientes = await db.prepare('SELECT COUNT(*) as total FROM clientes').first() as any

  // Faturamento hoje (pedidos pagos/entregues, horário de Brasília -3h)
  const faturamentoHoje = await db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total
    FROM pedidos
    WHERE date(criado_em, '-3 hours') = date('now', '-3 hours')
    AND status IN ('PAGO', 'EM_PREPARO', 'PRONTO', 'SAIU_ENTREGA', 'ENTREGUE', 'CONFIRMADO_CLIENTE')
  `).first() as any

  // Faturamento do mês atual
  const faturamentoMes = await db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total
    FROM pedidos
    WHERE strftime('%Y-%m', criado_em, '-3 hours') = strftime('%Y-%m', 'now', '-3 hours')
    AND status IN ('PAGO', 'EM_PREPARO', 'PRONTO', 'SAIU_ENTREGA', 'ENTREGUE', 'CONFIRMADO_CLIENTE')
  `).first() as any

  // Ticket médio (pedidos pagos)
  const ticketMedio = await db.prepare(`
    SELECT COALESCE(AVG(total), 0) as total
    FROM pedidos
    WHERE status IN ('PAGO', 'EM_PREPARO', 'PRONTO', 'SAIU_ENTREGA', 'ENTREGUE', 'CONFIRMADO_CLIENTE')
  `).first() as any

  return c.json({
    totalPedidos: totalPedidos?.total || 0,
    totalClientes: totalClientes?.total || 0,
    faturamentoHoje: faturamentoHoje?.total || 0,
    faturamentoMes: faturamentoMes?.total || 0,
    ticketMedio: ticketMedio?.total || 0
  })
})

// Produtos mais vendidos (TOP 10)
app.get('/produtos-mais-vendidos', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT p.nome, SUM(ip.quantidade) as vendidos, SUM(ip.subtotal) as faturamento
    FROM itens_pedido ip
    LEFT JOIN produtos p ON p.id = ip.produto_id
    WHERE p.nome IS NOT NULL
    GROUP BY ip.produto_id, p.nome
    ORDER BY vendidos DESC
    LIMIT 10
  `).all()
  return c.json(results)
})

// Clientes que mais compram (TOP 10)
app.get('/clientes-top', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT c.nome, COUNT(pe.id) as pedidos, COALESCE(SUM(pe.total), 0) as total_gasto
    FROM clientes c
    LEFT JOIN pedidos pe ON pe.cliente_id = c.id
    AND pe.status IN ('PAGO', 'EM_PREPARO', 'PRONTO', 'SAIU_ENTREGA', 'ENTREGUE', 'CONFIRMADO_CLIENTE')
    GROUP BY c.id
    ORDER BY total_gasto DESC
    LIMIT 10
  `).all()
  return c.json(results)
})

// Pedidos por status
app.get('/por-status', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT status, COUNT(*) as total
    FROM pedidos
    GROUP BY status
    ORDER BY total DESC
  `).all()
  return c.json(results)
})

// Faturamento por dia (últimos 30 dias) - para gráfico
app.get('/faturamento-diario', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT date(criado_em, '-3 hours') as dia,
           COALESCE(SUM(total), 0) as faturamento,
           COUNT(*) as pedidos
    FROM pedidos
    WHERE date(criado_em, '-3 hours') >= date('now', '-30 days', '-3 hours')
    AND status IN ('PAGO', 'EM_PREPARO', 'PRONTO', 'SAIU_ENTREGA', 'ENTREGUE', 'CONFIRMADO_CLIENTE')
    GROUP BY dia
    ORDER BY dia ASC
  `).all()
  return c.json(results)
})

export default app