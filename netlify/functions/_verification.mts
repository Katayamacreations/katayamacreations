// Shared email-verification helpers.
//
// Background: Netlify Identity (GoTrue) blocks the password login of any account that has
// not confirmed its email unless the site's "Autoconfirm" setting is ON — and Autoconfirm
// is a dashboard toggle that can't be set from code. So the site no longer depends on it:
// the login flow force-confirms accounts in GoTrue on demand (see confirm-for-login) so
// anyone can sign in, and the *real* "has confirmed their email" state is tracked separately
// via a server-controlled `app_metadata.email_verified` flag.
//
// Because GoTrue's `confirmed_at` no longer means "the customer verified their email" (it gets
// set just to permit sign-in), the order gate keys off the `email_verified` flag alone. New
// accounts start with the flag explicitly false; clicking the confirmation link flips it true.
// `confirmed_at` is consulted only as a fallback for legacy accounts created before this flag
// existed, so previously-confirmed customers are never asked to re-verify.
//
// The confirmation link itself is a token we mint and store in Netlify Blobs; clicking it
// flips the flag through the Identity admin API.

import { getStore } from '@netlify/blobs'
import { wrapEmail, ctaButton, escapeHtml, siteUrl, SITE_NAME, OWNER_EMAIL } from './_email-brand.mjs'
import { sendEmail } from './_send-email.mjs'

const TOKEN_STORE = 'email-confirmations'
// Confirmation links stay valid for three days, matching a typical "confirm your email"
// grace period. Expired tokens are rejected and cleaned up on use.
const TOKEN_TTL_MS = 3 * 24 * 60 * 60 * 1000

export interface VerificationUser {
  confirmedAt?: string
  appMetadata?: Record<string, unknown>
}

interface StoredToken {
  userId: string
  email: string
  exp: number
}

// The single source of truth for "may this user place an order?". A user is verified exactly
// when the server-controlled `email_verified` flag is true. New accounts carry the flag
// explicitly (set false at signup, flipped true when they click the confirmation link), so the
// `confirmed_at` fallback below applies only to legacy accounts that predate the flag — keeping
// already-confirmed customers from being asked to re-verify, without letting a force-confirmed
// (but not email-verified) account through.
export function isEmailVerified(user: VerificationUser | null | undefined): boolean {
  if (!user) return false
  const flag = (user.appMetadata || {}).email_verified
  if (flag === true) return true
  if (flag === false) return false
  return !!user.confirmedAt
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function createConfirmationToken(userId: string, email: string): Promise<string> {
  const token = generateToken()
  const store = getStore(TOKEN_STORE)
  const payload: StoredToken = { userId, email, exp: Date.now() + TOKEN_TTL_MS }
  await store.setJSON(token, payload)
  return token
}

// Validates a token and, if valid, returns the account it belongs to. The token is
// single-use: it is deleted whether or not it had expired.
export async function consumeConfirmationToken(token: string): Promise<{ userId: string; email: string } | null> {
  if (!token) return null
  const store = getStore(TOKEN_STORE)
  let data: StoredToken | null = null
  try {
    data = (await store.get(token, { type: 'json' })) as StoredToken | null
  } catch {
    data = null
  }
  if (!data) return null
  await store.delete(token).catch(() => {})
  if (typeof data.exp !== 'number' || data.exp < Date.now()) return null
  return { userId: data.userId, email: data.email }
}

export function confirmUrl(token: string): string {
  return `${siteUrl()}/.netlify/functions/confirm-email?token=${encodeURIComponent(token)}`
}

// Mint a token for the given account and email them the branded confirmation link. Returns
// false (without throwing) when no email provider is configured or the send fails, so
// callers can surface a friendly message.
export async function sendConfirmationEmail(userId: string, email: string, name?: string): Promise<boolean> {
  if (!userId || !email) return false
  const token = await createConfirmationToken(userId, email)
  const link = confirmUrl(token)
  const res = await sendEmail({
    to: email,
    replyTo: OWNER_EMAIL,
    subject: `Confirm your email — ${SITE_NAME}`,
    html: renderConfirmationEmail({ name: name || '', link }),
    text: renderConfirmationText({ name: name || '', link }),
  })
  if (!res.ok) {
    console.error(`Confirmation email failed (${res.provider} ${res.status}): ${res.error || ''}`)
  }
  return res.ok
}

function renderConfirmationEmail({ name, link }: { name: string; link: string }): string {
  const safeName = escapeHtml(name) || 'there'
  return wrapEmail(
    `<h1 style="margin:0 0 12px;font-size:24px;color:#e8e3f0;">Confirm your email, ${safeName}</h1>
<p style="margin:0 0 16px;line-height:1.6;color:#c0bcd0;">
  Thanks for signing up with ${SITE_NAME}! You can browse and sign in right away, but before you
  can place an order we need to confirm this is really your email address.
</p>
<p style="margin:0 0 8px;line-height:1.6;color:#c0bcd0;">Just tap the button below:</p>
${ctaButton('Confirm my email', link)}
<p style="margin:16px 0 0;line-height:1.6;color:#8b87a0;font-size:13px;">
  If the button doesn't work, copy and paste this link into your browser:<br>
  <a href="${link}" style="color:#b8e0c2;word-break:break-all;">${link}</a>
</p>`,
    `You're receiving this because you signed up at ${SITE_NAME}. If this wasn't you, you can ignore this email.`,
    `Confirm your email to start placing orders with ${SITE_NAME}.`,
  )
}

function renderConfirmationText({ name, link }: { name: string; link: string }): string {
  return `Confirm your email, ${name || 'there'}

Thanks for signing up with ${SITE_NAME}! You can browse and sign in right away, but before you can place an order we need to confirm this is really your email address.

Confirm your email: ${link}

If this wasn't you, you can ignore this email.`
}
