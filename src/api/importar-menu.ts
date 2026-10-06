import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  AI: any
  GEMINI_API_KEY?: string
}

const app = new Hono<{ Bindings: Bindings }>()

function parsePreco(v: any): number {
  const s = String(v ?? '').replace(/[^\d.,]/g, '')
  if (!s) return 0
  const normalizado = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const n = Number(normalizado)
  return isFinite(n) ? n : 0
}

function normalizarDataISO(d: any): string {
  const s = String(d || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0')
  return ''
}

function dataMovimentoSegura(d: any): string {
  const iso = normalizarDataISO(d)
  if (!iso) return ''
  const ano = Number(iso.slice(0, 4))
  const anoAtual = new Date().getFullYear()
  if (ano < anoAtual - 1 || ano > anoAtual) return ''
  return iso
}

const PROMPT = `Voce e um extrator de notas fiscais e cardapios de restaurante. Analise a imagem com atencao.

1) DADOS DO FORNECEDOR (topo/cabecalho da nota):
- nome_comercio: nome da empresa/loja
- cnpj: CNPJ (so numeros, 14 digitos)
- endereco: endereco completo (rua, numero, bairro, cidade, UF)
- telefone: telefone de contato (se houver)
- numero_nota: numero da nota (se houver)
- data_emissao: data da emissao no formato AAAA-MM-DD (se houver)

2) ITENS (produtos comprados):
Para cada item, retorne:
- nome (string): nome do produto
- quantidade (numero): quantidade comprada (se nao aparecer, use 1.0)
- preco_unitario (numero com ponto, ex: 7.44): preco por unidade ou kg
- valor_total (numero com ponto): preco_unitario x quantidade
- categoria (uma de: INSUMOS, BEBIDAS, EMBALAGENS, OUTROS)

IGNORE: logotipos, slogans, codigos de barras, totais finais, impostos detalhados, e itens riscados.
Responda APENAS com JSON valido no formato:
{
  "fornecedor": { "nome_comercio": "...", "cnpj": "...", "endereco": "...", "telefone": "...", "numero_nota": "...", "data_emissao": "..." },
  "itens": [ { "nome": "...", "quantidade": 1.0, "preco_unitario": 7.44, "valor_total": 14.88, "categoria": "INSUMOS" } ]
}
Sem markdown, sem explicacoes.`

// ===== Pergunta ao Google quais modelos existem AGORA (à prova de aposentadoria) =====
async function listarModelosGemini(key: string): Promise<string[]> {
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + key + '&pageSize=200')
    if (!r.ok) return []
    const j: any = await r.json()
    const todos = (j?.models || [])
      .filter((m: any) => (m?.supportedGenerationMethods || []).includes('generateContent'))
      .map((m: any) => String(m?.name || '').replace('models/', ''))
      .filter((n: string) => n && !n.includes('embedding') && !n.includes('tts') && !n.includes('imagen'))
    const flash = todos.filter((n: string) => n.includes('flash'))
    return [...flash, ...todos.filter((n: string) => !flash.includes(n))]
  } catch { return [] }
}

// ===== DIAGNÓSTICO =====
app.get('/teste', async (c) => {
  const temChave = !!c.env.GEMINI_API_KEY
  const temAI = !!c.env.AI
  let testeGemini: any = null
  let modelos: string[] = []
  if (temChave) {
    modelos = await listarModelosGemini(String(c.env.GEMINI_API_KEY))
    testeGemini = { ok: modelos.length > 0, primeiros: modelos.slice(0, 5) }
  }
  return c.json({ tem_chave_gemini: temChave, tem_binding_ai: temAI, teste_gemini: testeGemini })
})

// ---------- 1. Ler a foto ----------
app.post('/foto', async (c) => {
  let base64 = ''
  const contentType = c.req.header('content-type') || ''
  if (contentType.includes('application/json')) {
    const body = await c.req.json()
    base64 = String(body?.imagem_base64 || '')
  } else {
    const form = await c.req.formData()
    const file = form.get('imagem') as File | null
    if (!file) return c.json({ erro: 'Envie uma imagem.' }, 400)
    if (file.size > 4 * 1024 * 1024) return c.json({ erro: 'Imagem muito grande (máximo 4MB).' }, 400)
    const bytes = new Uint8Array(await file.arrayBuffer())
    let bin = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
    base64 = btoa(bin)
  }

  base64 = base64.replace(/\s/g, '').replace(/^data:image\/[a-z+.-]+;base64,/i, '')
  if (!base64) return c.json({ erro: 'Imagem não recebida.' }, 400)

  const erros: string[] = []
  let texto = ''

  // ===== GEMINI (modelo atual de 2026 + lista dinâmica) =====
  const geminiKey = String(c.env.GEMINI_API_KEY || '')
  if (!geminiKey) {
    erros.push('Gemini: chave GEMINI_API_KEY não configurada (use: npx wrangler secret put GEMINI_API_KEY)')
  } else {
    const dinamicos = await listarModelosGemini(geminiKey)
    const modelosGemini = [...new Set(['gemini-3.6-flash', ...dinamicos, 'gemini-flash-latest'])].slice(0, 5)

    for (const modelo of modelosGemini) {
      try {
        const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + modelo + ':generateContent?key=' + geminiKey, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: 'image/jpeg', data: base64 } }
              ]
            }],
            generationConfig: { temperature: 0 }
          })
        })
        const j: any = await resp.json()
        if (!resp.ok) throw new Error(j?.error?.message || ('HTTP ' + resp.status))
        texto = (j?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('')
        if (texto) break
      } catch (e: any) {
        erros.push('Gemini(' + modelo + '): ' + (e?.message || e))
      }
    }
  }

  // ===== FALLBACK: Workers AI =====
  if (!texto && c.env.AI) {
    try {
      const binario = atob(base64)
      const bytes = new Uint8Array(binario.length)
      for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
      const r: any = await c.env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
        prompt: PROMPT,
        image: Array.from(bytes)
      })
      texto = r?.response || ''
    } catch (e: any) {
      erros.push('WorkersAI: ' + (e?.message || e))
    }
  }

  if (!texto) {
    return c.json({ erro: 'Nenhuma IA conseguiu processar. Detalhes: ' + erros.join(' | ') }, 500)
  }

  let dados: any = null
  try {
    const match = texto.match(/\{[\s\S]*\}/)
    if (match) dados = JSON.parse(match[0])
  } catch {}

  if (!dados) {
    return c.json({ erro: 'A IA respondeu, mas não devolveu JSON válido. Resposta: ' + texto.slice(0, 300) }, 500)
  }

  const fornecedor = {
    nome_comercio: String(dados?.fornecedor?.nome_comercio || '').trim(),
    cnpj: String(dados?.fornecedor?.cnpj || '').replace(/\D/g, ''),
    endereco: String(dados?.fornecedor?.endereco || '').trim(),
    telefone: String(dados?.fornecedor?.telefone || '').trim(),
    numero_nota: String(dados?.fornecedor?.numero_nota || '').trim(),
    data_emissao: String(dados?.fornecedor?.data_emissao || '').trim()
  }

  const brutos = Array.isArray(dados?.itens) ? dados.itens : (Array.isArray(dados) ? dados : [])

  const itens = brutos
    .map((b: any) => {
      const precoUnitario = parsePreco(b?.preco_unitario ?? b?.preco ?? b?.price)
      const quantidade = Number(b?.quantidade ?? b?.qty ?? 1) || 1
      const valorTotal = parsePreco(b?.valor_total ?? b?.total) || (precoUnitario * quantidade)
      return {
        nome: String(b?.nome || b?.name || '').trim(),
        quantidade: quantidade,
        preco_unitario: precoUnitario,
        valor_total: valorTotal,
        categoria: String(b?.categoria || b?.category || 'INSUMOS').trim().toUpperCase()
      }
    })
    .filter((i: any) => i.nome && i.preco_unitario > 0)
    .slice(0, 80)

  return c.json({ fornecedor, itens })
})

// ---------- 2. Confirmar ----------
app.post('/confirmar', async (c) => {
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ erro: 'Corpo da requisição inválido.' }, 400) }

  const itens = Array.isArray(body?.itens) ? body.itens : []
  const fornecedor = body?.fornecedor || {}
  const tipo = String(body?.tipo || 'CARDAPIO').toUpperCase()
  const ehNota = tipo === 'NOTA'

  let processados = 0
  let falhas = 0
  let totalNota = 0
  const itensNota: string[] = []

  for (const item of itens) {
    try {
      const nome = String(item?.nome || '').trim()
      const precoUnitario = Number(item?.preco_unitario || item?.preco)
      const quantidade = Number(item?.quantidade || 1)
      const valorTotal = Number(item?.valor_total || (precoUnitario * quantidade))
      if (!nome || !(precoUnitario > 0)) { falhas++; continue }

      if (!ehNota) {
        const catNome = String(item?.categoria || 'OUTROS').trim().toUpperCase() || 'OUTROS'
        let catId: number | null = null
        try {
          const cat = await c.env.DB.prepare('SELECT id FROM categorias WHERE UPPER(nome) = ?').bind(catNome).first() as any
          catId = cat?.id ?? null
          if (!catId) {
            try {
              const ins = await c.env.DB.prepare('INSERT INTO categorias (nome, ativo) VALUES (?, 1)').bind(catNome).run()
              catId = (ins.meta.last_row_id as number) || null
            } catch { catId = null }
          }
        } catch { catId = null }

        await c.env.DB.prepare(
          'INSERT INTO produtos (nome, descricao, preco, estoque, categoria_id, ativo) VALUES (?, ?, ?, ?, ?, 1)'
        ).bind(nome, '', precoUnitario, Math.ceil(quantidade), catId).run()
      }

      processados++
      totalNota += valorTotal
      itensNota.push(`${quantidade}x ${nome} = R$ ${valorTotal.toFixed(2)}`)
    } catch (e) {
      falhas++
    }
  }

  let lancamentoFinanceiro = false
  if (ehNota && totalNota > 0) {
    const hoje = new Date().toISOString().slice(0, 10)
    const fornecedorLimpo = {
      nome_comercio: String(fornecedor?.nome_comercio || '').trim(),
      cnpj: String(fornecedor?.cnpj || '').replace(/\D/g, ''),
      endereco: String(fornecedor?.endereco || '').trim(),
      telefone: String(fornecedor?.telefone || '').trim(),
      numero_nota: String(fornecedor?.numero_nota || '').trim(),
      data_emissao: String(fornecedor?.data_emissao || '').trim()
    }

    const dataMov = dataMovimentoSegura(fornecedorLimpo.data_emissao) || hoje
    const obs = JSON.stringify({ fornecedor: fornecedorLimpo, itens: itensNota })
    const descricao = fornecedorLimpo.nome_comercio
      ? `Compra em ${fornecedorLimpo.nome_comercio}`
      : 'Compra de insumos (importação por nota)'

    try {
      await c.env.DB.prepare(
        `INSERT INTO financeiro (tipo, descricao, valor, data_movimento, forma_pagamento, categoria, observacao)
         VALUES ('SAIDA', ?, ?, ?, 'OUTRO', 'INSUMOS', ?)`
      ).bind(descricao, totalNota, dataMov, obs).run()
      lancamentoFinanceiro = true
    } catch {
      try {
        await c.env.DB.prepare(
          `INSERT INTO financeiro (tipo, descricao, valor, data_movimento) VALUES ('SAIDA', ?, ?, ?)`
        ).bind(descricao, totalNota, hoje).run()
        lancamentoFinanceiro = true
      } catch { lancamentoFinanceiro = false }
    }
  }

  return c.json({
    sucesso: true,
    criados: ehNota ? 0 : processados,
    itensNota: itensNota.length,
    falhas,
    totalNota: +totalNota.toFixed(2),
    lancamentoFinanceiro,
    tipo
  })
})

export default app