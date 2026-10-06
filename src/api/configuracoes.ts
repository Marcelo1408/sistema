import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
}

const app = new Hono<{ Bindings: Bindings }>()

// Obter Configurações
app.get('/public', async (c) => {
  const config = await c.env.DB.prepare(`
    SELECT nome_empresa, logo, telefone, whatsapp, email, endereco, cidade, estado, cep,
           horario_abertura, horario_fechamento, tempo_preparo, cor_principal, taxa_entrega
    FROM configuracoes WHERE id = 1
  `).first()
  return c.json(config || {})
})

export function renderLayout(titulo: string, conteudo: string, paginaAtiva: string) {
  const menu = [
    { id: 'produtos', icone: '🍢', nome: 'Produtos', url: '/produtos' },
    { id: 'categorias', icone: '📁', nome: 'Categorias', url: '/categorias' },
    { id: 'clientes', icone: '👥', nome: 'Clientes', url: '/clientes' },
    { id: 'pedidos', icone: '📋', nome: 'Pedidos', url: '/pedidos' },
    { id: 'bairros', icone: '📍', nome: 'Bairros', url: '/bairros' },
    { id: 'combos', icone: '🎁', nome: 'Combos', url: '/combos' },
    { id: 'financeiro', icone: '💰', nome: 'Financeiro', url: '/financeiro' },
    { id: 'configuracoes', icone: '⚙️', nome: 'Configurações', url: '/configuracoes' }
  ]

  return `<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titulo} - Painel</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; font-family:'Segoe UI', sans-serif; background:#f4f6f9; display:flex; min-height:100vh; }
  .sidebar { width:230px; background:#1f2333; color:#fff; position:fixed; top:0; left:0; bottom:0; display:flex; flex-direction:column; }
  .sidebar-header { padding:20px; border-bottom:1px solid rgba(255,255,255,.08); display:flex; align-items:center; gap:12px; }
  .sidebar-header img { width:44px; height:44px; object-fit:contain; border-radius:8px; background:#fff; padding:3px; }
  .sidebar-header .nome { color:#ff6b00; font-size:17px; font-weight:bold; margin:0; line-height:1.2; }
  .sidebar-header .sub { color:#8a8fa3; font-size:12px; }
  .menu { list-style:none; margin:0; padding:15px 0; flex:1; }
  .menu a { display:flex; align-items:center; gap:12px; padding:13px 20px; color:#cfd2dd; text-decoration:none; font-size:15px; }
  .menu a:hover { background:rgba(255,255,255,.06); color:#fff; }
  .menu a.ativo { background:#ff6b00; color:#fff; font-weight:bold; }
  .main { margin-left:230px; flex:1; display:flex; flex-direction:column; }
  .topbar { background:#fff; padding:18px 25px; box-shadow:0 2px 6px rgba(0,0,0,.05); }
  .topbar h1 { margin:0; font-size:20px; color:#333; }
  .content { padding:25px; }
</style>
</head>
<body>
  <aside class="sidebar">
    <div class="sidebar-header">
      <img id="sidebar-logo" src="" alt="Logo" style="display:none;">
      <div>
        <p class="nome" id="sidebar-nome">Espetaria</p>
        <span class="sub">Painel Admin</span>
      </div>
    </div>
    <ul class="menu">
      ${menu.map(m => `<li><a href="${m.url}" class="${paginaAtiva === m.id ? 'ativo' : ''}">${m.icone} ${m.nome}</a></li>`).join('')}
    </ul>
  </aside>

  <div class="main">
    <div class="topbar"><h1>${titulo}</h1></div>
    <div class="content">${conteudo}</div>
  </div>

  <script>
    (async function(){
      try {
        const res = await fetch('/api/configuracoes/public');
        if (!res.ok) return;
        const cfg = await res.json();
        if (cfg.nome_empresa) {
          document.getElementById('sidebar-nome').textContent = cfg.nome_empresa;
          document.title = cfg.nome_empresa + ' - Painel';
        }
        if (cfg.logo) {
          const img = document.getElementById('sidebar-logo');
          img.src = cfg.logo;
          img.style.display = 'block';
        }
      } catch(e) {}
    })();
  </script>
</body>
</html>`
}

// Salvar Configurações
app.post('/', async (c) => {
  const body = await c.req.parseBody()

  const nome_empresa = (body.nome_empresa as string)?.trim() || ''
  const telefone = (body.telefone as string)?.trim() || ''
  const whatsapp = (body.whatsapp as string)?.trim() || ''
  const email = (body.email as string)?.trim() || ''
  const endereco = (body.endereco as string)?.trim() || ''
  const cidade = (body.cidade as string)?.trim() || ''
  const estado = (body.estado as string)?.trim() || ''
  const cep = (body.cep as string)?.trim() || ''
  const chave_pix = (body.chave_pix as string)?.trim() || ''

  let taxa_entrega = parseFloat((body.taxa_entrega as string || '0').replace(',', '.'))
  let entrega_km_base = parseFloat((body.entrega_km_base as string || '3').replace(',', '.'))
  let entrega_valor_km_adicional = parseFloat((body.entrega_valor_km_adicional as string || '2').replace(',', '.'))
  let entrega_taxa_fallback = parseFloat((body.entrega_taxa_fallback as string || '10').replace(',', '.'))

  if (taxa_entrega < 0) taxa_entrega = 0
  if (entrega_km_base <= 0) entrega_km_base = 3
  if (entrega_valor_km_adicional < 0) entrega_valor_km_adicional = 0
  if (entrega_taxa_fallback < 0) entrega_taxa_fallback = taxa_entrega

  const loja_lat = (body.loja_lat as string)?.trim() || ''
  const loja_lng = (body.loja_lng as string)?.trim() || ''
  const tempo_preparo = parseInt(body.tempo_preparo as string) || 30
  const horario_abertura = (body.horario_abertura as string)?.trim() || ''
  const horario_fechamento = (body.horario_fechamento as string)?.trim() || ''
  const logo_url = (body.logo_url as string) || ''

  // Monta o SQL
  let sqlLogo = ''
  let params: any[] = [
    nome_empresa, telefone, whatsapp, email, endereco, cidade, estado, cep,
    chave_pix, taxa_entrega, entrega_km_base, entrega_valor_km_adicional,
    entrega_taxa_fallback, loja_lat, loja_lng, tempo_preparo,
    horario_abertura, horario_fechamento
  ]

  if (logo_url) {
    sqlLogo = ', logo = ?'
    params.push(logo_url)
  }

  params.push(1) // WHERE id = 1

  await c.env.DB.prepare(`
    UPDATE configuracoes SET
      nome_empresa = ?,
      telefone = ?,
      whatsapp = ?,
      email = ?,
      endereco = ?,
      cidade = ?,
      estado = ?,
      cep = ?,
      chave_pix = ?,
      taxa_entrega = ?,
      entrega_km_base = ?,
      entrega_valor_km_adicional = ?,
      entrega_taxa_fallback = ?,
      loja_lat = ?,
      loja_lng = ?,
      tempo_preparo = ?,
      horario_abertura = ?,
      horario_fechamento = ?
      ${sqlLogo}
    WHERE id = ?
  `).bind(...params).run()

  return c.redirect('/configuracoes?ok=1')
})

// Upload de Logo
app.post('/upload-logo', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('logo') as File
  if (!file) return c.json({ error: 'Logo necessária' }, 400)

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
    return c.json({ error: 'Formato não permitido' }, 400)
  }

  const key = `logo_${Date.now()}.${ext}`
  await c.env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
  return c.json({ url: `/r2/${key}` })
})

export default app