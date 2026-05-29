import type { Context } from '@netlify/functions'
import { admin } from '@netlify/identity'

// Public endpoint that force-confirms an account in GoTrue so it can sign in — even before the
// customer has clicked the email-confirmation link we send.
//
// Background: Netlify Identity (GoTrue) refuses the password login of any account whose email it
// considers unconfirmed, returning "invalid_grant: Email not confirmed", unless the project's
// "Autoconfirm" setting is turned on. Autoconfirm is a dashboard toggle that cannot be set from
// code, so the site can't depend on it being on. To let customers sign in regardless of that
// toggle, the login flow calls this endpoint whenever GoTrue rejects a login as unconfirmed, then
// retries the login.
//
// Crucially, this only flips GoTrue's own confirmation state — which, by design, now gates nothing
// but sign-in. It never sets our `app_metadata.email_verified` flag, which remains the single
// source of truth for "may place an order" and is turned true only when the customer clicks the
// link we email them. So that a force-confirmed account can't slip past the order gate via the
// legacy "confirmed_at implies verified" fallback, this pins `email_verified` to its current value
// (false unless already true) at the same time it confirms.
//
// Signing in still requires the correct password, so force-confirming an arbitrary email grants no
// access on its own. The endpoint always responds 200 so the caller can simply retry the login.
const MAX_PAGES = 25
const PER_PAGE = 100

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let email = ''
  try {
    const body = (await req.json()) as { email?: string }
    email = (body.email || '').trim().toLowerCase()
  } catch {
    email = ''
  }
  if (!email) {
    return Response.json({ ok: true })
  }

  try {
    const user = await findUserByEmail(email)
    // Only act on an account that GoTrue still considers unconfirmed; a confirmed account
    // already signs in fine and needs no change.
    if (user && !user.confirmedAt) {
      const existing = (user.appMetadata || {}) as Record<string, unknown>
      const keepVerified = existing.email_verified === true
      await admin.updateUser(user.id, {
        confirm: true,
        app_metadata: { ...existing, email_verified: keepVerified },
      })
    }
  } catch (err) {
    // Swallow: the caller retries the login regardless, and a genuine failure just surfaces as
    // the original "please confirm your email" message rather than breaking the page.
    console.error('confirm-for-login failed', err)
  }

  return Response.json({ ok: true })
}

// GoTrue's admin API has no server-side email filter, so scan the paginated user list. The store
// is small for this site; cap the scan so a runaway never hangs the request.
async function findUserByEmail(email: string) {
  for (let page = 1; page <= MAX_PAGES; page++) {
    const users = await admin.listUsers({ page, perPage: PER_PAGE })
    if (!users.length) break
    const match = users.find((u) => (u.email || '').toLowerCase() === email)
    if (match) return match
    if (users.length < PER_PAGE) break
  }
  return null
}
