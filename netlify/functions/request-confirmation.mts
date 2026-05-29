import type { Context } from '@netlify/functions'
import { getUser } from '@netlify/identity'
import { isEmailVerified, sendConfirmationEmail } from './_verification.mjs'
import { isEmailConfigured } from './_send-email.mjs'

// Authenticated endpoint that (re)sends the email-confirmation link to the signed-in user.
// Backs the "resend confirmation link" action on the orders page and the post-signup send.
export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const user = await getUser().catch(() => null)
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }
  if (!user.email) {
    return Response.json({ ok: false, error: 'Your account has no email on file.' }, { status: 400 })
  }

  // Nothing to do if they're already verified — report it so the UI can update.
  if (isEmailVerified(user)) {
    return Response.json({ ok: true, alreadyVerified: true })
  }

  if (!isEmailConfigured()) {
    return Response.json(
      { ok: false, error: 'Email is not configured on this site yet. Please contact us directly.' },
      { status: 503 },
    )
  }

  const meta = (user.userMetadata || {}) as Record<string, unknown>
  const name =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    [meta.firstName, meta.lastName].filter(Boolean).join(' ').trim() ||
    user.name ||
    ''

  const sent = await sendConfirmationEmail(user.id, user.email, name)
  if (!sent) {
    return Response.json(
      { ok: false, error: "We couldn't send the confirmation email just now. Please try again in a moment." },
      { status: 502 },
    )
  }

  return Response.json({ ok: true, email: user.email })
}
