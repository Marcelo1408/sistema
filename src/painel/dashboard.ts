import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Formata valor em R$
const brl = (v: number) => (v || 0).toFixed(2).replace('.', ',')

// Formata hora (criado_em vem em UTC, convertemos para horário de Brasília)
const horaBr = (dt: string) => {
  try {
    return new Date(dt.replace(' ', 'T') + 'Z').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

// Cores e nomes dos status
const STATUS_INFO: Record<string, { label: string; cor: string }> = {
  AGUARDANDO_PAGAMENTO: { label: 'Aguardando Pagto', cor: '#ffc107' },
  AGUARDANDO_PIX: { label: 'Aguardando PIX', cor: '#ffc107' },
  PAGO: { label: 'Pago', cor: '#28a745' },
  EM_PREPARO: { label: 'Em Preparo', cor: '#17a2b8' },
  PRONTO: { label: 'Pronto', cor: '#007bff' },
  SAIU_ENTREGA: { label: 'Saiu p/ Entrega', cor: '#6f42c1' },
  ENTREGUE: { label: 'Entregue', cor: '#20c997' },
  CONFIRMADO_CLIENTE: { label: 'Confirmado', cor: '#20c997' },
  CANCELADO: { label: 'Cancelado', cor: '#dc3545' }
}

app.get('/', async (c) => {
  const db = c.env.DB

  // Nota: criado_em é salvo em UTC. O modificador '-3 hours' ajusta para horário de Brasília.
  const hoje = `date(criado_em, '-3 hours') = date('now', '-3 hours')`

  // Configurações da loja (aberta/fechada)
  const config = await db.prepare('SELECT * FROM configuracoes WHERE id = 1').first() as any
  const lojaAberta = config?.loja_aberta === 1

  // Faturamento e pedidos de hoje
  const fat = await db.prepare(`
    SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS qtd
    FROM pedidos WHERE ${hoje} AND status != 'CANCELADO'
  `).first() as any

  // Pedidos por status (hoje)
  const porStatus = await db.prepare(`
    SELECT status, COUNT(*) AS qtd FROM pedidos WHERE ${hoje} GROUP BY status
  `).all() as any
  const statusMap: Record<string, number> = {}
  for (const s of porStatus.results) statusMap[s.status] = s.qtd

  const aguardando = (statusMap['AGUARDANDO_PAGAMENTO'] || 0) + (statusMap['AGUARDANDO_PIX'] || 0)
  const emPreparo = statusMap['EM_PREPARO'] || 0
  const saiuEntrega = statusMap['SAIU_ENTREGA'] || 0
  const entregues = (statusMap['ENTREGUE'] || 0) + (statusMap['CONFIRMADO_CLIENTE'] || 0)

  // Clientes novos hoje
  const clientesNovos = await db.prepare(`
    SELECT COUNT(*) AS qtd FROM clientes WHERE ${hoje}
  `).first() as any

  // Ticket médio
  const ticketMedio = fat.qtd > 0 ? fat.total / fat.qtd : 0

  // Top 5 produtos mais vendidos (histórico)
  const topProdutos = await db.prepare(`
    SELECT COALESCE(ip.nome_item, p.nome) AS nome,
           SUM(ip.quantidade) AS qtd,
           SUM(ip.subtotal) AS total
    FROM itens_pedido ip
    LEFT JOIN produtos p ON p.id = ip.produto_id
    WHERE ip.nome_item IS NOT NULL OR ip.produto_id IS NOT NULL
    GROUP BY nome
    ORDER BY qtd DESC
    LIMIT 5
  `).all() as any
  const maxQtd = topProdutos.results.length ? topProdutos.results[0].qtd : 1

  // Últimos pedidos
  const ultimosPedidos = await db.prepare(`
    SELECT p.id, p.total, p.status, p.criado_em, c.nome
    FROM pedidos p
    LEFT JOIN clientes c ON c.id = p.cliente_id
    ORDER BY p.id DESC
    LIMIT 8
  `).all() as any

  // Totais gerais
  const gerais = await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM produtos WHERE ativo = 1) AS produtos,
      (SELECT COUNT(*) FROM clientes) AS clientes,
      (SELECT COUNT(*) FROM combos WHERE ativo = 1) AS combos,
      (SELECT COUNT(*) FROM bairros WHERE ativo = 1 AND entrega_disponivel = 1) AS bairros
  `).first() as any

  const conteudo = `
    <style>
      .dash-banner { background: linear-gradient(135deg, #ff6b00, #ff9248); color:#fff; border-radius:15px; padding:25px 30px; margin-bottom:25px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px; }
      .dash-banner h2 { margin:0 0 5px; font-size:24px; }
      .dash-banner p { margin:0; opacity:.9; }
      .dash-banner .situacao { background:rgba(255,255,255,.2); padding:10px 20px; border-radius:30px; font-weight:bold; }
      .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:18px; margin-bottom:25px; }
      .card { background:#fff; border-radius:15px; padding:20px; box-shadow:0 3px 15px rgba(0,0,0,.08); }
      .card .icone { font-size:26px; margin-bottom:8px; }
      .card h3 { margin:0; font-size:26px; color:#111; }
      .card p { margin:5px 0 0; color:#777; font-size:13px; }
      .card.destaque h3 { color:#ff6b00; }
      .duas-colunas { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
      @media (max-width: 900px) { .duas-colunas { grid-template-columns:1fr; } }
      .box { background:#fff; border-radius:15px; padding:20px 25px; box-shadow:0 3px 15px rgba(0,0,0,.08); margin-bottom:20px; }
      .box h3 { margin:0 0 15px; color:#333; font-size:17px; }
      .barra-item { margin-bottom:14px; }
      .barra-item .linha { display:flex; justify-content:space-between; font-size:14px; margin-bottom:5px; color:#444; }
      .barra-item .trilho { background:#f0f0f0; border-radius:10px; height:10px; overflow:hidden; }
      .barra-item .preenchimento { background:linear-gradient(90deg,#ff6b00,#ff9248); height:100%; border-radius:10px; }
      table { width:100%; border-collapse:collapse; }
      th, td { padding:10px 8px; text-align:left; border-bottom:1px solid #eee; font-size:14px; }
      th { color:#888; font-weight:600; font-size:12px; text-transform:uppercase; }
      td a { color:#0d6efd; text-decoration:none; font-weight:bold; }
      .pill { padding:4px 10px; border-radius:20px; font-size:11px; font-weight:bold; color:#fff; white-space:nowrap; }
      .resumo-geral { display:flex; gap:25px; flex-wrap:wrap; }
      .resumo-geral div { text-align:center; }
      .resumo-geral strong { display:block; font-size:24px; color:#ff6b00; }
      .resumo-geral span { color:#777; font-size:13px; }
    </style>

    <div class="dash-banner">
      <div>
        <h2>Olá, Marcelo! 👋</h2>
        <p>Este é o resumo de hoje da <strong>${config?.nome_empresa || 'sua espetaria'}</strong>.</p>
      </div>
      <div class="situacao">${lojaAberta ? '🟢 Loja Aberta' : '🔴 Loja Fechada'}</div>
    </div>

    <div class="cards">
      <div class="card destaque">
        <div class="icone">💰</div>
        <h3>R$ ${brl(fat.total)}</h3>
        <p>Faturamento de hoje</p>
      </div>
      <div class="card">
        <div class="icone">🧾</div>
        <h3>${fat.qtd}</h3>
        <p>Pedidos hoje</p>
      </div>
      <div class="card">
        <div class="icone">🎯</div>
        <h3>R$ ${brl(ticketMedio)}</h3>
        <p>Ticket médio</p>
      </div>
      <div class="card">
        <div class="icone">👥</div>
        <h3>${clientesNovos.qtd}</h3>
        <p>Clientes novos hoje</p>
      </div>
    </div>

    <div class="cards">
      <div class="card">
        <div class="icone">⏳</div>
        <h3>${aguardando}</h3>
        <p>Aguardando pagamento</p>
      </div>
      <div class="card">
        <div class="icone">🍳</div>
        <h3>${emPreparo}</h3>
        <p>Em preparo</p>
      </div>
      <div class="card">
        <div class="icone">🛵</div>
        <h3>${saiuEntrega}</h3>
        <p>Saíram para entrega</p>
      </div>
      <div class="card">
        <div class="icone">✅</div>
        <h3>${entregues}</h3>
        <p>Entregues hoje</p>
      </div>
    </div>

    <div class="duas-colunas">
      <div>
        <div class="box">
          <h3>🏆 Produtos Mais Vendidos</h3>
          ${topProdutos.results.length === 0 ? '<p style="color:#888;">Nenhuma venda registrada ainda.</p>' :
            topProdutos.results.map((p: any) => `
              <div class="barra-item">
                <div class="linha">
                  <span>${p.nome}</span>
                  <strong>${p.qtd}x · R$ ${brl(p.total)}</strong>
                </div>
                <div class="trilho"><div class="preenchimento" style="width:${Math.round((p.qtd / maxQtd) * 100)}%"></div></div>
              </div>
            `).join('')
          }
        </div>

        <div class="box">
          <h3>📌 Resumo Geral</h3>
          <div class="resumo-geral">
            <div><strong>${gerais.produtos}</strong><span>Produtos ativos</span></div>
            <div><strong>${gerais.combos}</strong><span>Combos ativos</span></div>
            <div><strong>${gerais.clientes}</strong><span>Clientes</span></div>
            <div><strong>${gerais.bairros}</strong><span>Bairros c/ entrega</span></div>
          </div>
        </div>
      </div>

      <div class="box">
        <h3>🕐 Últimos Pedidos</h3>
        ${ultimosPedidos.results.length === 0 ? '<p style="color:#888;">Nenhum pedido registrado ainda.</p>' : `
          <table>
            <tr><th>#</th><th>Cliente</th><th>Hora</th><th>Total</th><th>Status</th></tr>
            ${ultimosPedidos.results.map((p: any) => `
              <tr>
                <td><a href="/pedidos/detalhes/${p.id}">${p.id}</a></td>
                <td>${p.nome || '—'}</td>
                <td>${horaBr(p.criado_em)}</td>
                <td>R$ ${brl(p.total)}</td>
                <td><span class="pill" style="background:${(STATUS_INFO[p.status] || { cor: '#888' }).cor}">${(STATUS_INFO[p.status] || { label: p.status }).label}</span></td>
              </tr>
            `).join('')}
          </table>
        `}
      </div>
    </div>
  `

  return c.html(renderLayout('Dashboard', conteudo, 'dashboard'))
})

export default app