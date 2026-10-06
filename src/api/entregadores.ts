import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Garante tabelas E colunas (conserta banco antigo automaticamente)
async function garantirTabelas(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS entregadores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    telefone TEXT,
    ativo INTEGER DEFAULT 1,
    criado_em TEXT DEFAULT (datetime('now'))
  )`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS entregas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER,
    entregador_id INTEGER,
    status TEXT DEFAULT 'ATRIBUIDA',
    criado_em TEXT DEFAULT (datetime('now')),
    atualizado_em TEXT
  )`).run()

  // Descobre quais colunas existem e cria as faltantes
  const cols = await db.prepare('PRAGMA table_info(entregadores)').all()
  const nomes = (cols.results as any[]).map((x) => x.name)
  const faltantes: Array<[string, string]> = [
    ['veiculo', "TEXT DEFAULT 'MOTO'"],
    ['disponivel', 'INTEGER DEFAULT 0'],
    ['entregas_ativas', 'INTEGER DEFAULT 0'],
    ['checkin_em', 'TEXT']
  ]
  for (const par of faltantes) {
    if (!nomes.includes(par[0])) {
      try { await db.prepare('ALTER TABLE entregadores ADD COLUMN ' + par[0] + ' ' + par[1]).run() } catch {}
    }
  }
}

function paginaErro(msg: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <style>body{font-family:Arial,sans-serif;background:#f4f6f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
  .box{background:#fff;padding:30px;border-radius:15px;box-shadow:0 4px 15px rgba(0,0,0,.1);max-width:420px;text-align:center;}
  a{display:inline-block;margin-top:15px;background:#ff6b00;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;}</style>
  </head><body><div class="box"><h2>⚠️ Ops!</h2><p>${msg}</p><a href="/entregadores">Voltar para Entregadores</a></div></body></html>`
}

// ---------- Cadastrar entregador ----------
app.post('/', async (c) => {
  try {
    await garantirTabelas(c.env.DB)
    const body = await c.req.parseBody()
    const nome = String(body.nome || '').trim()
    const telefone = String(body.telefone || '').replace(/\D/g, '')
    const veiculo = String(body.veiculo || 'MOTO').toUpperCase()
    if (!nome || telefone.length < 10) {
      return c.html(paginaErro('Nome e telefone válidos são obrigatórios.'), 400)
    }
    await c.env.DB.prepare(
      `INSERT INTO entregadores (nome, telefone, veiculo, ativo, disponivel, entregas_ativas) VALUES (?, ?, ?, 1, 0, 0)`
    ).bind(nome, telefone, veiculo).run()
    return c.redirect('/entregadores')
  } catch (e: any) {
    return c.html(paginaErro('Erro ao cadastrar: ' + (e?.message || e)), 500)
  }
})

// ---------- Alternar "Na loja / Fora" ----------
app.get('/toggle/:id', async (c) => {
  try {
    await garantirTabelas(c.env.DB)
    const id = parseInt(c.req.param('id'))
    const ent = await c.env.DB.prepare('SELECT * FROM entregadores WHERE id = ?').bind(id).first() as any
    if (!ent) return c.redirect('/entregadores')
    if (Number(ent.disponivel) === 1) {
      await c.env.DB.prepare(`UPDATE entregadores SET disponivel = 0, checkin_em = NULL WHERE id = ?`).bind(id).run()
    } else {
      await c.env.DB.prepare(`UPDATE entregadores SET disponivel = 1, checkin_em = datetime('now') WHERE id = ?`).bind(id).run()
    }
    return c.redirect('/entregadores')
  } catch (e: any) {
    return c.html(paginaErro('Erro ao alternar situação: ' + (e?.message || e)), 500)
  }
})

// ---------- Excluir ----------
app.get('/excluir/:id', async (c) => {
  try {
    await garantirTabelas(c.env.DB)
    const id = parseInt(c.req.param('id'))
    await c.env.DB.prepare('DELETE FROM entregadores WHERE id = ?').bind(id).run()
    return c.redirect('/entregadores')
  } catch (e: any) {
    return c.html(paginaErro('Erro ao excluir: ' + (e?.message || e)), 500)
  }
})

// ---------- BOTÃO ENTREGAR: atribui pedido pela fila ----------
app.get('/atribuir/:pedidoId', async (c) => {
  try {
    await garantirTabelas(c.env.DB)
    const pedidoId = parseInt(c.req.param('pedidoId'))

    const ja = await c.env.DB.prepare(
      `SELECT id FROM entregas WHERE pedido_id = ? AND status IN ('ATRIBUIDA', 'A_CAMINHO')`
    ).bind(pedidoId).first()
    if (ja) return c.json({ sucesso: false, erro: 'Este pedido já está com um entregador.' }, 400)

    const ent = await c.env.DB.prepare(
      `SELECT * FROM entregadores WHERE ativo = 1 AND disponivel = 1
       ORDER BY entregas_ativas ASC, checkin_em ASC LIMIT 1`
    ).first() as any

    if (!ent) {
      return c.json({ sucesso: false, erro: 'Nenhum entregador disponível na loja agora. Marque alguém como "Na loja" em Entregadores.' }, 400)
    }

    await c.env.DB.prepare(
      `INSERT INTO entregas (pedido_id, entregador_id, status) VALUES (?, ?, 'ATRIBUIDA')`
    ).bind(pedidoId, ent.id).run()

    await c.env.DB.prepare(
      `UPDATE entregadores SET entregas_ativas = entregas_ativas + 1 WHERE id = ?`
    ).bind(ent.id).run()

    try {
      await c.env.DB.prepare(`UPDATE pedidos SET status = 'SAIU_ENTREGA' WHERE id = ?`).bind(pedidoId).run()
    } catch {}

    return c.json({ sucesso: true, entregador: ent.nome })
  } catch (e: any) {
    return c.json({ sucesso: false, erro: 'Erro ao atribuir: ' + (e?.message || e) }, 500)
  }
})

export default app