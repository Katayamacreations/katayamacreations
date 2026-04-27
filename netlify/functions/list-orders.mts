import type { Context } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { getUser } from '@netlify/identity'

export default async (_req: Request, _context: Context) => {
  const user = await getUser().catch(() => null)
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const store = getStore('orders')
  const { blobs } = await store.list({ prefix: `${user.id}/` })

  const orders = await Promise.all(
    blobs.map(async (b) => {
      try {
        return await store.get(b.key, { type: 'json' })
      } catch {
        return null
      }
    }),
  )

  const filtered = orders
    .filter((o): o is Record<string, unknown> => o !== null && typeof o === 'object')
    .sort((a, b) => String(b.placedAt || '').localeCompare(String(a.placedAt || '')))

  return Response.json({ orders: filtered })
}
