import type { Context } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { requireAdmin } from './_admin.mjs'
import { renderShippedOrderEmailHtml, renderShippedOrderEmailText } from './_order-email.mjs'
import { sendEmail } from './_send-email.mjs'

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
  const previousStatus = String(updated.status || '').toLowerCase().trim()
  let nextStatus = previousStatus

  if (body.status !== undefined) {
    const next = String(body.status).toLowerCase().trim()
    if (!ALLOWED_STATUSES.has(next)) {
      return new Response('Invalid status', { status: 400 })
    }
    updated.status = next
    nextStatus = next
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

  let shippedEmailSent = false
  const shouldSendShippedEmail = previousStatus !== 'shipped' && nextStatus === 'shipped'
  const customerEmail = String(updated.email || '').trim()
  if (shouldSendShippedEmail && customerEmail) {
    const trackingNumber = String(updated.trackingNumber || '').trim()
    try {
      const emailRes = await sendEmail({
        to: customerEmail,
        subject: trackingNumber ? 'Your Katayama Creations order has shipped' : 'Your order has shipped',
        html: renderShippedOrderEmailHtml({
          id: String(updated.id || ''),
          customerName: String(updated.customerName || ''),
          trackingNumber,
        }),
        text: renderShippedOrderEmailText({
          id: String(updated.id || ''),
          customerName: String(updated.customerName || ''),
          trackingNumber,
        }),
      })
      shippedEmailSent = emailRes.ok
      if (!emailRes.ok) {
        console.error(`Shipped order email failed (${emailRes.provider} ${emailRes.status}): ${emailRes.error || ''}`)
      }
    } catch (err) {
      console.error('Shipped order email send failed', err)
    }
  }

  return Response.json({ ok: true, shippedEmailSent, order: { ...updated, _key: key } })
}
