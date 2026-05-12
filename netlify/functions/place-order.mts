import type { Context } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { getUser } from '@netlify/identity'
import { renderOrderEmailHtml, renderOrderEmailText, type OrderData, type CartItem } from './_order-email.mjs'

const FROM_EMAIL = Netlify.env.get('WELCOME_FROM_EMAIL') || 'Katayama Creations <onboarding@resend.dev>'
const OWNER_EMAIL = Netlify.env.get('OWNER_EMAIL') || 'ogmegbeast@gmail.com'

interface IncomingOrder {
  customerName?: string
  orderNotes?: string
  goodreadsUrl?: string
  cart?: CartItem[]
  subtotal?: string
  shippingCost?: string
  shippingMethod?: string
  state?: string
  zip?: string
  total?: string
  paymentDeadline?: string
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const user = await getUser().catch(() => null)
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: IncomingOrder
  try {
    body = (await req.json()) as IncomingOrder
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  if (!Array.isArray(body.cart) || body.cart.length === 0) {
    return new Response('Cart is empty', { status: 400 })
  }

  const placedAt = new Date().toISOString()
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  const order: OrderData & {
    id: string
    userId: string
    placedAt: string
    status: string
  } = {
    id,
    userId: user.id,
    placedAt,
    status: 'pending',
    customerName: String(body.customerName || user.name || '').trim(),
    email: user.email || '',
    state: String(body.state || ''),
    zip: String(body.zip || '').trim(),
    shippingMethod: String(body.shippingMethod || ''),
    subtotal: String(body.subtotal || '0.00'),
    shippingCost: String(body.shippingCost || '0.00'),
    total: String(body.total || '0.00'),
    paymentDeadline: String(body.paymentDeadline || ''),
    orderNotes: String(body.orderNotes || ''),
    goodreadsUrl: String(body.goodreadsUrl || ''),
    cart: (body.cart || []).map(sanitizeCartItem),
  }

  const store = getStore('orders')
  await store.setJSON(`${user.id}/${placedAt}-${id}`, order)

  const apiKey = Netlify.env.get('RESEND_API_KEY')
  if (apiKey) {
    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [OWNER_EMAIL],
          reply_to: order.email || OWNER_EMAIL,
          subject: `New order: ${order.customerName || 'unknown'} — $${order.total}`,
          html: renderOrderEmailHtml(order),
          text: renderOrderEmailText(order),
        }),
      })
      if (!emailRes.ok) {
        const errBody = await emailRes.text().catch(() => '')
        console.error(`Resend API error ${emailRes.status}: ${errBody}`)
      }
    } catch (err) {
      console.error('Resend send failed', err)
    }
  } else {
    console.warn('RESEND_API_KEY is not set — order email notification was not sent')
  }

  return Response.json({ ok: true, id, placedAt })
}

function sanitizeCartItem(it: CartItem): CartItem {
  return {
    bundleId: typeof it.bundleId === 'string' ? it.bundleId : '',
    bundleLabel: typeof it.bundleLabel === 'string' ? it.bundleLabel : '',
    price: typeof it.price === 'number' ? it.price : Number(it.price) || 0,
    qty: typeof it.qty === 'number' ? it.qty : Number(it.qty) || 1,
    theme: typeof it.theme === 'string' ? it.theme : '',
    color: typeof it.color === 'string' ? it.color : '',
    notes: typeof it.notes === 'string' ? it.notes : '',
  }
}
