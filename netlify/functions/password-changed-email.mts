import { getUser } from '@netlify/identity'
import type { Context } from '@netlify/functions'

const FROM_EMAIL = Netlify.env.get('WELCOME_FROM_EMAIL') || 'Katayama Creations <onboarding@resend.dev>'
const OWNER_EMAIL = Netlify.env.get('OWNER_EMAIL') || 'ogmegbeast@gmail.com'

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
        subject: 'Your password has been changed — Katayama Creations',
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

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderHtml(safeName: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#1a0f2e;font-family:Arial,sans-serif;color:#e8e3f0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1a0f2e;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:linear-gradient(160deg,#2d1b46 0%,#1e1232 100%);border:1px solid rgba(192,192,210,0.15);border-radius:16px;padding:32px;">
          <tr><td>
            <h1 style="margin:0 0 12px;font-size:24px;color:#e8e3f0;">Password changed</h1>
            <p style="margin:0 0 16px;line-height:1.5;color:#c0bcd0;">
              Hi ${safeName}, your Katayama Creations account password was just updated. If you made this change, no further action is needed.
            </p>
            <p style="margin:0 0 16px;line-height:1.5;color:#c0bcd0;">
              If you did <strong>not</strong> make this change, please reply to this email or contact us immediately at
              <a href="mailto:ogmegbeast@gmail.com" style="color:#b8e0c2;">ogmegbeast@gmail.com</a>.
            </p>
            <p style="margin:24px 0 0;font-size:12px;color:#8b87a0;">
              You're receiving this because a password change was made on your Katayama Creations account.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

function renderText(name: string) {
  return `Password changed

Hi ${name}, your Katayama Creations account password was just updated. If you made this change, no further action is needed.

If you did NOT make this change, please reply to this email or contact us immediately at ogmegbeast@gmail.com.`
}
