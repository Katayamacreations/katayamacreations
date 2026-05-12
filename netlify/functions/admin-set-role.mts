import type { Context } from '@netlify/functions'
import { admin } from '@netlify/identity'
import { requireAdmin, OWNER_EMAIL } from './_admin.mjs'

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const guard = await requireAdmin()
  if (guard instanceof Response) return guard

  let body: { userId?: string; action?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { userId, action } = body
  if (!userId || (action !== 'grant' && action !== 'revoke')) {
    return new Response('userId and action (grant|revoke) are required', { status: 400 })
  }

  let targetUser
  try {
    targetUser = await admin.getUser(userId)
  } catch {
    return new Response('User not found', { status: 404 })
  }

  const targetEmail = (targetUser.email || '').toLowerCase()
  if (action === 'revoke' && targetEmail === OWNER_EMAIL) {
    return new Response('Cannot remove admin from the site owner', { status: 403 })
  }

  const currentRoles = Array.isArray(targetUser.roles) ? targetUser.roles : []
  let newRoles: string[]

  if (action === 'grant') {
    newRoles = Array.from(new Set([...currentRoles, 'admin']))
  } else {
    newRoles = currentRoles.filter((r) => r !== 'admin')
  }

  try {
    await admin.updateUser(userId, {
      app_metadata: { roles: newRoles },
    })
  } catch (err) {
    console.error('admin.updateUser failed', err)
    return new Response('Failed to update user role', { status: 502 })
  }

  return Response.json({ ok: true, userId, roles: newRoles })
}
