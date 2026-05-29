import type { Context } from '@netlify/functions'
import { admin } from '@netlify/identity'
import { consumeConfirmationToken } from './_verification.mjs'

// Public endpoint hit from the link in the confirmation email. It validates the one-time
// token, flips the account's server-controlled `email_verified` flag through the Identity
// admin API, and redirects the visitor back to the orders page with a friendly banner.
// No session is required — the link may be opened in a different browser than the one the
// customer signed up in.
export default async (req: Request, _context: Context) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token') || ''

  const record = await consumeConfirmationToken(token)
  if (!record) {
    return Response.redirect(`${url.origin}/orders.html?confirmed=expired`, 303)
  }

  try {
    // Merge onto the existing app_metadata so roles and other server fields are preserved.
    let existing: Record<string, unknown> = {}
    try {
      const current = await admin.getUser(record.userId)
      existing = (current.appMetadata || {}) as Record<string, unknown>
    } catch {
      existing = {}
    }
    await admin.updateUser(record.userId, {
      app_metadata: { ...existing, email_verified: true },
    })
  } catch (err) {
    console.error('confirm-email: failed to mark verified', err)
    return Response.redirect(`${url.origin}/orders.html?confirmed=error`, 303)
  }

  return Response.redirect(`${url.origin}/orders.html?confirmed=1`, 303)
}
