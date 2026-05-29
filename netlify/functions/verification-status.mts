import type { Context } from '@netlify/functions'
import { admin, getUser } from '@netlify/identity'
import { isEmailVerified } from './_verification.mjs'

// Authenticated endpoint that reports the signed-in user's *fresh* verification state.
// Client pages use it instead of the JWT claims because the `email_verified` flag can be
// flipped (by clicking the confirmation link) after the current token was issued, and the
// token would otherwise stay stale until it next refreshes.
export default async (_req: Request, _context: Context) => {
  const user = await getUser().catch(() => null)
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Read the latest record via the admin API so a just-confirmed user isn't told they're
  // still unverified because their cookie token predates the change.
  let fresh: { confirmedAt?: string; appMetadata?: Record<string, unknown> } = user
  try {
    fresh = await admin.getUser(user.id)
  } catch {
    /* fall back to the session user */
  }

  const verified = isEmailVerified(fresh)
  return Response.json({ verified, email: user.email || '' })
}
