import type { Context } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { requireAdmin } from './_admin.mjs'

interface PhotoMeta {
  id: string
  name: string
  contentType: string
  size: number
  caption?: string
  uploadedAt: string
  uploadedBy?: string
}

interface UploadBody {
  name?: string
  caption?: string
  contentType?: string
  dataBase64?: string
}

const INDEX_KEY = 'index'
const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])

async function readIndex(): Promise<PhotoMeta[]> {
  const store = getStore('site-config')
  const data = await store.get(`photos-${INDEX_KEY}`, { type: 'json' }).catch(() => null)
  if (Array.isArray(data)) return data as PhotoMeta[]
  return []
}

async function writeIndex(items: PhotoMeta[]) {
  const store = getStore('site-config')
  await store.setJSON(`photos-${INDEX_KEY}`, items)
}

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, '')
  const buf = Buffer.from(clean, 'base64')
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'GET') {
    const items = await readIndex()
    return Response.json({ photos: items })
  }

  const guard = await requireAdmin()
  if (guard instanceof Response) return guard

  if (req.method === 'POST') {
    let body: UploadBody
    try {
      body = (await req.json()) as UploadBody
    } catch {
      return new Response('Invalid JSON', { status: 400 })
    }

    const name = String(body.name || '').trim() || 'photo'
    const contentType = String(body.contentType || '').trim().toLowerCase()
    const dataBase64 = String(body.dataBase64 || '')

    if (!ALLOWED.has(contentType)) {
      return new Response('Unsupported image type. Use PNG, JPEG, WEBP, or GIF.', { status: 400 })
    }
    if (!dataBase64) return new Response('Image data is required', { status: 400 })

    let bytes: Uint8Array
    try {
      bytes = decodeBase64(dataBase64)
    } catch {
      return new Response('Invalid base64 image data', { status: 400 })
    }

    if (bytes.byteLength === 0) return new Response('Image data is empty', { status: 400 })
    if (bytes.byteLength > MAX_SIZE) {
      return new Response(`Image too large (max ${MAX_SIZE / (1024 * 1024)} MB)`, { status: 413 })
    }

    const id = newId()
    const photoStore = getStore('site-photos')
    await photoStore.set(id, bytes, {
      metadata: { contentType, name, caption: String(body.caption || '') },
    })

    const meta: PhotoMeta = {
      id,
      name,
      contentType,
      size: bytes.byteLength,
      caption: String(body.caption || ''),
      uploadedAt: new Date().toISOString(),
      uploadedBy: guard.email,
    }
    const items = await readIndex()
    items.unshift(meta)
    await writeIndex(items)

    return Response.json({ ok: true, photo: meta })
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url)
    const id = (url.searchParams.get('id') || '').trim()
    if (!id) return new Response('Missing id', { status: 400 })

    const items = await readIndex()
    const next = items.filter((p) => p.id !== id)
    if (next.length === items.length) return new Response('Photo not found', { status: 404 })
    await writeIndex(next)

    const photoStore = getStore('site-photos')
    await photoStore.delete(id).catch(() => {})

    return Response.json({ ok: true, photos: next })
  }

  return new Response('Method not allowed', { status: 405 })
}
