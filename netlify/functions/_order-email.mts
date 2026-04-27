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
  state: string
  zip?: string
  shippingMethod: string
  subtotal: string
  shippingCost: string
  total: string
  paymentDeadline: string
  orderNotes: string
  cart: CartItem[]
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
        <td style="padding:10px 0;border-bottom:1px solid rgba(192,192,210,0.15);">
          <div style="font-weight:700;color:#e8e3f0;">${label} × ${qty}</div>
          ${metaRow}
          ${notes}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid rgba(192,192,210,0.15);text-align:right;color:#e8e3f0;white-space:nowrap;">$${line}</td>
      </tr>`
  }).join('')

  const orderNotesBlock = o.orderNotes
    ? `<p style="margin:16px 0 0;line-height:1.5;color:#c0bcd0;"><strong>Notes:</strong> ${escapeHtml(o.orderNotes)}</p>`
    : ''

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#1a0f2e;font-family:Arial,sans-serif;color:#e8e3f0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1a0f2e;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:linear-gradient(160deg,#2d1b46 0%,#1e1232 100%);border:1px solid rgba(192,192,210,0.15);border-radius:16px;padding:32px;">
          <tr><td>
            <h1 style="margin:0 0 8px;font-size:22px;color:#e8e3f0;">New custom order</h1>
            <p style="margin:0 0 20px;color:#b8b3c8;font-size:14px;">From <strong>${escapeHtml(o.customerName || 'unknown')}</strong> — <a href="mailto:${escapeHtml(o.email)}" style="color:#b8e0c2;">${escapeHtml(o.email)}</a></p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              ${rows}
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
              <tr><td style="color:#c0bcd0;padding:4px 0;">Subtotal</td><td style="text-align:right;color:#c0bcd0;padding:4px 0;">$${escapeHtml(o.subtotal)}</td></tr>
              <tr><td style="color:#c0bcd0;padding:4px 0;">Shipping ${o.shippingMethod ? `<span style=\"font-size:12px;color:#8b87a0;\">(${escapeHtml(o.shippingMethod)})</span>` : ''}</td><td style="text-align:right;color:#c0bcd0;padding:4px 0;">$${escapeHtml(o.shippingCost)}</td></tr>
              <tr><td style="color:#e8e3f0;font-weight:700;font-size:16px;padding:10px 0;border-top:1px solid rgba(192,192,210,0.2);">Total</td><td style="text-align:right;color:#e8e3f0;font-weight:700;font-size:16px;padding:10px 0;border-top:1px solid rgba(192,192,210,0.2);">$${escapeHtml(o.total)}</td></tr>
            </table>

            <div style="margin-top:18px;padding:12px 14px;background:rgba(230,115,92,0.12);border:1px solid rgba(230,115,92,0.3);border-radius:12px;color:#f0b8a8;font-size:13px;line-height:1.5;">
              ⏳ Venmo payment due by <strong>${escapeHtml(fmtDeadline(o.paymentDeadline))}</strong>. Unpaid orders auto-cancel after 24 hours.
            </div>

            <p style="margin:18px 0 0;line-height:1.5;color:#c0bcd0;font-size:14px;"><strong>Ship to:</strong> ${escapeHtml(o.state || '—')}${o.zip ? ` ${escapeHtml(o.zip)}` : ''}</p>
            ${orderNotesBlock}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

export function renderOrderEmailText(o: OrderData): string {
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
  lines.push(`Total:     $${o.total}`)
  lines.push('')
  lines.push(`Ship to: ${o.state || '—'}${o.zip ? ` ${o.zip}` : ''}`)
  lines.push(`Venmo deadline: ${fmtDeadline(o.paymentDeadline)}`)
  if (o.orderNotes) {
    lines.push('')
    lines.push(`Notes: ${o.orderNotes}`)
  }
  return lines.join('\n')
}

export const SAMPLE_ORDER: OrderData = {
  customerName: 'Sample Customer',
  email: 'sample@example.com',
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
