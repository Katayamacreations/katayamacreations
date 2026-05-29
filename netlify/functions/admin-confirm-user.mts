import type { Context } from '@netlify/functions'
import { admin } from '@netlify/identity'
import { requireAdmin } from './_admin.mjs'

// Lets an admin confirm a customer's account directly from the admin user page, without
// waiting for the customer to click the link in their confirmation email.
//
// "Confirmed" has two server-side meanings on this site (see _verification.mts):
//   1. GoTrue's own `confirmed_at` — gates *sign-in*.
//   2. The `app_metadata.email_verified` flag — the single source of truth for "may place
//      an order", normally flipped true only when the customer clicks the emailed link.
// Confirming on the admin's behalf should grant both, so the account can sign in *and*
// order immediately. This sets `confirm: true` (GoTrue) and pins `email_verified: true`
// onto the existing app_metadata so roles and other server fields are preserved.
export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const guard = await requireAdmin()
  if (guard instanceof Response) return guard

  let body: { userId?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const userId = (body.userId || '').trim()
  if (!userId) {
    return new Response('userId is required', { status: 400 })
  }

  let targetUser
  try {
    targetUser = await admin.getUser(userId)
  } catch {
    return new Response('User not found', { status: 404 })
  }

  const existing = (targetUser.appMetadata || {}) as Record<string, unknown>

  try {
    await admin.updateUser(userId, {
      confirm: true,
      app_metadata: { ...existing, email_verified: true },
    })
  } catch (err) {
    console.error('admin-confirm-user: updateUser failed', err)
    return new Response('Failed to confirm user', { status: 502 })
  }

  return Response.json({ ok: true, userId, confirmed: true, verified: true })
}
