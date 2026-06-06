import { wrapEmail, escapeHtml, SITE_NAME, COLORS, siteUrl } from './_email-brand.mjs'

export interface ReviewData {
  userName: string
  userEmail: string
  orderId: string
  rating: number
  reviewText: string
  imageCount?: number
}

function stars(rating: number): string {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  let out = '★'.repeat(full)
  if (half) out += '½'
  return out || '—'
}

export function renderReviewEmailHtml(r: ReviewData): string {
  const ratingLine = `${stars(r.rating)} <span style="color:${COLORS.muted};">(${escapeHtml(String(r.rating))} / 5)</span>`
  const photosBlock = r.imageCount && r.imageCount > 0
    ? `<p style="margin:8px 0 0;color:${COLORS.muted};font-size:13px;">${r.imageCount} photo${r.imageCount > 1 ? 's' : ''} attached.</p>`
    : ''
  const textBlock = r.reviewText
    ? `<div style="margin-top:16px;padding:14px 16px;background:rgba(184,224,194,0.08);border:1px solid ${COLORS.border};border-radius:12px;color:${COLORS.body};line-height:1.6;font-size:15px;">${escapeHtml(r.reviewText)}</div>`
    : `<p style="margin:16px 0 0;color:${COLORS.muted};font-size:14px;">No written comment was left.</p>`

  const content = `<h1 style="margin:0 0 8px;font-size:22px;color:${COLORS.heading};">New customer review</h1>
<p style="margin:0 0 20px;color:#b8b3c8;font-size:14px;">From <strong>${escapeHtml(r.userName || 'A customer')}</strong>${r.userEmail ? ` — <a href="mailto:${escapeHtml(r.userEmail)}" style="color:${COLORS.link};">${escapeHtml(r.userEmail)}</a>` : ''}</p>

<p style="margin:0 0 4px;font-size:20px;color:#f5d76e;">${ratingLine}</p>
<p style="margin:0;color:${COLORS.muted};font-size:13px;">Order ${escapeHtml(r.orderId)}</p>
${textBlock}
${photosBlock}`

  return wrapEmail(content, `This review was submitted at ${SITE_NAME}.`)
}

export function renderReviewEmailText(r: ReviewData): string {
  const lines: string[] = []
  lines.push(`New customer review from ${r.userName || 'A customer'}${r.userEmail ? ` <${r.userEmail}>` : ''}`)
  lines.push('')
  lines.push(`Rating: ${r.rating} / 5`)
  lines.push(`Order:  ${r.orderId}`)
  lines.push('')
  lines.push(r.reviewText ? r.reviewText : '(No written comment was left.)')
  if (r.imageCount && r.imageCount > 0) {
    lines.push('')
    lines.push(`${r.imageCount} photo${r.imageCount > 1 ? 's' : ''} attached.`)
  }
  lines.push('')
  lines.push(`— ${SITE_NAME} (${siteUrl()})`)
  return lines.join('\n')
}
