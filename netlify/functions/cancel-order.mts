import type { Context } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { getUser } from '@netlify/identity'
import { ALERT_RECIPIENTS } from './_admin.mjs'
import {
  renderCancelledOrderAdminEmailHtml,
  renderCancelledOrderAdminEmailText,
  renderCancelledOrderCustomerEmailHtml,
  renderCancelledOrderCustomerEmailText,
} from './_order-email.mjs'
import { sendEmail } from './_send-email.mjs'
import { db } from '../../db/index.js'
import { notifications } from '../../db/schema.js'

const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000
const BLOCKED_STATUSES = new Set(['cancelled', 'shipped', 'delivered'])

interface CancelOrderBody {
  id?: string
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const user = await getUser().catch(() => null)
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: CancelOrderBody
  try {
    body = (await req.json()) as CancelOrderBody
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const orderId = String(body.id || '').trim()
  if (!orderId) {
    return new Response('Missing order id', { status: 400 })
  }

  const store = getStore('orders')
  const { blobs } = await store.list({ prefix: `${user.id}/` })
  let key = ''
  let existing: Record<string, unknown> | null = null

  for (const blob of blobs) {
    const order = await store.get(blob.key, { type: 'json' }).catch(() => null)
    if (order && typeof order === 'object' && String((order as Record<string, unknown>).id || '') === orderId) {
      key = blob.key
      existing = order as Record<string, unknown>
      break
    }
  }

  if (!key || !existing) {
    return new Response('Order not found', { status: 404 })
  }

  const placedAt = new Date(String(existing.placedAt || ''))
  if (Number.isNaN(placedAt.getTime())) {
    return new Response('This order cannot be cancelled online. Please contact us for help.', { status: 400 })
  }

  if (Date.now() - placedAt.getTime() > CANCEL_WINDOW_MS) {
    return new Response('The 24-hour cancellation window has ended. Please contact us for help.', { status: 409 })
  }

  const currentStatus = String(existing.status || 'pending').toLowerCase().trim()
  if (BLOCKED_STATUSES.has(currentStatus)) {
    return new Response(`This order is already ${currentStatus}.`, { status: 409 })
  }

  const cancelledAt = new Date().toISOString()
  const updated: Record<string, unknown> = {
    ...existing,
    status: 'cancelled',
    cancelledAt,
    cancelledBy: 'customer',
    updatedAt: cancelledAt,
    updatedBy: user.email || user.id,
  }

  await store.setJSON(key, updated)
  try {
    await restoreInventory(updated)
  } catch (err) {
    console.error('Cancellation inventory restore failed', err)
  }

  try {
    await db.insert(notifications).values({
      type: 'order',
      title: 'Order cancelled',
      body: `${String(updated.customerName || 'A customer')} cancelled order ${orderId}`,
      relatedId: orderId,
    })
  } catch (err) {
    console.error('Cancellation notification insert failed', err)
  }

  const emailData = {
    id: orderId,
    customerName: String(updated.customerName || ''),
    email: String(updated.email || user.email || ''),
    total: String(updated.total || '0.00'),
    cancelledAt,
  }

  const emailResults = {
    customer: false,
    admin: false,
  }

  if (emailData.email) {
    try {
      const res = await sendEmail({
        to: emailData.email,
        subject: 'Your Katayama Creations order was cancelled',
        html: renderCancelledOrderCustomerEmailHtml(emailData),
        text: renderCancelledOrderCustomerEmailText(emailData),
      })
      emailResults.customer = res.ok
      if (!res.ok) {
        console.error(`Customer cancellation email failed (${res.provider} ${res.status}): ${res.error || ''}`)
      }
    } catch (err) {
      console.error('Customer cancellation email send failed', err)
    }
  }

  try {
    const res = await sendEmail({
      to: ALERT_RECIPIENTS,
      replyTo: emailData.email || ALERT_RECIPIENTS[0],
      subject: `Order cancelled: ${emailData.customerName || 'unknown'} — $${emailData.total}`,
      html: renderCancelledOrderAdminEmailHtml(emailData),
      text: renderCancelledOrderAdminEmailText(emailData),
    })
    emailResults.admin = res.ok
    if (!res.ok) {
      console.error(`Admin cancellation email failed (${res.provider} ${res.status}): ${res.error || ''}`)
    }
  } catch (err) {
    console.error('Admin cancellation email send failed', err)
  }

  return Response.json({ ok: true, order: updated, emails: emailResults })
}

async function restoreInventory(order: Record<string, unknown>) {
  const cart = Array.isArray(order.cart) ? order.cart : []
  if (cart.length === 0) return

  const configStore = getStore('site-config')
  const productsData = await configStore.get('products', { type: 'json' }).catch(() => null)
  const products: any[] = Array.isArray(productsData) ? productsData : []
  if (products.length === 0) return

  let changed = false
  for (const item of cart) {
    if (!item || typeof item !== 'object') continue
    const bundleId = String((item as Record<string, unknown>).bundleId || '')
    const product = products.find((p: any) => p.id === bundleId)
    if (!product || product.stockQty == null) continue
    const qty = typeof (item as any).qty === 'number' ? (item as any).qty : Number((item as any).qty) || 1
    product.stockQty = Math.max(0, Number(product.stockQty) || 0) + qty
    if (product.stockQty > 0 && product.stockStatus === 'out-of-stock') {
      product.stockStatus = 'available'
    }
    changed = true
  }

  if (changed) {
    await configStore.setJSON('products', products)
  }
}
