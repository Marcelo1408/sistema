import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

const brl = (v: number) => (v || 0).toFixed(2).replace('.', ',')

const dataBr = (d: string) => {
  if (!d) return '-'
  try {
    return new Date(d.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    })
  } catch { return d }
}

const LABEL_STATUS: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: 'Aguardando Pagto', AGUARDANDO_PIX: 'Aguardando PIX',
  PAGO: 'Pago', EM_PREPARO: 'Em Preparo', PRONTO: 'Pronto',
  SAIU_ENTREGA: 'Saiu p/ Entrega', ENTREGUE: 'Entregue',
  CONFIRMADO_CLIENTE: 'Confirmado', CANCELADO: 'Cancelado',
  COMANDA_ABERTA: 'Comanda Aberta'
}

const COR_STATUS: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: '#ffc107', AGUARDANDO_PIX: '#ffc107',
  PAGO: '#28a745', EM_PREPARO: '#17a2b8', PRONTO: '#007bff',
  SAIU_ENTREGA: '#6f42c1', ENTREGUE: '#20c997', CONFIRMADO_CLIENTE: '#20c997',
  CANCELADO: '#dc3545', COMANDA_ABERTA: '#e83e8c'
}

app.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))

  const cliente = await c.env.DB.prepare('SELECT * FROM clientes WHERE id = ?').bind(id).first() as any
  if (!cliente) return c.html('<h1>Cliente não encontrado</h1>')

  const pedidos = await c.env.DB.prepare(`
    SELECT * FROM pedidos WHERE cliente_id = ? ORDER BY id DESC
  `).bind(id).all() as any

  // Itens de cada pedido
  for (const p of pedidos.results) {
    const itens = await c.env.DB.prepare(`
      SELECT ip.*, pr.nome AS produto
      FROM itens_pedido ip
      LEFT JOIN produtos pr ON pr.id = ip.produto_id
      WHERE ip.pedido_id = ?
      ORDER BY ip.id ASC
    `).bind(p.id).all()
    p.itens = itens.results
  }

  // Estatísticas (desconsidera cancelados)
  const validos = pedidos.results.filter((p: any) => p.status !== 'CANCELADO')
  const totalGasto = validos.reduce((a: number, p: any) => a + (parseFloat(p.total) || 0), 0)
  const ticketMedio = validos.length ? totalGasto / validos.length : 0
  const ultimoPedido = pedidos.results.length ? pedidos.results[0].criado_em : null

  const conteudo = `
    <style>
      .voltar { display:inline-block; margin-bottom:20px; color:#ff6b00; text-decoration:none; font-weight:bold; }
      .cabecalho { background:#fff; border-radius:15px; padding:25px; box-shadow:0 3px 15px rgba(0,0,0,.08); margin-bottom:25px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px; }
      .cabecalho h1 { margin:0 0 5px; color:#333; }
      .cabecalho p { margin:0; color:#666; }
      .badge-desde { background:#e7f1ff; color:#084298; padding:6px 14px; border-radius:20px; font-size:13px; font-weight:bold; }
      .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:18px; margin-bottom:25px; }
      .card { background:#fff; padding:22px; border-radius:15px; box-shadow:0 3px 15px rgba(0,0,0,.08); }
      .card h4 { color:#777; margin:0 0 8px; font-size:13px; text-transform:uppercase; }
      .card h2 { margin:0; font-size:26px; color:#111; }
      .card.laranja h2 { color:#ff6b00; }
      .card.verde h2 { color:#28a745; }
      .bloco { background:#fff; padding:25px; border-radius:15px; margin-bottom:25px; box-shadow:0 3px 15px rgba(0,0,0,.08); }
      .bloco h3 { margin:0 0 20px; color:#333; font-size:17px; }
      .dados-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:15px; }
      .dado label { display:block; color:#888; font-size:12px; text-transform:uppercase; margin-bottom:3px; }
      .dado span { color:#333; font-weight:bold; font-size:15px; }
      table { width:100%; border-collapse:collapse; }
      th, td { padding:12px; text-align:left; border-bottom:1px solid #eee; font-size:14px; }
      th { background:#f8f9fa; color:#495057; font-size:12px; text-transform:uppercase; }
      .status-pill { padding:5px 12px; border-radius:20px; font-size:12px; font-weight:bold; color:#fff; display:inline-block; }
      details { margin-top:8px; }
      summary { cursor:pointer; color:#007bff; font-size:13px; font-weight:bold; }
      .itens-lista { margin-top:10px; padding:10px; background:#f9f9f9; border-radius:8px; }
      .item-linha { display:flex; justify-content:space-between; padding:4px 0; font-size:13px; color:#555; }
    </style>

    <a href="/clientes" class="voltar">← Voltar para Clientes</a>

   <div class="cabecalho">
  <div>
    <h1>👤 ${cliente.nome}</h1>
    <p>📞 ${cliente.telefone || '-'}</p>
  </div>
  <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
    <a href="/clientes/editar/${cliente.id}" style="background:#0d6efd; color:#fff; padding:8px 16px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:14px;">✏️ Editar</a>
    <span class="badge-desde">🗓️ Cliente desde ${dataBr(cliente.criado_em)}</span>
  </div>
</div>

    <div class="cards">
      <div class="card laranja">
        <h4>📦 Total de Pedidos</h4>
        <h2>${pedidos.results.length}</h2>
      </div>
      <div class="card verde">
        <h4>💰 Total Gasto</h4>
        <h2>R$ ${brl(totalGasto)}</h2>
      </div>
      <div class="card">
        <h4>🎯 Ticket Médio</h4>
        <h2>R$ ${brl(ticketMedio)}</h2>
      </div>
      <div class="card">
        <h4>🕐 Último Pedido</h4>
        <h2 style="font-size:18px;">${ultimoPedido ? dataBr(ultimoPedido) : 'Nunca pediu'}</h2>
      </div>
    </div>

    <div class="bloco">
      <h3>📍 Dados Cadastrais</h3>
      <div class="dados-grid">
        <div class="dado"><label>Telefone</label><span>${cliente.telefone || '-'}</span></div>
        <div class="dado"><label>Endereço</label><span>${cliente.endereco || '-'}, ${cliente.numero || ''}</span></div>
        <div class="dado"><label>Bairro</label><span>${cliente.bairro || '-'}</span></div>
        <div class="dado"><label>Complemento</label><span>${cliente.complemento || '-'}</span></div>
        <div class="dado"><label>Referência</label><span>${cliente.referencia || '-'}</span></div>
        <div class="dado"><label>CEP</label><span>${cliente.cep || '-'}</span></div>
      </div>
    </div>

    <div class="bloco">
      <h3>📋 Histórico de Pedidos (${pedidos.results.length})</h3>
      ${pedidos.results.length === 0 ? '<p style="color:#888; text-align:center;">Este cliente ainda não fez pedidos.</p>' : `
        <table>
          <tr>
            <th>#</th>
            <th>Data</th>
            <th>Itens</th>
            <th>Total</th>
            <th>Status</th>
          </tr>
          ${pedidos.results.map((p: any) => `
            <tr>
              <td><a href="/pedidos/detalhes/${p.id}" style="color:#007bff; font-weight:bold;">#${p.id}</a></td>
              <td>${dataBr(p.criado_em)}</td>
              <td>
                <details>
                  <summary>Ver ${p.itens.length} item(ns)</summary>
                  <div class="itens-lista">
                    ${p.itens.length === 0 ? '<span style="color:#888;">Sem itens registrados.</span>' :
                      p.itens.map((i: any) => `
                        <div class="item-linha">
                          <span>${i.quantidade}x ${i.produto || i.nome_item || 'Item'}</span>
                          <span>R$ ${brl(i.subtotal)}</span>
                        </div>
                      `).join('')
                    }
                  </div>
                </details>
              </td>
              <td><strong>R$ ${brl(p.total)}</strong></td>
              <td><span class="status-pill" style="background:${COR_STATUS[p.status] || '#6c757d'}">${LABEL_STATUS[p.status] || p.status}</span></td>
            </tr>
          `).join('')}
        </table>
      `}
    </div>
  `

  return c.html(renderLayout('Cliente: ' + cliente.nome, conteudo, 'clientes'))
})

export default app