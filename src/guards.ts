// src/guards.ts
import type { Next } from 'hono'

// Só deixa passar se o usuário logado for nível ADM.
// Caso contrário, manda para a página de Acesso Negado.
export const somenteAdm = async (c: any, next: Next) => {
  const usuario = c.get('usuario')

  // Se por algum motivo não tem usuário logado, volta pro login
  if (!usuario) return c.redirect('/login')

  const user = await c.env.DB
    .prepare('SELECT nivel FROM usuarios WHERE usuario = ?')
    .bind(usuario)
    .first() as any

  if (!user || user.nivel !== 'ADM') {
    return c.redirect('/acesso-negado')
  }

  return next()
}