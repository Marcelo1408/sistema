// src/auth.ts
import type { Next } from 'hono'
import { getCookie } from 'hono/cookie'

export const COOKIE = 'painel_session'
const DURACAO_HORAS = 12

// ---------- Base64 sem btoa/atob (compatível com Workers) ----------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function bytesParaBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0
    out += B64[b0 >> 2]
    out += B64[((b0 & 3) << 4) | (b1 >> 4)]
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '='
    out += i + 2 < bytes.length ? B64[b2 & 63] : '='
  }
  return out
}

function base64ParaBytes(b64: string): Uint8Array {
  const limpo = b64.replace(/=+$/, '')
  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (const ch of limpo) {
    const idx = B64.indexOf(ch)
    if (idx === -1) continue
    buffer = (buffer << 6) | idx
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 255)
    }
  }
  return new Uint8Array(bytes)
}

// ---------- Criptografia ----------
function paraHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function assinar(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return paraHex(sig)
}

export async function sha256hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return paraHex(buf)
}

function b64url(texto: string): string {
  return bytesParaBase64(new TextEncoder().encode(texto))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function deb64url(token: string): string {
  const normal = token.replace(/-/g, '+').replace(/_/g, '/')
  return new TextDecoder().decode(base64ParaBytes(normal))
}

// ---------- Token de sessão ----------
export async function criarToken(usuario: string, secret: string): Promise<string> {
  const exp = Date.now() + DURACAO_HORAS * 3600 * 1000
  const payload = b64url(JSON.stringify({ u: usuario, exp }))
  const sig = await assinar(payload, secret)
  return payload + '.' + sig
}

export async function verificarToken(token: string, secret: string): Promise<string | null> {
  if (!token) return null
  const idx = token.lastIndexOf('.')
  if (idx < 0) return null
  const payload = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  const esperado = await assinar(payload, secret)
  if (sig !== esperado) return null
  try {
    const dados = JSON.parse(deb64url(payload))
    if (!dados.exp || dados.exp < Date.now()) return null
    return dados.u || null
  } catch {
    return null
  }
}

// ---------- Rotas públicas (sem login) ----------
export function ehPublico(path: string, method: string): boolean {
  if (path === '/login' || path === '/logout' || path === '/favicon.ico') return true
  if (path.startsWith('/api/pix/')) return true
  if (path.startsWith('/api/pagamento/')) return true
  if (path.startsWith('/r2/')) return true
  if (path.startsWith('/cardapio')) return true

  if (method === 'GET' || method === 'HEAD') {
    if ([
      '/api/produtos',
      '/api/categorias',
      '/api/combos',
      '/api/promocoes',
      '/api/bairros',
      '/api/configuracoes/public',
      '/api/session',
      '/api/loja/status',
      '/api/adicionais'
    ].includes(path)) return true
    if (path.startsWith('/api/clientes/telefone/')) return true
    if (/^\/api\/pedidos\/\d+\/status$/.test(path)) return true
  }

  if (method === 'POST') {
    if ([
      '/api/pedidos',
      '/api/clientes',
      '/api/pedidos/confirmar-entrega',
      '/api/calculo-de-entrega',
      '/api/calculo-entrega'
    ].includes(path)) return true
  }

  return false
}

// ---------- Middleware de proteção ----------
export const authMiddleware = async (c: any, next: Next) => {
  const path = new URL(c.req.url).pathname

  if (ehPublico(path, c.req.method)) {
    return next()
  }

  const secret = c.env.SESSION_SECRET || 'segredo-dev-troque-no-deploy'
  const token = getCookie(c, COOKIE) || ''
  const usuario = await verificarToken(token, secret)

  if (!usuario) {
    if (path.startsWith('/api/')) {
      return c.json({ erro: 'Não autorizado. Faça login.' }, 401)
    }
    return c.redirect('/login')
  }

  c.set('usuario', usuario)
  return next()
}