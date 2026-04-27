import type { Context } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { requireAdmin } from './_admin.mjs'

export default async (_req: Request, _context: Context) => {
  const guard = await requireAdmin()
  if (guard instanceof Response) return guard

  const store = getStore('orders')
  const { blobs } = await store.list()

  const orders = await Promise.all(
    blobs.map(async (b) => {
      try {
        const data = await store.get(b.key, { type: 'json' })
        if (data && typeof data === 'object') {
          return { ...(data as Record<string, unknown>), _key: b.key }
        }
      } catch {
        /* skip */
      }
      return null
    }),
  )

  const filtered = orders
    .filter((o): o is Record<string, unknown> => o !== null)
    .sort((a, b) => String(b.placedAt || '').localeCompare(String(a.placedAt || '')))

  return Response.json({ orders: filtered })
}
