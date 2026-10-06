import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  GEMINI_API_KEY?: string
  MP_ACCESS_TOKEN: string
  WA_TOKEN?: string
  WA_PHONE_NUMBER_ID?: string
}

const app = new Hono<{ Bindings: Bindings }>()
const VERIFY_TOKEN = 'brasa2026'
const ORIGEM = 'https://chefdabrasa.shop'

// ================= UTILS =================
function norm(s: any): string {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}
const brl = (v: any) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',')

async function enviarWhats(c: any, para: string, texto: string) {
  const token = String(c.env.WA_TOKEN || '')
  const phoneId = String(c.env.WA_PHONE_NUMBER_ID || '')
  if (!token || !phoneId) return
  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'text', text: { body: texto } })
    })
  } catch {}
}

async function sessao(c: any, tel: string) {
  let s = await c.env.DB.prepare('SELECT * FROM wa_sessoes WHERE telefone = ?').bind(tel).first() as any
  if (!s) {
    await c.env.DB.prepare('INSERT INTO wa_sessoes (telefone) VALUES (?)').bind(tel).run()
    s = await c.env.DB.prepare('SELECT * FROM wa_sessoes WHERE telefone = ?').bind(tel).first() as any
  }
  return s
}
async function salvarSessao(c: any, tel: string, campos: any) {
  const chaves = Object.keys(campos)
  const sets = chaves.map(k => `${k} = ?`).join(', ')
  await c.env.DB.prepare(`UPDATE wa_sessoes SET ${sets}, atualizado_em = datetime('now') WHERE telefone = ?`)
    .bind(...chaves.map(k => campos[k]), tel).run()
}
async function logMsg(c: any, tel: string, papel: string, texto: string) {
  await c.env.DB.prepare('INSERT INTO wa_mensagens (telefone, papel, texto) VALUES (?,?,?)').bind(tel, papel, texto).run()
}

// ================= CONTEXTO DA IA =================
async function menuTexto(c: any): Promise<string> {
  const r = await c.env.DB.prepare(`
    SELECT p.nome, p.preco, COALESCE(c.nome, 'Outros') AS cat
    FROM produtos p LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.ativo = 1 ORDER BY c.nome, p.nome LIMIT 80
  `).all()
  const grupos: Record<string, string[]> = {}
  for (const p of r.results as any[]) {
    (grupos[p.cat] = grupos[p.cat] || []).push(`${p.nome} (${brl(p.preco)})`)
  }
  return Object.entries(grupos).map(([cat, itens]) => `【${cat}】 ${itens.join(', ')}`).join('\n')
}
async function produtosLista(c: any) {
  const r = await c.env.DB.prepare('SELECT id, nome, preco, categoria_id FROM produtos WHERE ativo = 1').all()
  return r.results as any[]
}
async function infoLoja(c: any): Promise<string> {
  const l = await c.env.DB.prepare('SELECT * FROM configuracoes WHERE id = 1').first() as any
  if (!l) return 'Dados da loja nao disponiveis.'
  return [
    `Nome: ${l.nome_empresa || ''}`,
    `Endereco: ${[l.endereco, l.numero, l.bairro, l.cidade].filter(Boolean).join(', ')}`,
    `Telefone: ${l.telefone || ''}`,
    `Status agora: ${Number(l.loja_aberta) === 1 ? 'ABERTA' : 'FECHADA'}`
  ].join(' | ')
}
async function promosTexto(c: any): Promise<string> {
  const linhas: string[] = []
  try {
    const r = await c.env.DB.prepare(`
      SELECT p.nome, p.preco FROM produtos p
      JOIN categorias cat ON cat.id = p.categoria_id
      WHERE UPPER(cat.nome) = 'PROMOCOES' AND p.ativo = 1 LIMIT 10
    `).all()
    for (const p of r.results as any[]) linhas.push(`${p.nome} por ${brl(p.preco)}`)
  } catch {}
  try {
    const r2 = await c.env.DB.prepare(`
      SELECT p.nome, pr.preco_promocional AS preco FROM promocoes pr
      JOIN produtos p ON p.id = pr.produto_id
      WHERE p.ativo = 1 LIMIT 10
    `).all()
    for (const p of r2.results as any[]) if (p.preco) linhas.push(`${p.nome} por ${brl(p.preco)}`)
  } catch {}
  return linhas.length ? linhas.join(' | ') : 'Nenhuma promocao ativa no momento.'
}

// ================= CÉREBRO (prompt da atendente) =================
function promptSistema(ctx: any): string {
  return `Voce e a ANA, atendente HUMANA do restaurante no WhatsApp. Nao existe roteiro fixo: voce conversa de verdade e se adapta a cada cliente.

ESTILO (sempre):
- Portugues do Brasil natural, caloroso e direto, como atendente de restaurante conversa no WhatsApp
- Respostas curtas (1 a 3 frases, maximo ~300 caracteres), no maximo 1 emoji, sem listas roboticas nem markdown
- NUNCA diga que e IA, bot, modelo ou assistente virtual. Se insistirem, diga que e "atendente da casa"
- Espelhe o cliente: se ele so diz "oi"/"boa noite", cumprimente de volta e puxe assunto pro pedido; se ele ja chega pedindo, va direto ao pedido

COMO ENTENDER ABERTURAS DIFERENTES (exemplos, nao limite):
- Cumprimento simples ("oi", "boa noite", "eai") => cumprimente, diga 1 destaque do dia e pergunte o que vai querer
- "quero ver o cardapio" / "me manda o menu" => coloque mostrar_cardapio=true e comente o que mais sai
- "qual e a promocao?" / "vi no instagram/facebook/story" => cite as PROMOCOES ATUAIS com preco; se ele descrever algo que viu fora, identifique o item mais parecido do MENU/PROMOCOES e confirme
- Pedido direto ("2 smash e uma coca") => registre (add) e confirme itens + total
- Pedido completo de uma vez (itens + endereco + pagamento) => registre tudo de uma vez e so confirme o fechamento
- "me indica algo" / "to em duvida" / restricoes ("sem carne", "algo leve") => sugira 1 ou 2 itens REAIS do menu com motivo curto
- Duvidas (horario, tempo de entrega, formas de pagamento, area de entrega, taxa) => responda com os DADOS DA LOJA
- Reclamacao, elogio, assunto fora => responda com empatia humana e conduza de volta pro pedido
- Nao entendeu => pergunte curto e natural, como gente faz

REGRAS DE OURO:
- So venda itens que EXISTEM no MENU, com os precos do MENU; nunca invente produto, preco ou promocao
- Antes de finalizar=true, mostre resumo (itens + total) e peca confirmacao explicita
- Entrega: use o ENDERECO SALVO se o cliente confirmar, senao peca endereco completo; retirada: sem taxa
- Pagamento: PIX (codigo na hora) ou pagar na entrega/retirada
- Sacola ja tem itens? Leve eles em conta na conversa (nao pergunte de novo o que ja sabe)

DADOS DA LOJA: ${ctx.infoLoja}
PROMOCOES ATIVAS: ${ctx.promos}
MENU COMPLETO:
${ctx.menu}

SACOLA ATUAL: ${JSON.stringify(ctx.sacola)}
TOTAL ATUAL: ${brl(ctx.total)}
ENDERECO SALVO DO CLIENTE: ${ctx.clienteEnd || 'nenhum'}
HISTORICO RECENTE DA CONVERSA:
${ctx.historico}

MENSAGEM DO CLIENTE AGORA: ${ctx.ultima}

Responda SOMENTE com JSON valido:
{
  "resposta": "mensagem humana para enviar",
  "mostrar_cardapio": false,
  "add": [{"nome": "nome do produto igual ao menu", "qtd": 1}],
  "remover": ["nome do produto"],
  "tipo_pedido": "entrega" | "retirada" | null,
  "endereco": {"endereco":"","numero":"","bairro":"","cidade":"","cep":""} | null,
  "pagamento": "PIX" | "PRESENCIAL" | null,
  "finalizar": false
}`
}

async function chamarAtendente(c: any, ctx: any): Promise<any> {
  const key = String(c.env.GEMINI_API_KEY || '')
  if (!key) return { resposta: 'Oi! To finalizando um atendimento aqui, ja te chamo 😊' }
  for (const modelo of ['gemini-3.6-flash', 'gemini-flash-latest']) {
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptSistema(ctx) }] }],
          generationConfig: { temperature: 0.7 }
        })
      })
      const j: any = await resp.json()
      if (!resp.ok) continue
      const texto = (j?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('')
      const m = texto.match(/\{[\s\S]*\}/)
      if (m) return JSON.parse(m[0])
    } catch {}
  }
  return { resposta: 'Oi! Sou a Ana, atendente da casa 😊 Me conta o que vai querer hoje!' }
}

// ================= MERCADO PAGO PIX =================
async function criarPixMp(c: any, valor: number, pedidoId: number, tel: string, nome: string) {
  const r = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + c.env.MP_ACCESS_TOKEN,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': 'wa-pedido-' + pedidoId
    },
    body: JSON.stringify({
      transaction_amount: +valor.toFixed(2),
      payment_method_id: 'pix',
      external_reference: String(pedidoId),
      description: 'Pedido #' + pedidoId + ' (WhatsApp)',
      payer: {
        email: `wa${tel}@cliente.chefdabrasa.shop`,
        first_name: nome || 'Cliente',
        identification: { type: 'CPF', number: '00000000000' }
      }
    })
  })
  const j: any = await r.json()
  return j?.point_of_interaction?.transaction_data || null
}
async function statusPagamentoMp(c: any, paymentId: string) {
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: 'Bearer ' + c.env.MP_ACCESS_TOKEN }
  })
  const j: any = await r.json()
  return j?.status || ''
}

// ================= PROCESSA MENSAGEM =================
async function processar(c: any, tel: string, texto: string) {
  await logMsg(c, tel, 'cliente', texto)
  const s = await sessao(c, tel)
  const sacola: any[] = JSON.parse(s.sacola || '[]')

  const n = norm(texto)
  if (s.pix_payment_id && (n.includes('pago') || n.includes('paguei') || n.includes('comprovante'))) {
    const st = await statusPagamentoMp(c, s.pix_payment_id)
    if (st === 'approved') {
      await c.env.DB.prepare(`UPDATE pedidos SET status = 'PAGO', status_pagamento = 'PAGO' WHERE id = ?`).bind(s.pedido_id).run()
      await salvarSessao(c, tel, { pix_payment_id: '', estado: 'CONVERSA' })
      const msg = `Pagamento confirmado ✅ Seu pedido #${s.pedido_id} ja esta na cozinha! Qualquer coisa e so chamar aqui 😊`
      await logMsg(c, tel, 'bot', msg); await enviarWhats(c, tel, msg)
    } else {
      const msg = 'Ainda nao identifiquei o pagamento aqui 😅 Assim que o PIX cair eu te aviso na hora, ta bom?'
      await logMsg(c, tel, 'bot', msg); await enviarWhats(c, tel, msg)
    }
    return
  }

  const historicoRows = await c.env.DB.prepare(
    'SELECT papel, texto FROM wa_mensagens WHERE telefone = ? ORDER BY id DESC LIMIT 12'
  ).bind(tel).all()
  const historico = (historicoRows.results as any[]).reverse()
    .map(h => `${h.papel === 'cliente' ? 'Cliente' : 'Ana'}: ${h.texto}`).join('\n')

  const cli = await c.env.DB.prepare('SELECT * FROM clientes WHERE telefone LIKE ? LIMIT 1').bind('%' + tel.slice(-9)).first() as any
  const clienteEnd = cli?.endereco ? `${cli.endereco}, ${cli.numero || ''} - ${cli.bairro || ''}` : ''
  const menu = await menuTexto(c)

  const ia = await chamarAtendente(c, {
    infoLoja: await infoLoja(c),
    promos: await promosTexto(c),
    menu,
    sacola,
    total: sacola.reduce((t, i) => t + i.subtotal, 0),
    clienteEnd,
    historico,
    ultima: texto
  })

  // Aplica as "maos" da IA na sacola
  const prods = await produtosLista(c)
  let novaSacola = [...sacola]
  for (const add of (ia.add || [])) {
    const alvo = norm(add.nome)
    const p = prods.find(x => norm(x.nome) === alvo) || prods.find(x => norm(x.nome).includes(alvo) || alvo.includes(norm(x.nome)))
    if (!p) continue
    const qtd = Number(add.qtd) || 1
    const ex = novaSacola.find(i => i.id === p.id)
    if (ex) ex.qtd += qtd
    else novaSacola.push({ id: p.id, nome: p.nome, preco: Number(p.preco), qtd })
  }
  for (const rem of (ia.remover || [])) {
    const alvo = norm(rem)
    novaSacola = novaSacola.filter(i => !norm(i.nome).includes(alvo) && !alvo.includes(norm(i.nome)))
  }
  novaSacola.forEach(i => i.subtotal = +(i.preco * i.qtd).toFixed(2))

  const campos: any = { sacola: JSON.stringify(novaSacola) }
  if (ia.tipo_pedido) campos.tipo_pedido = ia.tipo_pedido
  if (ia.endereco && ia.endereco.endereco) campos.endereco = JSON.stringify(ia.endereco)
  if (ia.pagamento) campos.pagamento = ia.pagamento

  // Finalizar pedido
  if (ia.finalizar && novaSacola.length) {
    const tipo = campos.tipo_pedido || s.tipo_pedido || 'entrega'
    let end = {} as any
    try { end = JSON.parse(campos.endereco || s.endereco || '{}') } catch {}
    if (!end.endereco && cli?.endereco) end = { endereco: cli.endereco, numero: cli.numero, bairro: cli.bairro, cidade: cli.cidade, cep: cli.cep }

    let taxa = 0
    if (tipo === 'entrega' && end.endereco) {
      try {
        const r = await fetch(ORIGEM + '/api/calculo-de-entrega', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(end)
        })
        const d: any = await r.json()
        if (d && !d.bloqueada) taxa = Number(d.taxa) || 0
      } catch {}
    }
    const subtotal = novaSacola.reduce((t, i) => t + i.subtotal, 0)
    const total = +(subtotal + taxa).toFixed(2)
    const pag = campos.pagamento || s.pagamento || 'PIX'

    let clienteId = cli?.id ?? null
    if (!clienteId) {
      const ins = await c.env.DB.prepare(
        'INSERT INTO clientes (nome, telefone, endereco, numero, bairro, cidade, cep) VALUES (?,?,?,?,?,?,?)'
      ).bind('Cliente WhatsApp', tel, end.endereco || '', end.numero || '', end.bairro || '', end.cidade || '', String(end.cep || '').replace(/\D/g, '')).run()
      clienteId = ins.meta.last_row_id as number
    }
    const ped = await c.env.DB.prepare(`
      INSERT INTO pedidos (cliente_id, nome, telefone, endereco, numero, bairro, cidade, pagamento, tipo_pedido, taxa_entrega, distancia_km, total, status, status_pagamento, origem, criado_em)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'WHATSAPP', datetime('now'))
    `).bind(clienteId, cli?.nome || 'Cliente WhatsApp', tel, end.endereco || '', end.numero || '', end.bairro || '', end.cidade || '',
      pag === 'PIX' ? 'PIX' : 'PRESENCIAL', tipo === 'entrega' ? 'entrega' : 'retirada', taxa, 0, total,
      'AGUARDANDO_PIX', 'AGUARDANDO_PIX').run()
    const pedidoId = ped.meta.last_row_id as number

    for (const i of novaSacola) {
      await c.env.DB.prepare(
        'INSERT INTO itens_pedido (pedido_id, produto_id, nome_item, quantidade, valor_unitario, subtotal) VALUES (?,?,?,?,?,?)'
      ).bind(pedidoId, i.id, i.nome, i.qtd, i.preco, i.subtotal).run()
    }

    campos.pedido_id = pedidoId
    campos.sacola = '[]'

    if (pag === 'PIX') {
      const tx = await criarPixMp(c, total, pedidoId, tel, cli?.nome || 'Cliente')
      if (tx?.qr_code) {
        campos.pix_payment_id = String(tx.payment_id || '')
        const msgPix = (ia.resposta || 'Pedido anotado!') +
          `\n\n*PIX copia e cola:*\n${tx.qr_code}\n\nAssim que pagar, me manda um "pago" aqui que eu confirmo na hora ✅`
        await logMsg(c, tel, 'bot', msgPix); await enviarWhats(c, tel, msgPix)
        await salvarSessao(c, tel, campos)
        return
      }
    }
    const msgOk = (ia.resposta || 'Pedido fechado!') + `\n\nPedido *#${pedidoId}* registrado! Total: *${brl(total)}*. Pagamento na ${tipo === 'entrega' ? 'entrega' : 'retirada'} 😊`
    await logMsg(c, tel, 'bot', msgOk); await enviarWhats(c, tel, msgOk)
    await salvarSessao(c, tel, campos)
    return
  }

  await salvarSessao(c, tel, campos)
  const resposta = ia.resposta || 'Me conta o que vai querer hoje 😊'
  await logMsg(c, tel, 'bot', resposta)
  await enviarWhats(c, tel, resposta)

  // Se a IA quis mostrar o cardapio, manda ele formatado logo depois
  if (ia.mostrar_cardapio) {
    const msgMenu = '📋 *Nosso cardápio:*\n\n' + menu.replace(/【/g, '*').replace(/】/g, '*\n')
    await logMsg(c, tel, 'bot', msgMenu)
    await enviarWhats(c, tel, msgMenu)
  }
}

// ================= WEBHOOK =================
app.get('/webhook', (c) => {
  const q = c.req.query()
  if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === VERIFY_TOKEN) {
    return c.text(q['hub.challenge'] || '')
  }
  return c.text('verify failed', 403)
})

app.post('/webhook', async (c) => {
  const body: any = await c.req.json().catch(() => ({}))
  const value = body?.entry?.[0]?.changes?.[0]?.value
  if (!value) return c.json({ ok: true })
  if (value.statuses) return c.json({ ok: true })
  const msg = value.messages?.[0]
  if (!msg) return c.json({ ok: true })
  const tel = String(msg.from || '')
  if (!tel || tel === String(c.env.WA_PHONE_NUMBER_ID || '')) return c.json({ ok: true })

  const texto = msg?.text?.body || ''
  if (!texto) {
    c.executionCtx.waitUntil(enviarWhats(c, tel, 'Por enquanto eu só consigo ler mensagens de texto 😅 Me escreve o que você quer, ta bom?'))
    return c.json({ ok: true })
  }
  c.executionCtx.waitUntil(processar(c, tel, texto))
  return c.json({ ok: true })
})

export default app