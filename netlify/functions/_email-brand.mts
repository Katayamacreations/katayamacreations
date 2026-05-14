const SITE_NAME = 'Katayama Creations'
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'ogmegbeast@gmail.com'

const COLORS = {
  bg: '#1a0f2e',
  cardStart: '#2d1b46',
  cardEnd: '#1e1232',
  heading: '#e8e3f0',
  body: '#c0bcd0',
  muted: '#8b87a0',
  link: '#b8e0c2',
  border: 'rgba(192,192,210,0.15)',
  btnStart: '#4a2d75',
  btnEnd: '#6b48a6',
} as const

export function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function siteUrl() {
  return (process.env.URL || 'https://katayamacreations.netlify.app').replace(/\/$/, '')
}

function logoImg() {
  const url = `${siteUrl()}/assets/katayama-banner-new.png`
  return `<img src="${url}" alt="${SITE_NAME}" width="280" style="display:block;max-width:280px;width:100%;height:auto;margin:0 auto 20px;" />`
}

function header() {
  return `${logoImg()}`
}

function footer(reason: string) {
  return `<p style="margin:24px 0 0;font-size:12px;color:${COLORS.muted};line-height:1.5;">
  ${reason}<br>
  <a href="${siteUrl()}" style="color:${COLORS.muted};text-decoration:underline;">${SITE_NAME}</a>
</p>`
}

export function wrapEmail(content: string, footerReason: string, preheader?: string): string {
  const preheaderHtml = preheader
    ? `<div style="display:none;font-size:1px;color:#1a0f2e;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>`
    : ''
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"></head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:Arial,Helvetica,sans-serif;color:${COLORS.heading};-webkit-font-smoothing:antialiased;">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:linear-gradient(160deg,${COLORS.cardStart} 0%,${COLORS.cardEnd} 100%);border:1px solid ${COLORS.border};border-radius:16px;padding:32px;">
        <tr><td>
          ${header()}
          ${content}
          ${footer(footerReason)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function ctaButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td align="center" style="background:linear-gradient(135deg,${COLORS.btnStart} 0%,${COLORS.btnEnd} 100%);border-radius:10px;border:1px solid rgba(192,192,210,0.3);box-shadow:0 4px 12px rgba(0,0,0,0.3);">
    <a href="${href}" target="_blank" style="display:inline-block;padding:12px 28px;color:${COLORS.heading};text-decoration:none;font-weight:bold;font-size:14px;">${label}</a>
  </td></tr>
</table>`
}

export { SITE_NAME, OWNER_EMAIL, COLORS, siteUrl }
