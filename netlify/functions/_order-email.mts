import { wrapEmail, escapeHtml, SITE_NAME, COLORS } from './_email-brand.mjs'

export interface CartItem {
  bundleLabel?: string
  bundleId?: string
  price?: number
  qty?: number
  theme?: string
  color?: string
  notes?: string
}

export interface OrderData {
  customerName: string
  email: string
  address1?: string
  address2?: string
  city?: string
  state: string
  zip?: string
  billingSameAsShipping?: boolean
  billingAddress1?: string
  billingAddress2?: string
  billingCity?: string
  billingState?: string
  billingZip?: string
  shippingMethod: string
  subtotal: string
  shippingCost: string
  tip?: string
  total: string
  paymentDeadline: string
  orderNotes: string
  goodreadsUrl?: string
  raffleTickets?: string[]
  cart: CartItem[]
}

// True when the customer provided a billing address that differs from the shipping address.
function hasSeparateBilling(o: OrderData): boolean {
  if (o.billingSameAsShipping) return false
  const billing = [o.billingAddress1, o.billingAddress2, o.billingCity, o.billingState, o.billingZip]
  if (!billing.some((v) => (v || '').trim())) return false
  const shipping = [o.address1, o.address2, o.city, o.state, o.zip]
  return billing.map((v) => (v || '').trim()).join('|') !== shipping.map((v) => (v || '').trim()).join('|')
}

function fmtDeadline(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

export function renderOrderEmailHtml(o: OrderData): string {
  const rows = (o.cart || []).map((item) => {
    const label = escapeHtml(item.bundleLabel || item.bundleId || 'Item')
    const qty = item.qty || 1
    const price = typeof item.price === 'number' ? item.price : 0
    const line = (price * qty).toFixed(2)
    const meta = [item.theme, item.color].filter(Boolean).map(escapeHtml).join(' · ')
    const notes = item.notes ? `<div style="font-size:12px;color:#a8a3b8;margin-top:4px;">Note: ${escapeHtml(item.notes)}</div>` : ''
    const metaRow = meta ? `<div style="font-size:12px;color:#a8a3b8;margin-top:2px;">${meta}</div>` : ''
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};">
          <div style="font-weight:700;color:${COLORS.heading};">${label} × ${qty}</div>
          ${metaRow}
          ${notes}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};text-align:right;color:${COLORS.heading};white-space:nowrap;">$${line}</td>
      </tr>`
  }).join('')

  const orderNotesBlock = o.orderNotes
    ? `<p style="margin:16px 0 0;line-height:1.5;color:${COLORS.body};"><strong>Notes:</strong> ${escapeHtml(o.orderNotes)}</p>`
    : ''

  const goodreadsBlock = o.goodreadsUrl
    ? `<p style="margin:8px 0 0;line-height:1.5;color:${COLORS.body};font-size:14px;"><strong>Goodreads:</strong> <a href="${escapeHtml(o.goodreadsUrl)}" style="color:${COLORS.link};">${escapeHtml(o.goodreadsUrl)}</a></p>`
    : ''

  const raffleBlock = (o.raffleTickets && o.raffleTickets.length)
    ? `<div style="margin-top:18px;padding:12px 14px;background:rgba(120,180,120,0.12);border:1px solid rgba(120,180,120,0.3);border-radius:12px;color:#b8e0c2;font-size:14px;line-height:1.5;">🎟️ <strong>Raffle ticket${o.raffleTickets.length > 1 ? 's' : ''}:</strong> ${o.raffleTickets.map(escapeHtml).join(', ')} <span style="color:${COLORS.muted};">(Kindle Book Box drawing — includes a Matcha Kindle E-Reader)</span></div>`
    : ''

  const tipValue = parseFloat(o.tip || '0')
  const tipRow = tipValue > 0
    ? `<tr><td style="color:${COLORS.body};padding:4px 0;">Tip</td><td style="text-align:right;color:${COLORS.body};padding:4px 0;">$${escapeHtml(o.tip!)}</td></tr>`
    : ''

  const billingBlock = hasSeparateBilling(o)
    ? `<p style="margin:8px 0 0;line-height:1.5;color:${COLORS.body};font-size:14px;"><strong>Bill to:</strong> ${escapeHtml(o.billingAddress1 || '')}${o.billingAddress2 ? `, ${escapeHtml(o.billingAddress2)}` : ''}, ${escapeHtml(o.billingCity || '')}${o.billingState ? `, ${escapeHtml(o.billingState)}` : ''}${o.billingZip ? ` ${escapeHtml(o.billingZip)}` : ''}</p>`
    : ''

  const content = `<h1 style="margin:0 0 8px;font-size:22px;color:${COLORS.heading};">New custom order</h1>
<p style="margin:0 0 20px;color:#b8b3c8;font-size:14px;">From <strong>${escapeHtml(o.customerName || 'unknown')}</strong> — <a href="mailto:${escapeHtml(o.email)}" style="color:${COLORS.link};">${escapeHtml(o.email)}</a></p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
  ${rows}
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
  <tr><td style="color:${COLORS.body};padding:4px 0;">Subtotal</td><td style="text-align:right;color:${COLORS.body};padding:4px 0;">$${escapeHtml(o.subtotal)}</td></tr>
  <tr><td style="color:${COLORS.body};padding:4px 0;">Shipping ${o.shippingMethod ? `<span style="font-size:12px;color:${COLORS.muted};">(${escapeHtml(o.shippingMethod)})</span>` : ''}</td><td style="text-align:right;color:${COLORS.body};padding:4px 0;">$${escapeHtml(o.shippingCost)}</td></tr>
  ${tipRow}
  <tr><td style="color:${COLORS.heading};font-weight:700;font-size:16px;padding:10px 0;border-top:1px solid rgba(192,192,210,0.2);">Total</td><td style="text-align:right;color:${COLORS.heading};font-weight:700;font-size:16px;padding:10px 0;border-top:1px solid rgba(192,192,210,0.2);">$${escapeHtml(o.total)}</td></tr>
</table>

<div style="margin-top:18px;padding:12px 14px;background:rgba(230,115,92,0.12);border:1px solid rgba(230,115,92,0.3);border-radius:12px;color:#f0b8a8;font-size:13px;line-height:1.5;">
  Venmo payment due by <strong>${escapeHtml(fmtDeadline(o.paymentDeadline))}</strong>. Unpaid orders auto-cancel after 24 hours.
</div>

<p style="margin:18px 0 0;line-height:1.5;color:${COLORS.body};font-size:14px;"><strong>Ship to:</strong> ${escapeHtml(o.address1 || '')}${o.address2 ? `, ${escapeHtml(o.address2)}` : ''}, ${escapeHtml(o.city || '')}${o.state ? `, ${escapeHtml(o.state)}` : ''}${o.zip ? ` ${escapeHtml(o.zip)}` : ''}</p>
${billingBlock}
${goodreadsBlock}
${raffleBlock}
${orderNotesBlock}`

  return wrapEmail(content, `This order was placed at ${SITE_NAME}.`)
}

export function renderOrderEmailText(o: OrderData): string {
  return renderOrderSummaryText(o)
}

export function renderOrderSummaryText(o: OrderData): string {
  const lines: string[] = []
  lines.push(`New custom order from ${o.customerName || 'unknown'} <${o.email}>`)
  lines.push('')
  for (const item of o.cart || []) {
    const label = item.bundleLabel || item.bundleId || 'Item'
    const qty = item.qty || 1
    const price = typeof item.price === 'number' ? item.price : 0
    lines.push(`- ${label} × ${qty} — $${(price * qty).toFixed(2)}`)
    const meta = [item.theme, item.color].filter(Boolean).join(' · ')
    if (meta) lines.push(`  ${meta}`)
    if (item.notes) lines.push(`  Note: ${item.notes}`)
  }
  lines.push('')
  lines.push(`Subtotal:  $${o.subtotal}`)
  lines.push(`Shipping:  $${o.shippingCost}${o.shippingMethod ? ` (${o.shippingMethod})` : ''}`)
  const tipVal = parseFloat(o.tip || '0')
  if (tipVal > 0) lines.push(`Tip:       $${o.tip}`)
  lines.push(`Total:     $${o.total}`)
  lines.push('')
  const addrParts = [o.address1, o.address2, o.city, o.state].filter(Boolean)
  lines.push(`Ship to: ${addrParts.join(', ')}${o.zip ? ` ${o.zip}` : ''}`)
  if (hasSeparateBilling(o)) {
    const billParts = [o.billingAddress1, o.billingAddress2, o.billingCity, o.billingState].filter(Boolean)
    lines.push(`Bill to: ${billParts.join(', ')}${o.billingZip ? ` ${o.billingZip}` : ''}`)
  }
  lines.push(`Venmo deadline: ${fmtDeadline(o.paymentDeadline)}`)
  if (o.goodreadsUrl) {
    lines.push(`Goodreads: ${o.goodreadsUrl}`)
  }
  if (o.raffleTickets && o.raffleTickets.length) {
    lines.push(`Raffle ticket${o.raffleTickets.length > 1 ? 's' : ''} (Kindle Book Box): ${o.raffleTickets.join(', ')}`)
  }
  if (o.orderNotes) {
    lines.push('')
    lines.push(`Notes: ${o.orderNotes}`)
  }
  return lines.join('\n')
}

export const SAMPLE_ORDER: OrderData = {
  customerName: 'Sample Customer',
  email: 'sample@example.com',
  address1: '123 Main St',
  address2: 'Apt 4B',
  city: 'Portland',
  state: 'California',
  shippingMethod: 'USPS Ground Advantage (Zone 3, 2 lb)',
  subtotal: '40.00',
  shippingCost: '12.05',
  total: '52.05',
  paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  orderNotes: 'This is a sample test order — please ignore.',
  cart: [
    {
      bundleId: 'cozy',
      bundleLabel: 'The Cozy Date',
      price: 15,
      qty: 1,
      theme: 'romance',
      color: 'pink',
      notes: 'Loves small-town vibes, no horror please.',
    },
    {
      bundleId: 'deluxe',
      bundleLabel: 'The Deluxe Date',
      price: 25,
      qty: 1,
      theme: 'thriller',
      color: 'black',
      notes: '',
    },
  ],
}
