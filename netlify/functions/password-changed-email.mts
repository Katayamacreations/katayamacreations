import { getUser } from '@netlify/identity'
import type { Context } from '@netlify/functions'
import { wrapEmail, escapeHtml, SITE_NAME, OWNER_EMAIL, COLORS } from './_email-brand.mjs'

const FROM_EMAIL = Netlify.env.get('WELCOME_FROM_EMAIL') || `${SITE_NAME} <onboarding@resend.dev>`

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const user = await getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const apiKey = Netlify.env.get('RESEND_API_KEY')
  if (!apiKey) {
    return Response.json({ ok: true, sent: false })
  }

  const name =
    user.name ||
    (user.userMetadata as Record<string, string> | undefined)?.full_name ||
    'there'
  const safeName = escapeHtml(name)

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [user.email],
        reply_to: OWNER_EMAIL,
        subject: `Your password has been changed — ${SITE_NAME}`,
        html: renderHtml(safeName),
        text: renderText(name),
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`Resend API error ${res.status}:`, body)
      return Response.json({ ok: false, sent: false, error: 'Email service error' }, { status: 502 })
    }
  } catch (err) {
    console.error('Password-changed email failed', err)
    return Response.json({ ok: false, sent: false, error: 'Email send failed' }, { status: 502 })
  }

  return Response.json({ ok: true, sent: true })
}

function renderHtml(safeName: string) {
  return wrapEmail(
    `<h1 style="margin:0 0 12px;font-size:24px;color:${COLORS.heading};">Password changed</h1>
<p style="margin:0 0 16px;line-height:1.6;color:${COLORS.body};">
  Hi ${safeName}, your ${SITE_NAME} account password was just updated. If you made this change, no further action is needed.
</p>
<p style="margin:0 0 16px;line-height:1.6;color:${COLORS.body};">
  If you did <strong>not</strong> make this change, please reply to this email or contact us immediately at
  <a href="mailto:${OWNER_EMAIL}" style="color:${COLORS.link};">${OWNER_EMAIL}</a>.
</p>`,
    `You're receiving this because a password change was made on your ${SITE_NAME} account.`,
    `Your ${SITE_NAME} password was just updated. If this wasn't you, contact us immediately.`,
  )
}

function renderText(name: string) {
  return `Password changed

Hi ${name}, your ${SITE_NAME} account password was just updated. If you made this change, no further action is needed.

If you did NOT make this change, please reply to this email or contact us immediately at ${OWNER_EMAIL}.`
}
