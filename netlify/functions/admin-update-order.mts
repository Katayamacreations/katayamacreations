import type { Context } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { requireAdmin } from './_admin.mjs'

const ALLOWED_STATUSES = new Set([
  'pending',
  'paid',
  'shipped',
  'delivered',
  'cancelled',
])

interface UpdateBody {
  key?: string
  status?: string
  trackingNumber?: string
  adminNotes?: string
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const guard = await requireAdmin()
  if (guard instanceof Response) return guard

  let body: UpdateBody
  try {
    body = (await req.json()) as UpdateBody
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const key = String(body.key || '').trim()
  if (!key || !key.includes('/')) {
    return new Response('Missing or invalid key', { status: 400 })
  }

  const store = getStore('orders')
  const existing = await store.get(key, { type: 'json' }).catch(() => null)
  if (!existing || typeof existing !== 'object') {
    return new Response('Order not found', { status: 404 })
  }

  const updated: Record<string, unknown> = { ...(existing as Record<string, unknown>) }

  if (body.status !== undefined) {
    const next = String(body.status).toLowerCase().trim()
    if (!ALLOWED_STATUSES.has(next)) {
      return new Response('Invalid status', { status: 400 })
    }
    updated.status = next
  }

  if (body.trackingNumber !== undefined) {
    updated.trackingNumber = String(body.trackingNumber).trim()
  }

  if (body.adminNotes !== undefined) {
    updated.adminNotes = String(body.adminNotes)
  }

  updated.updatedAt = new Date().toISOString()
  updated.updatedBy = guard.email

  await store.setJSON(key, updated)

  return Response.json({ ok: true, order: { ...updated, _key: key } })
}
