import type { Context } from '@netlify/functions'
import { getStore } from '@netlify/blobs'

export default async (_req: Request, _context: Context) => {
  const store = getStore('site-config')

  const [products, photos] = await Promise.all([
    store.get('products', { type: 'json' }).catch(() => null),
    store.get('photos-index', { type: 'json' }).catch(() => null),
  ])

  return Response.json({
    products: Array.isArray(products) ? products : [],
    photos: Array.isArray(photos) ? photos : [],
  })
}
