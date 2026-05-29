import type { Context } from '@netlify/functions'
import { admin } from '@netlify/identity'
import { requireAdmin } from './_admin.mjs'

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

  const summarized = (users || []).map((u) => {
    const meta = (u.userMetadata || {}) as Record<string, unknown>
    const fullName =
      (typeof meta.full_name === 'string' && meta.full_name) ||
      [meta.firstName, meta.lastName].filter(Boolean).join(' ').trim() ||
      u.name ||
      ''
    const roles = Array.isArray(u.roles) ? u.roles : []
    return {
      id: u.id || '',
      email: u.email || '',
      fullName,
      confirmed: !!u.confirmedAt,
      confirmationSentAt: u.confirmationSentAt || '',
      createdAt: u.createdAt || '',
      roles,
    }
  })

  return Response.json({ users: summarized })
}
