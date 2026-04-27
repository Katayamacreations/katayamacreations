import type { Context } from '@netlify/functions'
import { requireAdmin } from './_admin.mjs'

interface IdentityUser {
  id?: string
  email?: string
  confirmed_at?: string
  created_at?: string
  user_metadata?: Record<string, unknown>
  app_metadata?: Record<string, unknown>
}

export default async (req: Request, _context: Context) => {
  const guard = await requireAdmin()
  if (guard instanceof Response) return guard

  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return new Response('Missing bearer token', { status: 401 })
  }

  const siteUrl = (Netlify.env.get('URL') || '').replace(/\/+$/, '')
  if (!siteUrl) {
    return new Response('Site URL is not configured', { status: 500 })
  }

  const adminUrl = `${siteUrl}/.netlify/identity/admin/users?per_page=200`
  let res: Response
  try {
    res = await fetch(adminUrl, {
      headers: { Authorization: authHeader },
    })
  } catch (err) {
    console.error('Identity admin fetch failed', err)
    return new Response('Identity service unreachable', { status: 502 })
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return new Response(text || `Identity admin returned ${res.status}`, { status: res.status })
  }

  const data = (await res.json()) as { users?: IdentityUser[] }
  const users = Array.isArray(data.users) ? data.users : []

  const summarized = users.map((u) => {
    const meta = (u.user_metadata || {}) as Record<string, unknown>
    const fullName =
      (typeof meta.full_name === 'string' && meta.full_name) ||
      [meta.firstName, meta.lastName].filter(Boolean).join(' ').trim() ||
      ''
    const roles = Array.isArray((u.app_metadata || {}).roles)
      ? ((u.app_metadata as Record<string, unknown>).roles as string[])
      : []
    return {
      id: u.id || '',
      email: u.email || '',
      fullName,
      confirmed: !!u.confirmed_at,
      createdAt: u.created_at || '',
      roles,
    }
  })

  return Response.json({ users: summarized })
}
