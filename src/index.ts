// ============================================================
// ESPETARIA CLOUDFLARE - Worker principal
// ============================================================

// ---------- Hono & Auth ----------
import { Hono } from 'hono'
import { authMiddleware } from './auth'
import { somenteAdm } from './guards'

// ---------- APIs ----------
import produtosApi from './api/produtos'
import categoriasApi from './api/categorias'
import clientesApi from './api/clientes'
import pedidosApi from './api/pedidos'
import bairrosApi from './api/bairros'
import calculoEntregaApi from './api/calculo-entrega'
import combosApi from './api/combos'
import configuracoesApi from './api/configuracoes'
import financeiroApi from './api/financeiro'
import entregadoresApi from './api/entregadores'
import embalagensApi from './api/embalagens'
import promocoesApi from './api/promocoes'
import comandasApi from './api/comandas'
import pixApi from './api/pix'
import pagamentoApi from './api/pagamento'
import pwaApi from './api/pwa'
import perfilApi from './api/perfil'
import estoqueApi from './api/estoque'
import relatoriosApi from './api/relatorios'
import uploadApi from './api/upload'
import usuariosApi from './api/usuarios'
import importarMenuApi from './api/importar-menu'
import importarMenuPainel from './painel/importar-menu'
import vendasApi from './api/vendas'
import whatsappApi from './api/whatsapp'

// ---------- Painel ----------
import loginPainel from './painel/login'
import dashboardPainel from './painel/dashboard'
import produtosPainel from './painel/produtos'
import categoriasPainel from './painel/categorias'
import clientesPainel from './painel/clientes'
import clienteDetalhesPainel from './painel/cliente-detalhes'
import clienteEditarPainel from './painel/cliente-editar'
import produtoEditarPainel from './painel/produto-editar'
import categoriaEditarPainel from './painel/categoria-editar'
import pedidosPainel from './painel/pedidos'
import bairrosPainel from './painel/bairros'
import combosPainel from './painel/combos'
import configuracoesPainel from './painel/configuracoes'
import financeiroPainel from './painel/financeiro'
import entregadoresPainel from './painel/entregadores'
import embalagensPainel from './painel/embalagens'
import promocoesPainel from './painel/promocoes'
import comandasPainel from './painel/comandas'
import perfilPainel from './painel/perfil'
import estoquePainel from './painel/estoque'
import relatoriosPainel from './painel/relatorios'
import usuariosPainel from './painel/usuarios'
import acessoNegadoPainel from './painel/acesso-negado'
import entregadorApp from './painel/entregador-app'
import vendasPainel from './painel/vendas'

// ---------- Bindings ----------
type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  SESSION_SECRET?: string
  MP_ACCESS_TOKEN: string
  MP_PUBLIC_KEY: string
  ASSETS: Fetcher
}

const app = new Hono<{ Bindings: Bindings }>()

// ============================================================
// 0. APP DO ENTREGADOR (PÚBLICO - registrado ANTES de tudo)
// ============================================================
async function repassarEntregador(c: any) {
  const url = new URL(c.req.url)
  url.pathname = url.pathname.replace(/^\/entregador/, '') || '/'
  const req = new Request(url.toString(), {
    method: c.req.method,
    headers: c.req.raw.headers,
    body: c.req.method === 'GET' || c.req.method === 'HEAD' ? undefined : c.req.raw.body,
    redirect: 'manual'
  })
  return entregadorApp.fetch(req, c.env, c.executionCtx)
}

app.all('/entregador', repassarEntregador)
app.all('/entregador/*', repassarEntregador)

// ============================================================
// 0.1. WEBHOOK DO WHATSAPP (PÚBLICO - ANTES do authMiddleware!)
//      O Meta precisa acessar /api/whatsapp/webhook SEM login
// ============================================================
app.route('/api/whatsapp', whatsappApi)

// ============================================================
// 0.2. MIDDLEWARE: Servir PWA na raiz de chefdabrasa.shop
// ============================================================
app.use('*', async (c, next) => {
  const url = new URL(c.req.url)
  const host = url.hostname
  const path = url.pathname

  console.log(`🌐 [DOMÍNIO] host=${host} path=${path}`)

  if (host === 'chefdabrasa.shop' || host === 'www.chefdabrasa.shop') {
    if (path.startsWith('/api/')) {
      console.log(`  → API, passando para o próximo handler`)
      return next()
    }

    if (path === '/manifest.json') {
      console.log(`  → manifest.json dinâmico`)
      return c.json({
        name: 'Chef da Brasa - Pedido Online',
        short_name: 'Chef da Brasa',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#EA1D2C',
        icons: [
          { src: '/cardapio/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/cardapio/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      })
    }

    const assetPath = path === '/' ? '/cardapio/index.html' : '/cardapio' + path
    const assetUrl = new URL(assetPath, url.origin).toString()

    console.log(`  → buscando asset: ${assetPath}`)

    try {
      const res = await c.env.ASSETS.fetch(assetUrl)
      console.log(`  → status do ASSETS: ${res.status}`)

      if (res.status === 404) {
        console.log(`  → arquivo não encontrado no ASSETS`)
        return next()
      }

      const headers = new Headers(res.headers)
      headers.delete('content-encoding')
      headers.delete('transfer-encoding')

      return new Response(res.body, {
        status: res.status,
        headers: headers
      })
    } catch (e: any) {
      console.error(`  → ERRO no ASSETS.fetch:`, e.message || e)
      return c.text('Erro ao carregar página', 500)
    }
  }

  return next()
})

// ============================================================
// 0.3. MIDDLEWARE: PROIBIR CACHE de páginas dinâmicas
// ============================================================
app.use('*', async (c, next) => {
  await next()
  try {
    const tipo = c.res.headers.get('content-type') || ''
    if (tipo.includes('text/html') || c.req.path.startsWith('/api/')) {
      c.res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
      c.res.headers.set('Pragma', 'no-cache')
    }
  } catch (e) {}
})

// ============================================================
// 1. MIDDLEWARE GERAL DE LOGIN (protege tudo que não for público)
// ============================================================
app.use('*', authMiddleware)

// ============================================================
// 2. ROTA DE SESSÃO
// ============================================================
app.get('/api/session', (c: any) => c.json({ usuario: c.get('usuario') || null }))

// ============================================================
// 3. GUARDS DE PERMISSÃO (rotas só para ADM)
// ============================================================
app.route('/acesso-negado', acessoNegadoPainel)
app.use('/usuarios', somenteAdm)
app.use('/usuarios/*', somenteAdm)
app.use('/api/usuarios', somenteAdm)
app.use('/api/usuarios/*', somenteAdm)
app.use('/importar-menu', somenteAdm)
app.use('/api/importar-menu', somenteAdm)
app.use('/api/importar-menu/*', somenteAdm)
app.use('/vendas', somenteAdm)
app.use('/api/vendas', somenteAdm)
app.use('/api/vendas/*', somenteAdm)

// ============================================================
// 4. LOGIN / LOGOUT
// ============================================================
app.route('/', loginPainel)

// ============================================================
// 5. APIs PÚBLICAS E PROTEGIDAS
// ============================================================
app.route('/api/produtos', produtosApi)
app.route('/api/categorias', categoriasApi)
app.route('/api/clientes', clientesApi)
app.route('/api/pedidos', pedidosApi)
app.route('/api/bairros', bairrosApi)
app.route('/api/calculo-entrega', calculoEntregaApi)
app.route('/api/calculo-de-entrega', calculoEntregaApi)
app.route('/api/combos', combosApi)
app.route('/api/configuracoes', configuracoesApi)
app.route('/api/financeiro', financeiroApi)
app.route('/api/entregadores', entregadoresApi)
app.route('/api/embalagens', embalagensApi)
app.route('/api/promocoes', promocoesApi)
app.route('/api/comandas', comandasApi)
app.route('/api/pix', pixApi)
app.route('/api/pagamento', pagamentoApi)
app.route('/api/perfil', perfilApi)
app.route('/api/estoque', estoqueApi)
app.route('/api/relatorios', relatoriosApi)
app.route('/api/upload', uploadApi)
app.route('/r2', uploadApi)
app.route('/api/usuarios', usuariosApi)
app.route('/api/importar-menu', importarMenuApi)
app.route('/api/vendas', vendasApi)
// OBS: /api/whatsapp já foi registrada no bloco 0.1 (antes do auth)

// PWA endpoints (loja/status, adicionais, pedidos/:id/status)
app.route('/api', pwaApi)

// ============================================================
// 6. PAINEL ADMIN (páginas HTML)
// ============================================================
app.route('/', dashboardPainel)
app.route('/produtos', produtosPainel)
app.route('/categorias', categoriasPainel)
app.route('/clientes', clientesPainel)
app.route('/clientes/detalhes', clienteDetalhesPainel)
app.route('/clientes/editar', clienteEditarPainel)
app.route('/produtos/editar', produtoEditarPainel)
app.route('/categorias/editar', categoriaEditarPainel)
app.route('/pedidos', pedidosPainel)
app.route('/bairros', bairrosPainel)
app.route('/combos', combosPainel)
app.route('/configuracoes', configuracoesPainel)
app.route('/financeiro', financeiroPainel)
app.route('/entregadores', entregadoresPainel)
app.route('/embalagens', embalagensPainel)
app.route('/promocoes', promocoesPainel)
app.route('/comandas', comandasPainel)
app.route('/perfil', perfilPainel)
app.route('/estoque', estoquePainel)
app.route('/relatorios', relatoriosPainel)  
app.route('/usuarios', usuariosPainel)
app.route('/importar-menu', importarMenuPainel)
app.route('/vendas', vendasPainel)

// ============================================================
// 7. PWA (cardápio público) - serve os arquivos estáticos
// ============================================================
app.get('/cardapio', (c) => c.redirect('/cardapio/'))
app.get('/cardapio/*', async (c) => {
  if (c.req.path === '/cardapio/') {
    const newUrl = new URL(c.req.url)
    newUrl.pathname = '/cardapio/index.html'
    const response = await c.env.ASSETS.fetch(newUrl.toString())
    return new Response(response.body, {
      status: response.status,
      headers: response.headers
    })
  }
  return c.env.ASSETS.fetch(c.req.raw)
})

// ============================================================
// 8. EXPORT
// ============================================================
export default app