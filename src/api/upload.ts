import { Hono } from 'hono'

type Bindings = {
  BUCKET: R2Bucket
}

const app = new Hono<{ Bindings: Bindings }>()

// Upload
app.post('/', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('imagem') as File
  if (!file) return c.json({ error: 'Imagem necessária' }, 400)

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `${Date.now()}_${safeName}`
  
  await c.env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
  return c.json({ url: `/r2/${key}` })
})

// Servir Imagem
app.get('/:key', async (c) => {
  const obj = await c.env.BUCKET.get(c.req.param('key'))
  if (!obj) return c.notFound()
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  return new Response(obj.body, { headers })
})

export default app