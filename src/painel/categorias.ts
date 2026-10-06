import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const categorias = await c.env.DB.prepare('SELECT * FROM categorias ORDER BY nome').all()

  const conteudo = `
    <div style="background:#fff; padding:20px; border-radius:15px; margin-bottom:25px; box-shadow:0 3px 15px rgba(0,0,0,.05);">
      <h2 style="margin-bottom:15px; color:#333;">📂 Nova Categoria</h2>
      <form method="POST" action="/api/categorias">
        <input type="text" name="nome" placeholder="Nome da Categoria (ex: Espetos, Bebidas)" required style="width:100%; padding:12px; margin-bottom:10px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
        <label style="display:flex; align-items:center; gap:10px; margin-bottom:15px; color:#555;">
          <input type="checkbox" name="ativo" checked style="width:auto;"> Ativo
        </label>
        <button type="submit" style="background:#ff6b00; color:#fff; border:none; padding:12px 20px; border-radius:8px; cursor:pointer; font-size:16px; width:100%;">Salvar Categoria</button>
      </form>
    </div>

    <div style="background:#fff; border-radius:15px; padding:20px; box-shadow:0 3px 15px rgba(0,0,0,.05);">
      <h2 style="margin-bottom:15px; color:#333;">📋 Categorias Cadastradas</h2>
      ${(categorias.results as any[]).length === 0 
        ? '<p style="color:#666; text-align:center; padding: 20px;">Nenhuma categoria cadastrada ainda.</p>'
        : (categorias.results as any[]).map((cat: any) => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #eee;">
            <div>
              <strong style="font-size:16px;">${cat.nome}</strong>
              ${cat.ativo 
                ? '<span style="background:#d4edda; color:#155724; padding:4px 8px; border-radius:12px; font-size:12px; margin-left:10px;">Ativo</span>' 
                : '<span style="background:#f8d7da; color:#721c24; padding:4px 8px; border-radius:12px; font-size:12px; margin-left:10px;">Inativo</span>'}
            </div>
            <a href="/categorias/editar/${cat.id}" style="background:#0d6efd; color:#fff; padding:6px 12px; border-radius:5px; text-decoration:none; font-size:14px; margin-right:6px;">✏️ Editar</a>
          </div>
        `).join('')
      }
    </div>
  `

  return c.html(renderLayout('Categorias', conteudo, 'categorias'))
})

export default app