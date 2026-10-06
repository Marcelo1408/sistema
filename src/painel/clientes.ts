import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const clientes = await c.env.DB.prepare('SELECT * FROM clientes ORDER BY criado_em DESC').all()

  const conteudo = `
    <div style="background:#fff; padding:20px; border-radius:15px; margin-bottom:25px; box-shadow:0 3px 15px rgba(0,0,0,.05);">
      <h2 style="margin-bottom:15px; color:#333;">👤 Novo Cliente</h2>
      <form method="POST" action="/api/clientes">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
          <input type="text" name="nome" placeholder="Nome Completo" required style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
          <input type="tel" name="telefone" placeholder="Telefone (WhatsApp)" required style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
        </div>
        <div style="display:grid; grid-template-columns:2fr 1fr; gap:10px; margin-bottom:10px;">
          <input type="text" name="endereco" placeholder="Endereço (Rua)" style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
          <input type="text" name="numero" placeholder="Número" style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
          <input type="text" name="bairro" placeholder="Bairro" style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
          <input type="text" name="cep" placeholder="CEP" style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
        </div>
        <input type="text" name="complemento" placeholder="Complemento (Apto, Bloco...)" style="width:100%; padding:12px; margin-bottom:10px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
        <input type="text" name="referencia" placeholder="Ponto de Referência" style="width:100%; padding:12px; margin-bottom:15px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
        <button type="submit" style="background:#ff6b00; color:#fff; border:none; padding:12px 20px; border-radius:8px; cursor:pointer; font-size:16px; width:100%;">Salvar Cliente</button>
      </form>
    </div>

    <div style="background:#fff; border-radius:15px; padding:20px; box-shadow:0 3px 15px rgba(0,0,0,.05); overflow-x:auto;">
      <h2 style="margin-bottom:15px; color:#333;">📋 Clientes Cadastrados (${(clientes.results as any[]).length})</h2>
      <table style="width:100%; border-collapse:collapse; min-width:600px;">
        <thead>
          <tr style="background:#f8f9fa; border-bottom:2px solid #dee2e6;">
            <th style="padding:12px; text-align:left; color:#495057;">Nome</th>
            <th style="padding:12px; text-align:left; color:#495057;">Telefone</th>
            <th style="padding:12px; text-align:left; color:#495057;">Endereço</th>
            <th style="padding:12px; text-align:left; color:#495057;">Pedidos</th>
            <th style="padding:12px; text-align:left; color:#495057;">Total Gasto</th>
          </tr>
        </thead>
        <tbody>
          ${(clientes.results as any[]).length === 0
            ? '<tr><td colspan="5" style="text-align:center; padding:20px; color:#666;">Nenhum cliente cadastrado.</td></tr>'
            : (clientes.results as any[]).map((cli: any) => `
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:12px;"><a href="/clientes/detalhes/${cli.id}" style="color:#007bff; text-decoration:none;"><strong>${cli.nome}</strong></a></td>
                <td style="padding:12px;">${cli.telefone}</td>
                <td style="padding:12px;">${cli.endereco || '-'}, ${cli.numero || ''} - ${cli.bairro || ''}</td>
                <td style="padding:12px;"><span style="background:#e7f1ff; color:#084298; padding:4px 8px; border-radius:12px; font-size:12px; font-weight:bold;">${cli.total_pedidos || 0}</span></td>
                <td style="padding:12px; color:#28a745; font-weight:bold;">R$ ${parseFloat(cli.valor_gasto || 0).toFixed(2).replace('.', ',')}</td>
              </tr>
            `).join('')
          }
        </tbody>
      </table>
    </div>
  `

  return c.html(renderLayout('Clientes', conteudo, 'clientes'))
})

// Atualizar Cliente
app.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.parseBody()
  
  const nome = (body.nome as string)?.trim()
  const telefone = (body.telefone as string)?.replace(/\D/g, '')
  const endereco = (body.endereco as string)?.trim() || ''
  const numero = (body.numero as string)?.trim() || ''
  const bairro = (body.bairro as string)?.trim() || ''
  const complemento = (body.complemento as string)?.trim() || ''
  const cep = (body.cep as string)?.replace(/\D/g, '') || ''
  const referencia = (body.referencia as string)?.trim() || ''

  if (!nome || !telefone) {
    return c.json({ error: 'Nome e telefone obrigatórios' }, 400)
  }

  await c.env.DB.prepare(`
    UPDATE clientes SET nome=?, telefone=?, endereco=?, numero=?, bairro=?, complemento=?, cep=?, referencia=?
    WHERE id=?
  `).bind(nome, telefone, endereco, numero, bairro, complemento, cep, referencia, id).run()

  return c.redirect('/clientes/detalhes/' + id)
})

export default app