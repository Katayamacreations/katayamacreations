import type { Handler, HandlerEvent } from '@netlify/functions'
import { wrapEmail, escapeHtml, SITE_NAME, OWNER_EMAIL, COLORS } from './_email-brand.mjs'
import { sendEmail } from './_send-email.mjs'
import { db } from '../../db/index.js'
import { notifications } from '../../db/schema.js'

interface IdentityUser {
  email?: string
  user_metadata?: Record<string, string>
  app_metadata?: Record<string, unknown>
}

const ADMIN_EMAILS: Set<string> = new Set(
  [OWNER_EMAIL, 'nichole_avery@yahoo.com', 'katayamacreations@outlook.com'].map((e) => e.toLowerCase()),
)

// Netlify Identity invokes this signup webhook synchronously: GoTrue holds the signup
// open until the function responds, and only then dispatches the "Confirm your email"
// message. If the response is slow, GoTrue's webhook call times out and the whole signup
// fails with "Failed to handle signup webhook". The only field GoTrue consumes is the
// computed roles, so we return that immediately. The welcome email and the new-signup
// notification are best-effort side effects — they run detached and must never gate or
// fail the response.
//
// Each detached task carries its own timeout so it can't dangle indefinitely on a warm
// container. We intentionally do NOT await them: blocking the webhook on a Resend round
// trip or a DB insert is exactly what was timing the signup out.
const SIDE_EFFECT_TIMEOUT_MS = 2500

const handler: Handler = async (event: HandlerEvent) => {
  let payload: { user?: IdentityUser } = {}
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 200, body: '{}' }
  }

  const user = payload.user

  const existingRoles = Array.isArray((user?.app_metadata as Record<string, unknown> | undefined)?.roles)
    ? ((user?.app_metadata as Record<string, unknown>).roles as string[])
    : []
  const isAdmin = ADMIN_EMAILS.has((user?.email || '').toLowerCase())
  const baseRoles = isAdmin ? existingRoles : existingRoles.filter((r) => r !== 'admin')
  const roles = Array.from(new Set([...baseRoles, 'customer', ...(isAdmin ? ['admin'] : [])]))

  const responseBody = JSON.stringify({
    app_metadata: {
      ...(user?.app_metadata || {}),
      roles,
    },
  })

  // Kick off the best-effort work without awaiting it. Each task swallows its own errors,
  // so this can never reject and never delays the response GoTrue is waiting on.
  void Promise.allSettled([sendWelcomeEmail(user), recordSignupNotification(user)])

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: responseBody,
  }
}

export { handler }

async function sendWelcomeEmail(user?: IdentityUser): Promise<void> {
  if (!user?.email) return

  const meta = user.user_metadata || {}
  const name =
    (meta.full_name && String(meta.full_name)) ||
    [meta.firstName, meta.lastName].filter(Boolean).join(' ').trim() ||
    'friend'

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SIDE_EFFECT_TIMEOUT_MS)
  try {
    await sendEmail({
      to: user.email,
      replyTo: OWNER_EMAIL,
      subject: `Welcome to ${SITE_NAME}`,
      html: renderWelcomeEmail({ name }),
      text: renderWelcomeText({ name }),
      signal: controller.signal,
    })
  } catch (err) {
    console.error('Welcome email failed', err)
  } finally {
    clearTimeout(timer)
  }
}

async function recordSignupNotification(user?: IdentityUser): Promise<void> {
  try {
    const meta = user?.user_metadata || {}
    const displayName =
      (meta.full_name && String(meta.full_name)) ||
      [meta.firstName, meta.lastName].filter(Boolean).join(' ').trim() ||
      user?.email || 'Someone'
    await db.insert(notifications).values({
      type: 'signup',
      title: 'New sign-up',
      body: `${displayName} (${user?.email || 'unknown'}) just signed up`,
      relatedId: '',
    })
  } catch (err) {
    console.error('Signup notification failed', err)
  }
}

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
