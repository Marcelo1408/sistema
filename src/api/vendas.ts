import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

async function colunas(db: D1Database, tabela: string): Promise<string[]> {
  try {
    const r = await db.prepare(`PRAGMA table_info(${tabela})`).all()
    return (r.results as any[]).map((x) => x.name)
  } catch { return [] }
}

function pick(cols: string[], opcoes: string[]): string | null {
  for (const o of opcoes) if (cols.includes(o)) return o
  return null
}

async function itensDe(db: D1Database, chave: any): Promise<string> {
  try {
    const r = await db.prepare(`
      SELECT ip.quantidade AS qtd, COALESCE(ip.nome_item, pr.nome) AS nome
      FROM itens_pedido ip LEFT JOIN produtos pr ON pr.id = ip.produto_id
      WHERE ip.pedido_id = ?
    `).bind(chave).all()
    return (r.results as any[]).map((i) => `${i.qtd}x ${i.nome || 'Item'}`).join('; ')
  } catch { return '' }
}

// ---------- HISTÓRICO UNIFICADO ----------
app.get('/historico', async (c) => {
  const agora = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const dataInicio = c.req.query('data_inicio') || `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-01`
  const dataFim = c.req.query('data_fim') || `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate())}`

  const linhas: any[] = []

  try {
    const cols = await colunas(c.env.DB, 'pedidos')
    const dataCol = pick(cols, ['criado_em', 'data', 'data_pedido', 'created_at'])
    if (dataCol) {
      const r = await c.env.DB.prepare(`
        SELECT p.*, c.nome AS cliente_nome, c.telefone AS cliente_tel, c.endereco AS cliente_end, c.numero AS cliente_num, c.bairro AS cliente_bai, c.cidade AS cliente_cid
        FROM pedidos p LEFT JOIN clientes c ON c.id = p.cliente_id
        WHERE date(p.${dataCol}) BETWEEN ? AND ? ORDER BY p.${dataCol} DESC
      `).bind(dataInicio, dataFim).all()
      for (const p of r.results as any[]) {
        const end = [p.cliente_end ? `${p.cliente_end}${p.cliente_num ? ', ' + p.cliente_num : ''}` : '', p.cliente_bai, p.cliente_cid].filter(Boolean).join(' - ')
        linhas.push({
          origem: p.origem === 'AVULSA' ? 'AVULSA' : 'ONLINE',
          pedido_id: p.id,
          data: String(p[dataCol] || '').slice(0, 10),
          hora: String(p[dataCol] || '').slice(11, 16),
          cliente: p.cliente_nome || p.nome || 'Cliente',
          itens: await itensDe(c.env.DB, p.id),
          endereco: String(p.tipo_pedido || '').toLowerCase() === 'entrega' ? end : '',
          total: Number(p.total) || 0,
          taxa: Number(p.taxa_entrega || p.taxa || 0),
          pagamento: p.pagamento || p.forma_pagamento || '-'
        })
      }
    }
  } catch {}

  try {
    const cols = await colunas(c.env.DB, 'comandas')
    const dataCol = pick(cols, ['data_fechamento', 'criado_em'])
    if (dataCol) {
      const r = await c.env.DB.prepare(
        `SELECT * FROM comandas WHERE status = 'fechada' AND date(${dataCol}) BETWEEN ? AND ? ORDER BY ${dataCol} DESC`
      ).bind(dataInicio, dataFim).all()
      for (const cm of r.results as any[]) {
        const chave = cm.pedido_id != null ? cm.pedido_id : cm.id
        linhas.push({
          origem: 'COMANDA',
          pedido_id: cm.pedido_id != null ? cm.pedido_id : cm.id,
          data: String(cm[dataCol] || '').slice(0, 10),
          hora: String(cm[dataCol] || '').slice(11, 16),
          cliente: cm.nome_cliente ? `${cm.nome_cliente} (Mesa ${cm.mesa_numero})` : `Mesa ${cm.mesa_numero}`,
          itens: await itensDe(c.env.DB, chave),
          endereco: '',
          total: Number(cm.total) || 0,
          taxa: 0,
          pagamento: cm.forma_pagamento || cm.pagamento || '-'
        })
      }
    }
  } catch {}

  try {
    const r = await c.env.DB.prepare(
      `SELECT * FROM vendas_avulsas WHERE date(data_venda) BETWEEN ? AND ? ORDER BY data_venda DESC`
    ).bind(dataInicio, dataFim).all()
    for (const v of r.results as any[]) {
      if (v.pedido_id) continue
      let itensStr = ''
      try {
        const arr = JSON.parse(v.itens || '[]')
        itensStr = arr.map((i: any) => `${i.quantidade}x ${i.nome}`).join('; ')
      } catch {}
      const end = [v.endereco ? `${v.endereco}${v.numero ? ', ' + v.numero : ''}` : '', v.bairro, v.cidade].filter(Boolean).join(' - ')
      linhas.push({
        origem: 'AVULSA',
        pedido_id: null,
        data: String(v.data_venda || '').slice(0, 10),
        hora: String(v.criado_em || '').slice(11, 16),
        cliente: v.cliente_nome || 'Cliente balcão',
        itens: itensStr,
        endereco: v.tipo_pedido === 'ENTREGA' ? end : '',
        total: Number(v.total) || 0,
        taxa: Number(v.taxa_entrega) || 0,
        pagamento: v.pagamento || '-'
      })
    }
  } catch {}

  linhas.sort((a, b) => (b.data + ' ' + b.hora).localeCompare(a.data + ' ' + a.hora))
  return c.json({ linhas, dataInicio, dataFim })
})

// ---------- CRIAR VENDA AVULSA (cliente + pedido + itens + financeiro) ----------
app.post('/', async (c) => {
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ erro: 'Corpo inválido.' }, 400) }

  const nome = String(body.cliente_nome || '').trim()
  if (!nome) return c.json({ erro: 'Informe o nome do cliente.' }, 400)

  const itensBrutos = Array.isArray(body.itens) ? body.itens : []
  const itensNorm = itensBrutos
    .filter((i: any) => String(i.nome || '').trim() && Number(i.preco_unitario) > 0)
    .map((i: any) => {
      const qtd = Number(i.quantidade) || 1
      const preco = Number(i.preco_unitario) || 0
      return { nome: String(i.nome).trim(), quantidade: qtd, preco_unitario: preco, subtotal: +(qtd * preco).toFixed(2) }
    })
  if (!itensNorm.length) return c.json({ erro: 'Adicione pelo menos um item com nome e preço.' }, 400)

  const subtotal = +itensNorm.reduce((s: number, i: any) => s + i.subtotal, 0).toFixed(2)
  const taxa = +Number(body.taxa_entrega || 0).toFixed(2)
  const total = +(subtotal + taxa).toFixed(2)
  const pagamento = String(body.pagamento || 'DINHEIRO')
  const tipo_pedido = String(body.tipo_pedido || 'BALCAO')
  const data_venda = String(body.data_venda || new Date().toISOString().slice(0, 10))
  const observacao = String(body.observacao || '').trim()
  const telefone = String(body.cliente_telefone || '').replace(/\D/g, '')
  const endereco = String(body.endereco || '').trim()
  const numero = String(body.numero || '').trim()
  const bairro = String(body.bairro || '').trim()
  const cidade = String(body.cidade || '').trim()

  // ----- 1) Cria/vincula o CLIENTE (nome, telefone e endereço vivem aqui) -----
  let clienteId: number | null = null
  try {
    if (telefone) {
      const ex = await c.env.DB.prepare('SELECT id FROM clientes WHERE telefone = ? LIMIT 1').bind(telefone).first() as any
      clienteId = ex?.id ?? null
    }
    if (!clienteId) {
      const colsCli = await colunas(c.env.DB, 'clientes')
      const valsCli: Record<string, any> = {
        nome, telefone, endereco, numero, bairro, cidade,
        complemento: '', referencia: '', cep: '', uf: ''
      }
      const usadasCli = colsCli.filter((cn) => cn !== 'id' && Object.prototype.hasOwnProperty.call(valsCli, cn))
      if (usadasCli.length) {
        const rc = await c.env.DB.prepare(
          `INSERT INTO clientes (${usadasCli.join(', ')}) VALUES (${usadasCli.map(() => '?').join(', ')})`
        ).bind(...usadasCli.map((cn) => valsCli[cn])).run()
        clienteId = (rc.meta.last_row_id as number) || null
      }
    } else if (endereco) {
      try {
        await c.env.DB.prepare('UPDATE clientes SET endereco = ?, numero = ?, bairro = ?, cidade = ? WHERE id = ?')
          .bind(endereco, numero, bairro, cidade, clienteId).run()
      } catch {}
    }
  } catch {}

  // ----- 2) Cria o PEDIDO (adaptado às colunas reais + cliente_id) -----
  const tipoPedidos = tipo_pedido === 'ENTREGA' ? 'entrega' : 'retirada'
  const statusPedido = tipo_pedido === 'ENTREGA' ? 'PAGO' : 'ENTREGUE'

  const cfg = await c.env.DB.prepare('SELECT expediente_aberto_em FROM configuracoes ORDER BY id ASC LIMIT 1').first() as any
  const exp = String(cfg?.expediente_aberto_em || '')
  const agora = new Date()
  let criadoEm: string
  if (/T.+Z$/.test(exp)) criadoEm = agora.toISOString()
  else if (exp.includes('T')) criadoEm = agora.toISOString().slice(0, 19)
  else criadoEm = agora.toISOString().replace('T', ' ').slice(0, 19)

  const colsPed = await colunas(c.env.DB, 'pedidos')
  const valores: Record<string, any> = {
    cliente_id: clienteId,
    nome, telefone, endereco, numero, bairro, cidade,
    complemento: '', referencia: '',
    pagamento, tipo_pedido: tipoPedidos,
    taxa_entrega: taxa, distancia_km: 0,
    total, status: statusPedido, status_pagamento: 'PAGO',
    origem: 'AVULSA', criado_em: criadoEm
  }
  const dataColPed = pick(colsPed, ['criado_em', 'data', 'data_pedido', 'created_at'])
  if (dataColPed && dataColPed !== 'criado_em') {
    valores[dataColPed] = criadoEm
    delete valores.criado_em
  }
  const usadas = colsPed.filter((cn) => cn !== 'id' && Object.prototype.hasOwnProperty.call(valores, cn))

  let pedidoId: number | null = null
  let erroPedido = ''
  if (usadas.length) {
    try {
      const sql = `INSERT INTO pedidos (${usadas.join(', ')}) VALUES (${usadas.map(() => '?').join(', ')})`
      const r = await c.env.DB.prepare(sql).bind(...usadas.map((cn) => valores[cn])).run()
      pedidoId = (r.meta.last_row_id as number) || null
    } catch (e: any) {
      erroPedido = e?.message || String(e)
    }
  } else {
    erroPedido = 'Tabela pedidos sem colunas reconhecidas.'
  }

  if (!pedidoId) {
    return c.json({ sucesso: false, erro: 'Falha ao criar o PEDIDO (a venda NÃO foi salva): ' + erroPedido }, 500)
  }

  // ----- 3) Itens do pedido (nome real para a etiqueta) -----
  for (const i of itensNorm) {
    try {
      await c.env.DB.prepare(
        `INSERT INTO itens_pedido (pedido_id, produto_id, nome_item, quantidade, valor_unitario, subtotal) VALUES (?,?,?,?,?,?)`
      ).bind(pedidoId, null, i.nome, i.quantidade, i.preco_unitario, i.subtotal).run()
    } catch {
      try {
        await c.env.DB.prepare(
          `INSERT INTO itens_pedido (pedido_id, nome_item, quantidade, subtotal) VALUES (?,?,?,?)`
        ).bind(pedidoId, i.nome, i.quantidade, i.subtotal).run()
      } catch {}
    }
  }

  // ----- 4) Registro da venda avulsa -----
  let vendaId: number | null = null
  try {
    const vr = await c.env.DB.prepare(`
      INSERT INTO vendas_avulsas (cliente_nome, cliente_telefone, tipo_pedido, pagamento, itens, subtotal, taxa_entrega, total, observacao, data_venda, endereco, numero, bairro, cidade, pedido_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(nome, telefone, tipo_pedido, pagamento, JSON.stringify(itensNorm), subtotal, taxa, total, observacao, data_venda, endereco, numero, bairro, cidade, pedidoId).run()
    vendaId = (vr.meta.last_row_id as number) || null
  } catch {
    try {
      const vr = await c.env.DB.prepare(`
        INSERT INTO vendas_avulsas (cliente_nome, cliente_telefone, tipo_pedido, pagamento, itens, subtotal, taxa_entrega, total, observacao, data_venda, pedido_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(nome, telefone, tipo_pedido, pagamento, JSON.stringify(itensNorm), subtotal, taxa, total, observacao, data_venda, pedidoId).run()
      vendaId = (vr.meta.last_row_id as number) || null
    } catch {}
  }

  // ----- 5) ENTRADA no financeiro -----
  const itensStr = itensNorm.map((i: any) => `${i.quantidade}x ${i.nome}`).join('; ')
  const endCompleto = [endereco ? `${endereco}${numero ? ', ' + numero : ''}` : '', bairro, cidade].filter(Boolean).join(' - ')
  const obsFin = JSON.stringify({ origem: 'AVULSA', pedido_id: pedidoId, itens: itensStr, taxa_entrega: taxa, endereco: endCompleto })
  try {
    await c.env.DB.prepare(
      `INSERT INTO financeiro (tipo, descricao, valor, data_movimento, forma_pagamento, categoria, observacao)
       VALUES ('ENTRADA', ?, ?, ?, ?, 'VENDAS', ?)`
    ).bind(`Venda avulsa - ${nome}`, total, data_venda, pagamento, obsFin).run()
  } catch {
    try {
      await c.env.DB.prepare(
        `INSERT INTO financeiro (tipo, descricao, valor, data_movimento) VALUES ('ENTRADA', ?, ?, ?)`
      ).bind(`Venda avulsa - ${nome}`, total, data_venda).run()
    } catch {}
  }

  return c.json({ sucesso: true, total, pedido_id: pedidoId, venda_id: vendaId, cliente_id: clienteId })
})

export default app