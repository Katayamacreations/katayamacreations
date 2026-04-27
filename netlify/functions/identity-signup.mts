import type { Handler, HandlerEvent } from '@netlify/functions'

interface IdentityUser {
  email?: string
  user_metadata?: Record<string, string>
  app_metadata?: Record<string, unknown>
}

const FROM_EMAIL = process.env.WELCOME_FROM_EMAIL || 'Katayama Creations <onboarding@resend.dev>'
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'ogmegbeast@gmail.com'

const handler: Handler = async (event: HandlerEvent) => {
  let payload: { user?: IdentityUser } = {}
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 200, body: '{}' }
  }

  const user = payload.user
  const apiKey = process.env.RESEND_API_KEY
  if (apiKey && user?.email) {
    const meta = user.user_metadata || {}
    const name =
      (meta.full_name && String(meta.full_name)) ||
      [meta.firstName, meta.lastName].filter(Boolean).join(' ').trim() ||
      'friend'

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [user.email],
          reply_to: OWNER_EMAIL,
          subject: 'Welcome to Katayama Creations',
          html: renderWelcomeEmail({ name }),
          text: renderWelcomeText({ name }),
        }),
      })
    } catch (err) {
      console.error('Welcome email failed', err)
    }
  }

  const existingRoles = Array.isArray((user?.app_metadata as Record<string, unknown> | undefined)?.roles)
    ? ((user?.app_metadata as Record<string, unknown>).roles as string[])
    : []
  const isOwner = (user?.email || '').toLowerCase() === OWNER_EMAIL.toLowerCase()
  const baseRoles = isOwner ? existingRoles : existingRoles.filter((r) => r !== 'admin')
  const roles = Array.from(new Set([...baseRoles, 'customer', ...(isOwner ? ['admin'] : [])]))

  return {
    statusCode: 200,
    body: JSON.stringify({
      app_metadata: {
        ...(user?.app_metadata || {}),
        roles,
      },
    }),
  }
}

export { handler }

function renderWelcomeEmail({ name }: { name: string }) {
  const safeName = escapeHtml(name)
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#1a0f2e;font-family:Arial,sans-serif;color:#e8e3f0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1a0f2e;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:linear-gradient(160deg,#2d1b46 0%,#1e1232 100%);border:1px solid rgba(192,192,210,0.15);border-radius:16px;padding:32px;">
          <tr><td>
            <h1 style="margin:0 0 12px;font-size:24px;color:#e8e3f0;">Welcome, ${safeName}!</h1>
            <p style="margin:0 0 16px;line-height:1.5;color:#c0bcd0;">
              Thanks for signing up with Katayama Creations. Your account is ready — you can log in any time to place a new order, re-order a past favorite, or check the status of your existing orders.
            </p>
            <p style="margin:0 0 16px;line-height:1.5;color:#c0bcd0;">
              Questions? Just reply to this email or reach out at
              <a href="mailto:ogmegbeast@gmail.com" style="color:#b8e0c2;">ogmegbeast@gmail.com</a>.
            </p>
            <p style="margin:24px 0 0;font-size:12px;color:#8b87a0;">
              You're receiving this because you signed up at katayamacreations. If this wasn't you, you can ignore this email.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

function renderWelcomeText({ name }: { name: string }) {
  return `Welcome, ${name}!

Thanks for signing up with Katayama Creations. Your account is ready — you can log in any time to place a new order, re-order a past favorite, or check the status of your existing orders.

Questions? Just reply to this email or reach out at ogmegbeast@gmail.com.

If this wasn't you, you can ignore this email.`
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
