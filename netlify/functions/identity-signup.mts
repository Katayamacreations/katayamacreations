import type { Handler, HandlerEvent } from '@netlify/functions'
import { wrapEmail, escapeHtml, SITE_NAME, OWNER_EMAIL, COLORS } from './_email-brand.mjs'

interface IdentityUser {
  email?: string
  user_metadata?: Record<string, string>
  app_metadata?: Record<string, unknown>
}

const FROM_EMAIL = Netlify.env.get('WELCOME_FROM_EMAIL') || `${SITE_NAME} <onboarding@resend.dev>`
const ADMIN_EMAILS: Set<string> = new Set(
  [OWNER_EMAIL, 'nichole_avery@yahoo.com'].map((e) => e.toLowerCase()),
)

const handler: Handler = async (event: HandlerEvent) => {
  let payload: { user?: IdentityUser } = {}
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 200, body: '{}' }
  }

  const user = payload.user
  const apiKey = Netlify.env.get('RESEND_API_KEY')
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
          subject: `Welcome to ${SITE_NAME}`,
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
  const isAdmin = ADMIN_EMAILS.has((user?.email || '').toLowerCase())
  const baseRoles = isAdmin ? existingRoles : existingRoles.filter((r) => r !== 'admin')
  const roles = Array.from(new Set([...baseRoles, 'customer', ...(isAdmin ? ['admin'] : [])]))

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
  return wrapEmail(
    `<h1 style="margin:0 0 12px;font-size:24px;color:${COLORS.heading};">Welcome, ${safeName}!</h1>
<p style="margin:0 0 16px;line-height:1.6;color:${COLORS.body};">
  Thanks for signing up with ${SITE_NAME}. Your account is ready &mdash; you can log in any time to place a new order, re-order a past favorite, or check the status of your existing orders.
</p>
<p style="margin:0 0 16px;line-height:1.6;color:${COLORS.body};">
  Questions? Just reply to this email or reach out at
  <a href="mailto:${OWNER_EMAIL}" style="color:${COLORS.link};">${OWNER_EMAIL}</a>.
</p>`,
    `You're receiving this because you signed up at ${SITE_NAME}. If this wasn't you, you can ignore this email.`,
    `Your ${SITE_NAME} account is ready — log in to place an order or browse curated reads.`,
  )
}

function renderWelcomeText({ name }: { name: string }) {
  return `Welcome, ${name}!

Thanks for signing up with ${SITE_NAME}. Your account is ready — you can log in any time to place a new order, re-order a past favorite, or check the status of your existing orders.

Questions? Just reply to this email or reach out at ${OWNER_EMAIL}.

If this wasn't you, you can ignore this email.`
}
