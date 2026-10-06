import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

const brl = (v: number) => (v || 0).toFixed(2).replace('.', ',')

const LABEL_STATUS: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: 'Aguardando Pagamento',
  AGUARDANDO_PIX: 'Aguardando PIX',
  PAGO: 'Pago',
  EM_PREPARO: 'Em Preparo',
  PRONTO: 'Pronto',
  SAIU_ENTREGA: 'Saiu p/ Entrega',
  ENTREGUE: 'Entregue',
  CONFIRMADO_CLIENTE: 'Confirmado Cliente',
  CANCELADO: 'Cancelado',
  COMANDA_ABERTA: 'Comanda Aberta'
}

app.get('/', async (c) => {
  const db = c.env.DB

  // KPIs
  const totalPedidos = await db.prepare('SELECT COUNT(*) as total FROM pedidos').first() as any
  const totalClientes = await db.prepare('SELECT COUNT(*) as total FROM clientes').first() as any

  const faturamentoHoje = await db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total
    FROM pedidos
    WHERE date(criado_em, '-3 hours') = date('now', '-3 hours')
    AND status IN ('PAGO', 'EM_PREPARO', 'PRONTO', 'SAIU_ENTREGA', 'ENTREGUE', 'CONFIRMADO_CLIENTE')
  `).first() as any

  const faturamentoMes = await db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total
    FROM pedidos
    WHERE strftime('%Y-%m', criado_em, '-3 hours') = strftime('%Y-%m', 'now', '-3 hours')
    AND status IN ('PAGO', 'EM_PREPARO', 'PRONTO', 'SAIU_ENTREGA', 'ENTREGUE', 'CONFIRMADO_CLIENTE')
  `).first() as any

  const ticketMedio = await db.prepare(`
    SELECT COALESCE(AVG(total), 0) as total
    FROM pedidos
    WHERE status IN ('PAGO', 'EM_PREPARO', 'PRONTO', 'SAIU_ENTREGA', 'ENTREGUE', 'CONFIRMADO_CLIENTE')
  `).first() as any

  // Rankings
  const produtosTop = await db.prepare(`
    SELECT p.nome, SUM(ip.quantidade) as vendidos, SUM(ip.subtotal) as faturamento
    FROM itens_pedido ip
    LEFT JOIN produtos p ON p.id = ip.produto_id
    WHERE p.nome IS NOT NULL
    GROUP BY ip.produto_id, p.nome
    ORDER BY vendidos DESC
    LIMIT 10
  `).all() as any

  const clientesTop = await db.prepare(`
    SELECT c.nome, COUNT(pe.id) as pedidos, COALESCE(SUM(pe.total), 0) as total_gasto
    FROM clientes c
    LEFT JOIN pedidos pe ON pe.cliente_id = c.id
    AND pe.status IN ('PAGO', 'EM_PREPARO', 'PRONTO', 'SAIU_ENTREGA', 'ENTREGUE', 'CONFIRMADO_CLIENTE')
    GROUP BY c.id
    ORDER BY total_gasto DESC
    LIMIT 10
  `).all() as any

  const porStatus = await db.prepare(`
    SELECT status, COUNT(*) as total
    FROM pedidos
    GROUP BY status
    ORDER BY total DESC
  `).all() as any

  const maxVendidos = produtosTop.results.length ? produtosTop.results[0].vendidos : 1
  const maxGasto = clientesTop.results.length ? clientesTop.results[0].total_gasto : 1

  const conteudo = `
    <style>
      .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:18px; margin-bottom:30px; }
      .card { background:#fff; padding:22px; border-radius:15px; box-shadow:0 3px 15px rgba(0,0,0,.08); }
      .card h4 { color:#777; margin:0 0 8px; font-size:13px; text-transform:uppercase; letter-spacing:.5px; }
      .card h2 { margin:0; font-size:26px; color:#111; }
      .card.destaque h2 { color:#ff6b00; }
      .card.verde h2 { color:#28a745; }
      .card.azul h2 { color:#007bff; }
      .bloco { background:#fff; padding:25px; border-radius:15px; margin-bottom:25px; box-shadow:0 3px 15px rgba(0,0,0,.08); }
      .bloco h3 { margin:0 0 20px; color:#333; font-size:17px; }
      table { width:100%; border-collapse:collapse; }
      th, td { padding:12px; text-align:left; border-bottom:1px solid #eee; font-size:14px; }
      th { background:#f8f9fa; color:#495057; font-size:12px; text-transform:uppercase; }
      tr:hover { background:#f9f9f9; }
      .barra { background:#f0f0f0; border-radius:10px; height:10px; overflow:hidden; margin-top:6px; }
      .barra .preenchimento { background:linear-gradient(90deg,#ff6b00,#ff9248); height:100%; border-radius:10px; }
      .linha-item { padding:8px 0; }
      .linha-item .titulo { display:flex; justify-content:space-between; font-size:14px; margin-bottom:2px; }
      .status-pill { padding:5px 12px; border-radius:20px; font-size:12px; font-weight:bold; color:#fff; display:inline-block; min-width:110px; text-align:center; }
      .duas-colunas { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
      @media (max-width: 900px) { .duas-colunas { grid-template-columns:1fr; } }
    </style>

    <h1>📊 Relatórios</h1>

    <div class="cards">
      <div class="card destaque">
        <h4>💰 Faturamento Hoje</h4>
        <h2>R$ ${brl(faturamentoHoje?.total)}</h2>
      </div>
      <div class="card verde">
        <h4>📅 Faturamento do Mês</h4>
        <h2>R$ ${brl(faturamentoMes?.total)}</h2>
      </div>
      <div class="card azul">
        <h4>🎯 Ticket Médio</h4>
        <h2>R$ ${brl(ticketMedio?.total)}</h2>
      </div>
      <div class="card">
        <h4>📦 Total de Pedidos</h4>
        <h2>${totalPedidos?.total || 0}</h2>
      </div>
      <div class="card">
        <h4>👥 Total de Clientes</h4>
        <h2>${totalClientes?.total || 0}</h2>
      </div>
    </div>

    <div class="duas-colunas">
      <div class="bloco">
        <h3>🥩 Produtos Mais Vendidos</h3>
        ${produtosTop.results.length === 0 ? '<p style="color:#888;">Nenhuma venda registrada ainda.</p>' :
          produtosTop.results.map((p: any) => `
            <div class="linha-item">
              <div class="titulo">
                <span><strong>${p.nome}</strong></span>
                <span>${p.vendidos} vendidos · R$ ${brl(p.faturamento)}</span>
              </div>
              <div class="barra">
                <div class="preenchimento" style="width:${Math.round((p.vendidos / maxVendidos) * 100)}%"></div>
              </div>
            </div>
          `).join('')
        }
      </div>

      <div class="bloco">
        <h3>👥 Clientes que Mais Compram</h3>
        ${clientesTop.results.length === 0 ? '<p style="color:#888;">Nenhum cliente com pedidos ainda.</p>' :
          clientesTop.results.map((cli: any) => `
            <div class="linha-item">
              <div class="titulo">
                <span><strong>${cli.nome}</strong></span>
                <span>${cli.pedidos} pedidos · R$ ${brl(cli.total_gasto)}</span>
              </div>
              <div class="barra">
                <div class="preenchimento" style="width:${Math.round((cli.total_gasto / maxGasto) * 100)}%"></div>
              </div>
            </div>
          `).join('')
        }
      </div>
    </div>

    <div class="bloco">
      <h3>📦 Pedidos por Status</h3>
      ${porStatus.results.length === 0 ? '<p style="color:#888;">Nenhum pedido registrado.</p>' : `
        <table>
          <tr>
            <th>Status</th>
            <th>Quantidade</th>
            <th style="width:50%;">Proporção</th>
          </tr>
          ${porStatus.results.map((s: any) => {
            const totalGeral = porStatus.results.reduce((a: number, b: any) => a + b.total, 0)
            const perc = totalGeral > 0 ? (s.total / totalGeral) * 100 : 0
            const cores: any = {
              AGUARDANDO_PAGAMENTO: '#ffc107', AGUARDANDO_PIX: '#ffc107',
              PAGO: '#28a745', EM_PREPARO: '#17a2b8', PRONTO: '#007bff',
              SAIU_ENTREGA: '#6f42c1', ENTREGUE: '#20c997', CONFIRMADO_CLIENTE: '#20c997',
              CANCELADO: '#dc3545', COMANDA_ABERTA: '#e83e8c'
            }
            return `
              <tr>
                <td><span class="status-pill" style="background:${cores[s.status] || '#6c757d'}">${LABEL_STATUS[s.status] || s.status}</span></td>
                <td><strong>${s.total}</strong></td>
                <td>
                  <div style="display:flex; align-items:center; gap:10px;">
                    <div class="barra" style="flex:1;">
                      <div class="preenchimento" style="width:${perc.toFixed(1)}%; background:${cores[s.status] || '#6c757d'}"></div>
                    </div>
                    <span style="font-size:13px; color:#666; min-width:55px;">${perc.toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            `
          }).join('')}
        </table>
      `}
    </div>
  `

  return c.html(renderLayout('Relatórios', conteudo, 'relatorios'))
})

export default app