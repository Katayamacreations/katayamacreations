import type { Context } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { getUser } from '@netlify/identity'
import { renderOrderEmailHtml, renderOrderEmailText, renderOrderSummaryText, type OrderData, type CartItem } from './_order-email.mjs'
import { db } from '../../db/index.js'
import { notifications } from '../../db/schema.js'

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
  address1?: string
  address2?: string
  city?: string
  state?: string
  zip?: string
  tip?: string
  total?: string
  paymentDeadline?: string
  paymentMethod?: string
  paymentStatus?: string
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const user = await getUser().catch(() => null)
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!user.confirmedAt) {
    return new Response('Please confirm your email before placing an order.', { status: 403 })
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

  const configStore = getStore('site-config')
  const productsData = await configStore.get('products', { type: 'json' }).catch(() => null)
  const products: any[] = Array.isArray(productsData) ? productsData : []

  for (const item of body.cart) {
    const product = products.find((p: any) => p.id === item.bundleId)
    if (product) {
      const ss = product.stockStatus || 'available'
      if (ss === 'out-of-stock' || ss === 'shop-break') {
        return new Response(`"${product.label}" is currently unavailable.`, { status: 400 })
      }
      if (product.stockQty != null) {
        const qty = typeof item.qty === 'number' ? item.qty : 1
        if (qty > product.stockQty) {
          return new Response(`"${product.label}" only has ${product.stockQty} in stock.`, { status: 400 })
        }
      }
    }
  }

  for (const item of body.cart) {
    const product = products.find((p: any) => p.id === item.bundleId)
    if (product && product.stockQty != null) {
      const qty = typeof item.qty === 'number' ? item.qty : 1
      product.stockQty = Math.max(0, product.stockQty - qty)
      if (product.stockQty === 0) {
        product.stockStatus = 'out-of-stock'
      }
    }
  }

  if (products.length > 0) {
    await configStore.setJSON('products', products)
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
    address1: String(body.address1 || '').trim(),
    address2: String(body.address2 || '').trim(),
    city: String(body.city || '').trim(),
    state: String(body.state || ''),
    zip: String(body.zip || '').trim(),
    shippingMethod: String(body.shippingMethod || ''),
    subtotal: String(body.subtotal || '0.00'),
    shippingCost: String(body.shippingCost || '0.00'),
    tip: String(body.tip || '0.00'),
    total: String(body.total || '0.00'),
    paymentDeadline: String(body.paymentDeadline || ''),
    orderNotes: String(body.orderNotes || ''),
    goodreadsUrl: String(body.goodreadsUrl || ''),
    cart: (body.cart || []).map(sanitizeCartItem),
    paymentMethod: String(body.paymentMethod || ''),
    paymentStatus: String(body.paymentStatus || ''),
  }

  const store = getStore('orders')
  await store.setJSON(`${user.id}/${placedAt}-${id}`, order)

  try {
    await db.insert(notifications).values({
      type: 'order',
      title: 'New order',
      body: `${order.customerName || 'A customer'} placed an order for $${order.total}`,
      relatedId: id,
    })
  } catch (err) {
    console.error('Notification insert failed', err)
  }

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
  }

  const siteUrl = Netlify.env.get('URL')
  if (siteUrl) {
    try {
      const formRes = await fetch(siteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          'form-name': 'order-notification',
          'customerName': order.customerName || 'unknown',
          'email': order.email || '',
          'total': `$${order.total}`,
          'subject': `New order: ${order.customerName || 'unknown'} — $${order.total}`,
          'summary': renderOrderSummaryText(order),
        }).toString(),
      })
      if (!formRes.ok) {
        console.error(`Form notification failed ${formRes.status}`)
      }
    } catch (err) {
      console.error('Form notification error', err)
    }
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
