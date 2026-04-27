import type { Context } from '@netlify/functions'
import { getStore } from '@netlify/blobs'

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url)
  const id = (url.searchParams.get('id') || '').trim()
  if (!id) return new Response('Missing id', { status: 400 })

  const store = getStore('site-photos')
  const result = await store.getWithMetadata(id, { type: 'arrayBuffer' }).catch(() => null)
  if (!result || !result.data) return new Response('Not found', { status: 404 })

  const meta = (result.metadata || {}) as Record<string, unknown>
  const contentType = typeof meta.contentType === 'string' ? meta.contentType : 'application/octet-stream'

  return new Response(result.data as ArrayBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=300',
    },
  })
}
