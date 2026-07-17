import type { Context } from '@netlify/functions'
import { admin } from '@netlify/identity'
import { requireAdmin, OWNER_EMAIL } from './_admin.mjs'
import { isEmailVerified } from './_verification.mjs'
import { db } from '../../db/index.js'
import { userCarts } from '../../db/schema.js'

export default async (_req: Request, _context: Context) => {
  const guard = await requireAdmin()
  if (guard instanceof Response) return guard

  let users
  try {
    users = await admin.listUsers({ perPage: 200 })
  } catch (err) {
    console.error('admin.listUsers failed', err)
    const message = err instanceof Error ? err.message : 'Identity admin request failed'
    return new Response(message, { status: 502 })
  }

  const carts = await db.select().from(userCarts)
  const cartsByUserId = new Map(carts.map((cart) => [cart.userId, cart]))

  const summarized = (users || []).map((u) => {
    const meta = (u.userMetadata || {}) as Record<string, unknown>
    const fullName =
      (typeof meta.full_name === 'string' && meta.full_name) ||
      [meta.firstName, meta.lastName].filter(Boolean).join(' ').trim() ||
      u.name ||
      ''
    const roles = Array.isArray(u.roles) ? u.roles : []
    const cart = u.id ? cartsByUserId.get(u.id) : undefined
    return {
      id: u.id || '',
      email: u.email || '',
      fullName,
      // The site owner can't be deleted; flag it so the admin UI can hide the action
      // without exposing the owner's address to the client.
      isOwner: (u.email || '').toLowerCase() === OWNER_EMAIL,
      confirmed: !!u.confirmedAt,
      // The real "has verified their email / may place an order" state, which can differ
      // from GoTrue's confirmedAt (an account may be force-confirmed for sign-in yet still
      // unverified). The admin UI keys its confirm action off this.
      verified: isEmailVerified({ confirmedAt: u.confirmedAt, appMetadata: u.appMetadata }),
      confirmationSentAt: u.confirmationSentAt || '',
      createdAt: u.createdAt || '',
      roles,
      cart: cart
        ? {
            itemCount: cart.itemCount,
            subtotal: Number(cart.subtotal),
            updatedAt: cart.updatedAt || '',
          }
        : null,
    }
  })

  return Response.json({ users: summarized })
}
