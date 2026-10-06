import { Hono } from 'hono'

type Bindings = { DB: D1Database; ASSETS: Fetcher }

const app = new Hono<{ Bindings: Bindings }>()

// ===== CONFIGURAÇÃO (mude aqui se quiser) =====
const APP_NOME = 'Brasa Express'
const ICON_URL = '/entregador/icon-moto.png?v=2'

// ===== Caminhos onde o ícone pode estar (procura em todos) =====
const ICON_CANDIDATOS = [
  '/img/icon-moto.png',
  '/cardapio/img/icon-moto.png',
  '/public/img/icon-moto.png',
  '/img/icon-moto.PNG',
]

// ===== GERADOR RESERVA (pixel-art, usado se NENHUM arquivo existir) =====
function crc32(buf: Uint8Array): number {
  const table: number[] = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

const pngCache: Record<number, Uint8Array> = {}
async function makePng(size: number): Promise<Uint8Array> {
  if (pngCache[size]) return pngCache[size]
  const N = ICON_MAP.length
  const cell = size / N
  const stride = 1 + size * 3
  const raw = new Uint8Array(size * stride)
  const cor = (ch: string): [number, number, number] =>
    ch === 'W' ? [0xff, 0xff, 0xff] : ch === 'K' ? [0x1a, 0x1a, 0x2e] : [0xff, 0x6b, 0x00]
  for (let y = 0; y < size; y++) {
    const off = y * stride
    raw[off] = 0
    const gy = Math.min(N - 1, Math.floor(y / cell))
    for (let x = 0; x < size; x++) {
      const gx = Math.min(N - 1, Math.floor(x / cell))
      const rgb = cor(ICON_MAP[gy][gx])
      const p = off + 1 + x * 3
      raw[p] = rgb[0]; raw[p + 1] = rgb[1]; raw[p + 2] = rgb[2]
    }
  }
  const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))
  const deflated = new Uint8Array(await new Response(stream).arrayBuffer())
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, size); dv.setUint32(4, size)
  ihdr[8] = 8; ihdr[9] = 2
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const c1 = pngChunk('IHDR', ihdr)
  const c2 = pngChunk('IDAT', deflated)
  const c3 = pngChunk('IEND', new Uint8Array(0))
  const out = new Uint8Array(sig.length + c1.length + c2.length + c3.length)
  out.set(sig, 0); out.set(c1, 8); out.set(c2, 8 + c1.length); out.set(c3, 8 + c1.length + c2.length)
  pngCache[size] = out
  return out
}
async function iconRes(c: any, size: number) {
  const png = await makePng(size)
  return new Response(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' } })
}

// ===== SERVE O ÍCONE (procura em vários caminhos, usa reserva se não achar) =====
async function servirIcone(c: any) {
  const origin = new URL(c.req.url).origin
  for (const p of ICON_CANDIDATOS) {
    try {
      const res = await c.env.ASSETS.fetch(new Request(origin + p))
      if (res.ok) {
        const buf = await res.arrayBuffer()
        if (buf.byteLength > 0) {
          return new Response(buf, {
            headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' }
          })
        }
      }
    } catch {}
  }
  return iconRes(c, 512) // reserva pixel-art
}

// ===== ROTAS DO ÍCONE =====
app.get('/icon-moto.png', servirIcone)
app.get('/icon-192.png', servirIcone)
app.get('/icon-512.png', servirIcone)
app.get('/apple-touch-icon.png', servirIcone)

// ===== DIAGNÓSTICO =====
app.get('/icon-debug', async (c) => {
  const origin = new URL(c.req.url).origin
  const testes: any[] = []
  for (const p of ICON_CANDIDATOS) {
    try {
      const res = await c.env.ASSETS.fetch(new Request(origin + p))
      const buf = await res.arrayBuffer()
      testes.push({ caminho: p, status: res.status, bytes: buf.byteLength })
    } catch (e: any) {
      testes.push({ caminho: p, erro: String(e?.message || e) })
    }
  }
  return c.json({ testes, dica: 'O primeiro caminho com status 200 e bytes > 0 é o que está funcionando.' })
})

// ===== detecta colunas da tabela clientes =====
async function colsClientes(db: D1Database): Promise<string[]> {
  try {
    const r = await db.prepare('PRAGMA table_info(clientes)').all()
    return (r.results as any[]).map((x) => x.name)
  } catch { return [] }
}

// ===== MANIFEST =====
app.get('/manifest.json', async (c) => {
  const loja = await c.env.DB.prepare('SELECT nome_empresa FROM configuracoes WHERE id = 1').first() as any
  const nome = loja?.nome_empresa || 'Entregador'
  return c.json({
    name: APP_NOME + ' · ' + nome,
    short_name: APP_NOME,
    description: 'App de entregas ' + APP_NOME,
    start_url: '/entregador/',
    scope: '/entregador/',
    display: 'standalone',
    background_color: '#0c0a08',
    theme_color: '#0c0a08',
    orientation: 'portrait',
    icons: [
      { src: ICON_URL, sizes: '192x192 512x512 1024x1024', type: 'image/png', purpose: 'any' },
      { src: ICON_URL, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  })
})

// ===== SERVICE WORKER =====
app.get('/sw.js', (c) => {
  const sw = `
const CACHE = 'entregador-v8';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.includes('/entregador/meu') || url.pathname.includes('/entregador/status') || url.pathname.includes('/entregador/historico') || url.pathname.includes('/entregador/ganhos') || url.pathname.includes('/entregador/toggle')) {
    e.respondWith(fetch(e.request));
    return;
  }
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(cc => cc.put(e.request, copia)); }
        return res;
      }).catch(() => caches.match(e.request).then(r => r || Response.error()))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(cc => cc.put(e.request, copia)); }
      return res;
    }))
  );
});
`
  return new Response(sw, { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache' } })
})

// ===== API: MEU =====
app.get('/meu', async (c) => {
  const tel = String(c.req.query('telefone') || '').replace(/\D/g, '')
  if (!tel) return c.json({ erro: 'Informe o telefone.' }, 400)
  const ent = await c.env.DB.prepare(
    'SELECT id, nome, telefone, veiculo, disponivel, entregas_ativas FROM entregadores WHERE telefone = ? AND ativo = 1'
  ).bind(tel).first() as any
  if (!ent) return c.json({ erro: 'Entregador não encontrado.' }, 404)
  const loja = await c.env.DB.prepare('SELECT * FROM configuracoes WHERE id = 1').first() as any
  const lojaInfo = {
    nome: loja?.nome_empresa || 'Chef da Brasa',
    endereco: [loja?.endereco, loja?.numero, loja?.bairro, loja?.cidade].filter(Boolean).join(', '),
    telefone: loja?.telefone || ''
  }
  const cc = await colsClientes(c.env.DB)
  const wanted = ['nome', 'telefone', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'referencia']
  const selParts = wanted.filter((w) => cc.includes(w)).map((w) => `cl.${w} AS c_${w}`)
  const selClientes = selParts.length ? ', ' + selParts.join(', ') : ''
  const joinClientes = selParts.length ? 'LEFT JOIN clientes cl ON cl.id = p.cliente_id' : ''
  const entregas = await c.env.DB.prepare(`
    SELECT e.id AS entrega_id, e.status AS status_entrega, e.criado_em, p.*${selClientes}
    FROM entregas e
    LEFT JOIN pedidos p ON p.id = e.pedido_id
    ${joinClientes}
    WHERE e.entregador_id = ? AND e.status IN ('ATRIBUIDA','A_CAMINHO_LOJA','COLETADO','A_CAMINHO','SAIU_ENTREGA')
    ORDER BY e.id ASC
  `).bind(ent.id).all() as any
  const linhas = (entregas.results as any[]).filter((r: any) => r.id).map((r: any) => {
    const endCliente = [r.c_endereco, r.c_numero ? `, ${r.c_numero}` : '', r.c_complemento, r.c_bairro, r.c_cidade].filter(Boolean).join(' ').trim()
    const total = Number(r.total) || 0
    const taxa = Number(r.taxa_entrega || 0) > 0 ? Number(r.taxa_entrega) : Math.max(5, total * 0.10)
    return {
      entrega_id: r.entrega_id, status: r.status_entrega, pedido_id: r.id,
      cliente: r.c_nome || 'Cliente',
      telefone_cliente: r.c_telefone || '',
      endereco_cliente: endCliente,
      total, taxa_entrega: taxa,
      pagamento: r.pagamento || '-', tipo_pedido: r.tipo_pedido || 'entrega', criado_em: r.criado_em
    }
  })
  const hoje = new Date().toISOString().slice(0, 10)
  const gh = await c.env.DB.prepare(`
    SELECT COUNT(*) as qtd, COALESCE(SUM(CASE WHEN p.taxa_entrega > 0 THEN p.taxa_entrega ELSE p.total * 0.10 END), 0) as ganho
    FROM entregas e JOIN pedidos p ON p.id = e.pedido_id
    WHERE e.entregador_id = ? AND e.status = 'ENTREGUE' AND date(e.atualizado_em) = ?
  `).bind(ent.id, hoje).first() as any
  return c.json({ entregador: ent, loja: lojaInfo, entregas: linhas, ganhos_hoje: { qtd: gh?.qtd || 0, ganho: gh?.ganho || 0 } })
})

// ===== API: HISTÓRICO =====
app.get('/historico', async (c) => {
  const tel = String(c.req.query('telefone') || '').replace(/\D/g, '')
  const periodo = c.req.query('periodo') || 'dia'
  if (!tel) return c.json({ erro: 'Informe o telefone.' }, 400)
  const ent = await c.env.DB.prepare('SELECT id FROM entregadores WHERE telefone = ? AND ativo = 1').bind(tel).first() as any
  if (!ent) return c.json({ erro: 'Entregador não encontrado.' }, 404)
  let filtro = "date(e.atualizado_em) = date('now')"
  if (periodo === 'semana') filtro = "date(e.atualizado_em) >= date('now','-7 days')"
  if (periodo === 'mes') filtro = "date(e.atualizado_em) >= date('now','start of month')"
  const cc = await colsClientes(c.env.DB)
  const wanted = ['nome', 'endereco', 'numero', 'bairro', 'cidade']
  const selParts = wanted.filter((w) => cc.includes(w)).map((w) => `cl.${w} AS c_${w}`)
  const selClientes = selParts.length ? ', ' + selParts.join(', ') : ''
  const joinClientes = selParts.length ? 'LEFT JOIN clientes cl ON cl.id = p.cliente_id' : ''
  const r = await c.env.DB.prepare(`
    SELECT e.id AS entrega_id, e.status, e.atualizado_em, p.total, p.taxa_entrega${selClientes}
    FROM entregas e
    LEFT JOIN pedidos p ON p.id = e.pedido_id
    ${joinClientes}
    WHERE e.entregador_id = ? AND e.status IN ('ENTREGUE','CANCELADA') AND ${filtro}
    ORDER BY e.atualizado_em DESC
  `).bind(ent.id).all() as any
  const linhas = (r.results as any[]).filter((x: any) => x.entrega_id).map((x: any) => {
    const total = Number(x.total) || 0
    const ganho = Number(x.taxa_entrega || 0) > 0 ? Number(x.taxa_entrega) : Math.max(5, total * 0.10)
    return {
      entrega_id: x.entrega_id, pedido_id: x.entrega_id, cliente: x.c_nome || 'Cliente',
      endereco: [x.c_endereco, x.c_numero, x.c_bairro, x.c_cidade].filter(Boolean).join(', '),
      total, ganho, pago_em: x.atualizado_em, status: x.status
    }
  })
  return c.json({ periodo, entregas: linhas, total: linhas.reduce((s, l) => s + l.ganho, 0), qtd: linhas.length })
})

// ===== API: GANHOS =====
app.get('/ganhos', async (c) => {
  const tel = String(c.req.query('telefone') || '').replace(/\D/g, '')
  if (!tel) return c.json({ erro: 'Informe o telefone.' }, 400)
  const ent = await c.env.DB.prepare('SELECT id FROM entregadores WHERE telefone = ? AND ativo = 1').bind(tel).first() as any
  if (!ent) return c.json({ erro: 'Entregador não encontrado.' }, 404)
  const r = await c.env.DB.prepare(`
    SELECT date(e.atualizado_em) as dia, COUNT(*) as qtd,
           COALESCE(SUM(CASE WHEN p.taxa_entrega > 0 THEN p.taxa_entrega ELSE p.total * 0.10 END), 0) as ganho
    FROM entregas e JOIN pedidos p ON p.id = e.pedido_id
    WHERE e.entregador_id = ? AND e.status = 'ENTREGUE' AND date(e.atualizado_em) >= date('now','start of month')
    GROUP BY date(e.atualizado_em) ORDER BY dia DESC
  `).bind(ent.id).all() as any
  const dias = r.results || []
  const hoje = new Date().toISOString().slice(0, 10)
  return c.json({
    hoje: dias.find((d: any) => d.dia === hoje)?.ganho || 0,
    semana: dias.slice(0, 7).reduce((s: number, d: any) => s + d.ganho, 0),
    mes: dias.reduce((s: number, d: any) => s + d.ganho, 0),
    entregas_hoje: dias.find((d: any) => d.dia === hoje)?.qtd || 0,
    dias
  })
})

// ===== API: TOGGLE =====
app.get('/toggle', async (c) => {
  const tel = String(c.req.query('telefone') || '').replace(/\D/g, '')
  const ent = await c.env.DB.prepare('SELECT * FROM entregadores WHERE telefone = ? AND ativo = 1').bind(tel).first() as any
  if (!ent) return c.json({ erro: 'Entregador não encontrado.' }, 404)
  if (Number(ent.disponivel) === 1) {
    await c.env.DB.prepare(`UPDATE entregadores SET disponivel = 0, checkin_em = NULL WHERE id = ?`).bind(ent.id).run()
    return c.json({ disponivel: 0 })
  }
  await c.env.DB.prepare(`UPDATE entregadores SET disponivel = 1, checkin_em = datetime('now') WHERE id = ?`).bind(ent.id).run()
  return c.json({ disponivel: 1 })
})

// ===== API: STATUS =====
app.post('/status', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const entregaId = parseInt(body.entrega_id)
  const status = String(body.status || '')
  if (!['A_CAMINHO_LOJA','COLETADO','A_CAMINHO','ENTREGUE','CANCELADA'].includes(status)) return c.json({ erro: 'Status inválido.' }, 400)
  const ent = await c.env.DB.prepare('SELECT * FROM entregas WHERE id = ?').bind(entregaId).first() as any
  if (!ent) return c.json({ erro: 'Entrega não encontrada.' }, 404)
  const final = ['ENTREGUE','CANCELADA'].includes(status)
  const atualFinal = ['ENTREGUE','CANCELADA'].includes(ent.status)
  await c.env.DB.prepare(`UPDATE entregas SET status = ?, atualizado_em = datetime('now') WHERE id = ?`).bind(status, entregaId).run()
  try {
    if (status === 'A_CAMINHO_LOJA') await c.env.DB.prepare(`UPDATE pedidos SET status = 'EM_PREPARO' WHERE id = ?`).bind(ent.pedido_id).run()
    else if (status === 'COLETADO') await c.env.DB.prepare(`UPDATE pedidos SET status = 'PRONTO' WHERE id = ?`).bind(ent.pedido_id).run()
    else if (status === 'A_CAMINHO') await c.env.DB.prepare(`UPDATE pedidos SET status = 'SAIU_ENTREGA' WHERE id = ?`).bind(ent.pedido_id).run()
    else if (status === 'ENTREGUE') await c.env.DB.prepare(`UPDATE pedidos SET status = 'ENTREGUE' WHERE id = ?`).bind(ent.pedido_id).run()
  } catch {}
  if (final && !atualFinal) {
    await c.env.DB.prepare(`UPDATE entregadores SET entregas_ativas = MAX(entregas_ativas - 1, 0) WHERE id = ?`).bind(ent.entregador_id).run()
  }
  return c.json({ sucesso: true })
})

// ===== PÁGINA (estilo black & gold premium) =====
app.get('/', async (c) => {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#0c0a08">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="${APP_NOME}">
<link rel="manifest" href="/entregador/manifest.json">
<link rel="apple-touch-icon" href="${ICON_URL}">
<link rel="icon" type="image/png" href="${ICON_URL}">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet">
<title>${APP_NOME}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
  :root {
    --bg:#0c0a08; --bg2:#151210; --card:#1c1815; --card2:#241f1a; --line:#332b22;
    --gold:#e9c46a; --gold2:#d4a437; --gold-grad:linear-gradient(135deg,#f6dc8e 0%,#d4a437 55%,#a97e1f 100%);
    --text:#f3e9d2; --muted:#a89778; --green:#3ef07f;
  }
  html, body { overscroll-behavior:none; }
  body { font-family:-apple-system,'Segoe UI',Roboto,sans-serif; background:var(--bg); color:var(--text); min-height:100vh; padding-top:env(safe-area-inset-top); }
  .oculto { display:none !important; }

  .topo { background:linear-gradient(180deg,#1a120b 0%,#0c0a08 100%),repeating-linear-gradient(90deg,rgba(255,255,255,.02) 0 2px,transparent 2px 9px); padding:18px 16px 16px; }
  .topo-row { display:flex; align-items:center; gap:10px; }
  .flame-svg { width:34px; height:34px; fill:var(--gold); filter:drop-shadow(0 2px 6px rgba(233,196,106,.45)); }
  .brand { font-family:'Playfair Display',Georgia,serif; font-size:24px; font-weight:800; color:var(--gold); flex:1; letter-spacing:.3px; }
  .btn-sair { background:transparent; color:var(--gold); border:1.5px solid var(--gold2); border-radius:24px; padding:9px 22px; font-size:14px; font-weight:800; }

  .wrap { padding:14px 16px calc(20px + env(safe-area-inset-bottom)); max-width:640px; margin:0 auto; }

  .driver-card { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:16px; display:flex; align-items:center; gap:14px; margin-bottom:12px; }
  .avatar { width:64px; height:64px; border-radius:50%; background:var(--gold-grad); color:#1a1208; display:grid; place-items:center; font-size:24px; font-weight:800; flex-shrink:0; border:2px solid rgba(246,220,142,.6); }
  .driver-nome { font-size:17px; font-weight:800; color:var(--gold); letter-spacing:.4px; }
  .driver-sub { font-size:13px; color:var(--muted); margin-top:3px; }

  .status-card { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:16px; display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; }
  .status-card b { display:block; font-size:17px; }
  .status-card span { font-size:13px; color:var(--green); }
  .status-card.off span { color:var(--muted); }
  .pill-checkin { border-radius:26px; padding:12px 26px; font-size:15px; font-weight:800; cursor:pointer; }
  .pill-checkin.on { background:rgba(62,240,127,.08); color:var(--green); border:2px solid var(--green); box-shadow:0 0 18px rgba(62,240,127,.4), inset 0 0 12px rgba(62,240,127,.15); }
  .pill-checkin.off { background:var(--card2); color:var(--muted); border:2px solid var(--line); }

  .gold-banner { background:var(--gold-grad); border-radius:18px; padding:18px 10px; display:flex; align-items:center; margin-bottom:14px; box-shadow:0 8px 24px -10px rgba(212,164,55,.55); }
  .gb-item { flex:1; text-align:center; color:#241708; }
  .gb-topo { display:flex; align-items:center; justify-content:center; gap:8px; }
  .gb-topo .ico { font-size:22px; }
  .gb-topo b { font-size:26px; font-weight:800; letter-spacing:.3px; }
  .gb-label { display:block; font-size:11px; font-weight:800; letter-spacing:1.2px; text-transform:uppercase; margin-top:4px; opacity:.85; }
  .gb-div { width:1px; align-self:stretch; background:rgba(36,23,8,.25); }

  .tabs { display:flex; gap:10px; margin-bottom:16px; }
  .tab { flex:1; background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px 6px; color:var(--muted); font-size:14px; font-weight:800; cursor:pointer; position:relative; }
  .tab.ativa { color:var(--gold); }
  .tab.ativa::after { content:''; position:absolute; left:18%; right:18%; bottom:-1px; height:3px; border-radius:3px; background:var(--gold-grad); }

  .vazio-gold { text-align:center; padding:26px 10px 8px; }
  .moto-art { width:230px; max-width:70%; stroke:var(--gold2); fill:none; stroke-width:2.2; opacity:.9; margin:0 auto 10px; display:block; }
  .vazio-gold h3 { font-size:22px; font-weight:800; }
  .vazio-gold p { color:var(--muted); font-size:14px; margin-top:6px; }
  .btn-cta { display:block; width:100%; margin-top:22px; background:var(--gold-grad); color:#241708; border:none; border-radius:30px; padding:17px; font-size:17px; font-weight:800; cursor:pointer; box-shadow:0 10px 26px -10px rgba(212,164,55,.7); }
  .btn-cta:active { opacity:.9; }

  .ec2 { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:14px; margin-bottom:12px; }
  .ec2-topo { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
  .ec2-id { font-size:14px; font-weight:800; color:var(--text); }
  .ec2-status { font-size:11px; font-weight:800; letter-spacing:.6px; color:var(--gold); border:1px solid var(--gold2); border-radius:16px; padding:4px 12px; text-transform:uppercase; }
  .ec2-bloco { background:var(--bg2); border:1px solid var(--line); border-radius:12px; padding:12px; margin-bottom:10px; }
  .ec2-label { font-size:10px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:var(--muted); margin-bottom:5px; }
  .ec2-nome { font-size:15px; font-weight:800; color:var(--text); }
  .ec2-end { font-size:13px; color:var(--muted); line-height:1.4; margin-top:3px; }
  .ec2-nav { display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-top:10px; }
  .btn-nav2 { background:transparent; border:1px solid var(--gold2); color:var(--gold); border-radius:9px; padding:9px 4px; text-align:center; text-decoration:none; font-size:11px; font-weight:800; }
  .btn-nav2 b { display:block; font-size:14px; margin-bottom:2px; }
  .ec2-valores { display:flex; justify-content:space-between; align-items:center; padding:4px 2px 10px; }
  .ec2-ganho { color:var(--gold); font-size:20px; font-weight:800; }
  .ec2-ganho span { display:block; font-size:10px; color:var(--muted); font-weight:700; text-transform:uppercase; letter-spacing:.8px; }
  .ec2-total { text-align:right; color:var(--muted); font-size:13px; font-weight:700; }
  .ec2-total span { display:block; font-size:10px; font-weight:600; }
  .ec2-acoes { display:flex; gap:8px; }
  .btn-acao { flex:1; background:var(--gold-grad); color:#241708; border:none; border-radius:12px; padding:14px; font-size:14px; font-weight:800; cursor:pointer; }
  .btn-acao:active { opacity:.9; }
  .btn-ligar2 { flex:0 0 50px; display:flex; align-items:center; justify-content:center; background:transparent; border:1px solid var(--gold2); color:var(--gold); border-radius:12px; text-decoration:none; font-size:18px; }

  .h2-item { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:13px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:10px; }
  .h2-info { flex:1; min-width:0; }
  .h2-cli { font-size:14px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .h2-end { font-size:12px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; }
  .h2-data { font-size:11px; color:var(--muted); margin-top:3px; }
  .h2-val { color:var(--gold); font-weight:800; font-size:16px; flex-shrink:0; }
  .g2-grid { display:grid; grid-template-columns:1fr; gap:10px; margin-bottom:16px; }
  .g2-card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px; display:flex; justify-content:space-between; align-items:center; }
  .g2-card span { font-size:12px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:var(--muted); }
  .g2-card b { font-size:22px; font-weight:800; color:var(--gold); }
  .g2-card.destaque { background:var(--gold-grad); border:none; }
  .g2-card.destaque span { color:rgba(36,23,8,.75); }
  .g2-card.destaque b { color:#241708; }
  .g2-titulo { font-size:16px; font-weight:800; color:var(--gold); margin:18px 0 10px; }
  .filtros2 { display:flex; gap:8px; margin-bottom:14px; }
  .filtro2 { background:var(--card); border:1px solid var(--line); color:var(--muted); border-radius:20px; padding:9px 18px; font-size:13px; font-weight:800; cursor:pointer; }
  .filtro2.ativo { background:var(--gold-grad); border-color:transparent; color:#241708; }

  .login-gold { padding:60px 24px; text-align:center; }
  .login-gold .flame-svg { width:52px; height:52px; }
  .login-gold h2 { font-family:'Playfair Display',Georgia,serif; font-size:30px; color:var(--gold); margin:8px 0 4px; }
  .login-gold p { color:var(--muted); font-size:14px; margin-bottom:26px; }
  .login-gold input { width:100%; max-width:340px; background:var(--card); border:1.5px solid var(--line); color:var(--text); border-radius:14px; padding:16px; font-size:17px; outline:none; display:block; margin:0 auto 12px; }
  .login-gold input:focus { border-color:var(--gold2); }
  .login-gold button { width:100%; max-width:340px; background:var(--gold-grad); color:#241708; border:none; border-radius:14px; padding:16px; font-size:16px; font-weight:800; cursor:pointer; }
  .login-erro { color:#ff8f7a; font-size:13px; margin-top:10px; min-height:18px; }

  .install-bar { background:var(--card); border:1px solid var(--gold2); border-radius:14px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:13px; color:var(--text); margin-bottom:12px; }
  .install-bar button { background:var(--gold-grad); color:#241708; border:none; padding:9px 14px; border-radius:9px; font-weight:800; font-size:12px; cursor:pointer; white-space:nowrap; }
  .install-bar .fechar { background:transparent; color:var(--muted); padding:4px 8px; font-size:16px; }
</style>
</head>
<body>

<div id="appLogin" class="login-gold">
  <svg class="flame-svg" viewBox="0 0 24 24"><path d="M12 2c1.2 4.2-4.5 6.3-4.5 11a4.5 4.5 0 0 0 9 0c0-1.8-.9-3-.9-3s3.4 1.2 3.4 4.4A7 7 0 0 1 5 14.6C5 8.2 10.8 6.4 12 2z"/></svg>
  <h2>${APP_NOME}</h2>
  <p>App do entregador · entre com seu telefone</p>
  <input type="tel" id="loginTel" placeholder="Telefone (só números)" inputmode="numeric">
  <button onclick="entrar()">Entrar</button>
  <p class="login-erro" id="loginErro"></p>
</div>

<div id="appMain" style="display:none;">
  <div class="topo">
    <div class="topo-row">
      <svg class="flame-svg" viewBox="0 0 24 24"><path d="M12 2c1.2 4.2-4.5 6.3-4.5 11a4.5 4.5 0 0 0 9 0c0-1.8-.9-3-.9-3s3.4 1.2 3.4 4.4A7 7 0 0 1 5 14.6C5 8.2 10.8 6.4 12 2z"/></svg>
      <h1 class="brand">${APP_NOME}</h1>
      <button class="btn-sair" onclick="sair()">Sair</button>
    </div>
  </div>

  <div class="wrap">
    <div id="installBar" class="install-bar oculto">
      <span>📲 Instale o ${APP_NOME} na tela inicial!</span>
      <div><button onclick="instalarApp()">Instalar</button><button class="fechar" onclick="fecharInstall()">✕</button></div>
    </div>

    <div class="driver-card">
      <div class="avatar" id="entAvatar">--</div>
      <div>
        <div class="driver-nome" id="entNome">-</div>
        <div class="driver-sub" id="entSub">-</div>
      </div>
    </div>

    <div class="status-card" id="statusCard">
      <div><b id="checkinStatus">...</b><span id="checkinSub"></span></div>
      <button class="pill-checkin off" id="btnCheckin" onclick="toggleCheckin()">...</button>
    </div>

    <div class="gold-banner">
      <div class="gb-item">
        <div class="gb-topo"><span class="ico">💵</span><b id="miniHoje">R$ 0</b></div>
        <span class="gb-label">Ganho hoje</span>
      </div>
      <div class="gb-div"></div>
      <div class="gb-item">
        <div class="gb-topo"><span class="ico">🛵</span><b id="miniEntregas">0</b></div>
        <span class="gb-label">Entregas hoje</span>
      </div>
    </div>

    <nav class="tabs">
      <button class="tab ativa" data-tab="ativas" onclick="trocarAba('ativas')">🏍️ Ativas</button>
      <button class="tab" data-tab="historico" onclick="trocarAba('historico')">📋 Histórico</button>
      <button class="tab" data-tab="ganhos" onclick="trocarAba('ganhos')">💰 Ganhos</button>
    </nav>

    <div id="tab-ativas" style="display:block;">
      <div id="listaEntregas"></div>
    </div>
    <div id="tab-historico" style="display:none;">
      <div class="filtros2">
        <button class="filtro2 ativo" onclick="carregarHistorico('dia', this)">Hoje</button>
        <button class="filtro2" onclick="carregarHistorico('semana', this)">Semana</button>
        <button class="filtro2" onclick="carregarHistorico('mes', this)">Mês</button>
      </div>
      <div id="listaHistorico"></div>
    </div>
    <div id="tab-ganhos" style="display:none;">
      <div id="resumoGanhos"></div>
    </div>
  </div>
</div>

<script>
  if (location.pathname === '/entregador') location.replace('/entregador/');
  var TEL = localStorage.getItem('entregadorTel') || '';
  var LOJA = null;
  var abaAtual = 'ativas';
  var deferredPrompt = null;

  var MOTO_SVG = '<svg class="moto-art" viewBox="0 0 220 130">' +
    '<circle cx="52" cy="95" r="27"/><circle cx="168" cy="95" r="27"/>' +
    '<circle cx="52" cy="95" r="10"/><circle cx="168" cy="95" r="10"/>' +
    '<path d="M52 95 L84 62 L132 62 L168 95"/><path d="M84 62 L72 44 L56 41"/>' +
    '<path d="M132 62 L146 40 L162 37"/><path d="M104 62 L104 84 L126 84 L132 62"/>' +
    '<path d="M72 44 L64 30 L74 24 L82 32"/><path d="M146 40 L150 28"/>' +
    '<path d="M96 74 a12 12 0 1 0 14 12"/></svg>';

  function mostrarLogin(){document.getElementById('appLogin').style.display='block';document.getElementById('appMain').style.display='none';}
  function mostrarMain(){document.getElementById('appLogin').style.display='none';document.getElementById('appMain').style.display='block';}
  function entrar(){
    var tel=document.getElementById('loginTel').value.replace(/\\D/g,'');
    if(tel.length<10){document.getElementById('loginErro').textContent='Telefone inválido.';return;}
    TEL=tel;localStorage.setItem('entregadorTel',tel);carregar();
  }
  function sair(){localStorage.removeItem('entregadorTel');TEL='';mostrarLogin();}
  function toggleCheckin(){fetch('/entregador/toggle?telefone='+TEL).then(function(r){return r.json();}).then(carregar);}
  function iniciais(nome){
    var p=String(nome||'').trim().split(/\\s+/);
    return ((p[0]||'-')[0] + (p.length>1 ? (p[p.length-1][0]) : '')).toUpperCase();
  }
  function acaoRota(){
    var online=document.getElementById('btnCheckin').classList.contains('on');
    if(!online){ toggleCheckin(); return; }
    carregar();
  }
  function trocarAba(tab){
    abaAtual=tab;
    document.querySelectorAll('.tab').forEach(function(a){a.classList.remove('ativa');});
    document.querySelector('.tab[data-tab="'+tab+'"]').classList.add('ativa');
    document.getElementById('tab-ativas').style.display = tab==='ativas'?'block':'none';
    document.getElementById('tab-historico').style.display = tab==='historico'?'block':'none';
    document.getElementById('tab-ganhos').style.display = tab==='ganhos'?'block':'none';
    if(tab==='historico')carregarHistorico('dia',document.querySelector('.filtro2'));
    else if(tab==='ganhos')carregarGanhos();
  }
  function mudarStatus(id,status){
    var msgs={'A_CAMINHO_LOJA':'Confirmar que está INDO À LOJA?','COLETADO':'Confirmar que COLETOU o pedido?','A_CAMINHO':'Confirmar que está A CAMINHO do cliente?','ENTREGUE':'Confirmar que ENTREGOU?','CANCELADA':'Cancelar esta entrega?'};
    if(!confirm(msgs[status]||'Confirmar?'))return;
    fetch('/entregador/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entrega_id:id,status:status})})
      .then(function(r){return r.json();}).then(function(d){if(!d.sucesso)alert(d.erro||'Erro');carregar();});
  }
  function brl(v){return 'R$ '+(Number(v)||0).toFixed(2).replace('.',',');}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
  function dataBr(dt){if(!dt)return '';var d=String(dt).slice(0,10).split('-');var h=String(dt).slice(11,16);return d[2]+'/'+d[1]+' às '+h;}
  function urlNav(t,e){var enc=encodeURIComponent(e);if(t==='gmaps')return 'https://www.google.com/maps/dir/?api=1&destination='+enc;if(t==='waze')return 'https://waze.com/ul?q='+enc+'&navigate=yes';return 'http://maps.apple.com/?daddr='+enc;}
  function botoesNav(end){
    if(!end||!end.trim())return '';
    return '<div class="ec2-nav">'+
      '<a class="btn-nav2" href="'+urlNav('gmaps',end)+'" target="_blank" rel="noopener"><b>🗺️</b>Maps</a>'+
      '<a class="btn-nav2" href="'+urlNav('waze',end)+'" target="_blank" rel="noopener"><b>🚗</b>Waze</a>'+
      '<a class="btn-nav2" href="'+urlNav('apple',end)+'" target="_blank" rel="noopener"><b>🍎</b>Apple</a></div>';
  }
  function statusLabel(s){return {'ATRIBUIDA':'Novo','A_CAMINHO_LOJA':'Indo à loja','COLETADO':'Coletado','A_CAMINHO':'A caminho','SAIU_ENTREGA':'A caminho'}[s]||s;}
  function statusStep(s){return {'ATRIBUIDA':'step1','A_CAMINHO_LOJA':'step2','COLETADO':'step3','A_CAMINHO':'step4','SAIU_ENTREGA':'step4'}[s]||'';}

  function cardEntrega(t){
    var endLoja=LOJA?LOJA.endereco:'';
    var endCliente=t.endereco_cliente||'';
    var html='<div class="ec2 '+statusStep(t.status)+'">';
    html+='<div class="ec2-topo"><span class="ec2-id">Pedido #'+t.pedido_id+'</span><span class="ec2-status">'+statusLabel(t.status)+'</span></div>';
    if(t.status==='ATRIBUIDA'||t.status==='A_CAMINHO_LOJA'){
      html+='<div class="ec2-bloco"><div class="ec2-label">🏪 Retirar em</div>';
      html+='<div class="ec2-nome">'+esc(LOJA?LOJA.nome:'Loja')+'</div>';
      if(endLoja)html+='<div class="ec2-end">'+esc(endLoja)+'</div>';
      html+=botoesNav(endLoja)+'</div>';
    }
    if(t.status==='COLETADO'||t.status==='A_CAMINHO'||t.status==='SAIU_ENTREGA'){
      html+='<div class="ec2-bloco"><div class="ec2-label">📍 Entregar para</div>';
      html+='<div class="ec2-nome">'+esc(t.cliente)+'</div>';
      if(endCliente)html+='<div class="ec2-end">'+esc(endCliente)+'</div>';
      if(t.telefone_cliente)html+='<div class="ec2-end">📞 '+esc(t.telefone_cliente)+'</div>';
      html+=botoesNav(endCliente)+'</div>';
    }
    html+='<div class="ec2-valores"><div class="ec2-ganho">'+brl(t.taxa_entrega)+'<span>Seu ganho</span></div>';
    html+='<div class="ec2-total">'+brl(t.total)+'<span>Total · '+esc(t.pagamento)+'</span></div></div>';
    html+='<div class="ec2-acoes">';
    if(t.status==='ATRIBUIDA')html+='<button class="btn-acao" onclick="mudarStatus('+t.entrega_id+',\\'A_CAMINHO_LOJA\\')">🏪 Ir à loja</button>';
    else if(t.status==='A_CAMINHO_LOJA')html+='<button class="btn-acao" onclick="mudarStatus('+t.entrega_id+',\\'COLETADO\\')">📦 Coletei</button>';
    else if(t.status==='COLETADO')html+='<button class="btn-acao" onclick="mudarStatus('+t.entrega_id+',\\'A_CAMINHO\\')">🛵 Ir ao cliente</button>';
    else if(t.status==='A_CAMINHO'||t.status==='SAIU_ENTREGA')html+='<button class="btn-acao" onclick="mudarStatus('+t.entrega_id+',\\'ENTREGUE\\')">✅ Entregue</button>';
    if(t.telefone_cliente&&t.status!=='ATRIBUIDA'&&t.status!=='A_CAMINHO_LOJA')html+='<a class="btn-ligar2" href="tel:'+esc(t.telefone_cliente)+'">📞</a>';
    html+='</div></div>';
    return html;
  }

  function carregar(){
    if(!TEL){mostrarLogin();return;}
    fetch('/entregador/meu?telefone='+TEL)
      .then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d};});})
      .then(function(res){
        if(!res.ok){mostrarLogin();return;}
        mostrarMain();
        var e=res.d.entregador;LOJA=res.d.loja;
        document.getElementById('entNome').textContent=e.nome;
        document.getElementById('entAvatar').textContent=iniciais(e.nome);
        document.getElementById('entSub').textContent=(e.veiculo||'')+' · '+(e.entregas_ativas||0)+' ativa(s)';
        var btn=document.getElementById('btnCheckin');
        var card=document.getElementById('statusCard');
        if(Number(e.disponivel)===1){
          btn.className='pill-checkin on';btn.textContent='Online';
          card.classList.remove('off');
          document.getElementById('checkinStatus').textContent='Você está online';
          document.getElementById('checkinSub').textContent='Recebendo entregas';
        }else{
          btn.className='pill-checkin off';btn.textContent='Offline';
          card.classList.add('off');
          document.getElementById('checkinStatus').textContent='Você está offline';
          document.getElementById('checkinSub').textContent='Toque para ficar online';
        }
        var gh=res.d.ganhos_hoje||{};
        document.getElementById('miniHoje').textContent=brl(gh.ganho||0);
        document.getElementById('miniEntregas').textContent=gh.qtd||0;
        if(abaAtual==='ativas'){
          var area=document.getElementById('listaEntregas');var lista=res.d.entregas||[];
          if(!lista.length){
            area.innerHTML='<div class="vazio-gold">'+MOTO_SVG+
              '<h3>Nenhuma entrega ativa</h3><p>Fique online para receber pedidos.</p></div>'+
              '<button class="btn-cta" onclick="acaoRota()">Iniciar Rota</button>';
          }else{
            area.innerHTML=lista.map(cardEntrega).join('');
          }
        }
      }).catch(function(){mostrarLogin();});
  }

  function carregarHistorico(p,btn){
    if(btn){document.querySelectorAll('.filtro2').forEach(function(b){b.classList.remove('ativo');});btn.classList.add('ativo');}
    var area=document.getElementById('listaHistorico');
    area.innerHTML='<div class="vazio-gold"><p>Carregando...</p></div>';
    fetch('/entregador/historico?telefone='+TEL+'&periodo='+p).then(function(r){return r.json();}).then(function(d){
      var l=d.entregas||[];
      if(!l.length){area.innerHTML='<div class="vazio-gold">'+MOTO_SVG+'<h3>Sem entregas</h3><p>Nenhuma entrega finalizada neste período.</p></div>';return;}
      var html='<div class="g2-card destaque"><span>Total no período</span><b>'+brl(d.total)+'</b></div>';
      html+='<div style="text-align:center;color:var(--muted);font-size:13px;margin:8px 0 12px;">'+d.qtd+' entrega(s)</div>';
      html+=l.map(function(e){return '<div class="h2-item"><div class="h2-info"><div class="h2-cli">#'+e.pedido_id+' · '+esc(e.cliente)+'</div><div class="h2-end">'+esc(e.endereco||'—')+'</div><div class="h2-data">'+dataBr(e.pago_em)+'</div></div><div class="h2-val">+'+brl(e.ganho)+'</div></div>';}).join('');
      area.innerHTML=html;
    });
  }

  function carregarGanhos(){
    var area=document.getElementById('resumoGanhos');
    area.innerHTML='<div class="vazio-gold"><p>Carregando...</p></div>';
    fetch('/entregador/ganhos?telefone='+TEL).then(function(r){return r.json();}).then(function(d){
      var html='<div class="g2-grid">';
      html+='<div class="g2-card destaque"><span>Hoje</span><b>'+brl(d.hoje)+'</b></div>';
      html+='<div class="g2-card"><span>Últimos 7 dias</span><b>'+brl(d.semana)+'</b></div>';
      html+='<div class="g2-card"><span>Este mês</span><b>'+brl(d.mes)+'</b></div>';
      html+='<div class="g2-card"><span>Entregas hoje</span><b>'+(d.entregas_hoje||0)+'</b></div></div>';
      if(d.dias&&d.dias.length){
        html+='<div class="g2-titulo">📅 Por dia este mês</div>';
        html+=d.dias.map(function(dia){var dt=dia.dia.split('-');return '<div class="h2-item"><div class="h2-info"><div class="h2-cli">'+dt[2]+'/'+dt[1]+'/'+dt[0]+'</div><div class="h2-data">'+dia.qtd+' entrega(s)</div></div><div class="h2-val">+'+brl(dia.ganho)+'</div></div>';}).join('');
      }
      area.innerHTML=html;
    });
  }

  window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferredPrompt=e;if(!localStorage.getItem('installFechado'))document.getElementById('installBar').classList.remove('oculto');});
  function instalarApp(){
    if(!deferredPrompt){alert('No iPhone: Compartilhar → Adicionar à Tela de Início.\\nNo Android: menu ⋮ → Adicionar à tela inicial.');return;}
    deferredPrompt.prompt();deferredPrompt.userChoice.then(function(r){if(r.outcome==='accepted')document.getElementById('installBar').classList.add('oculto');deferredPrompt=null;});
  }
  function fecharInstall(){document.getElementById('installBar').classList.add('oculto');localStorage.setItem('installFechado','1');}
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/entregador/sw.js').catch(function(){});
  carregar();setInterval(carregar,15000);
</script>
</body>
</html>`
  return c.html(html)
})

// ---------- ROTA CURINGA ----------
app.get('*', async (c) => {
  const url = new URL(c.req.url)
  const interno = new Request(url.origin + '/', { headers: c.req.raw.headers })
  return app.fetch(interno, c.env, c.executionCtx)
})

export default app