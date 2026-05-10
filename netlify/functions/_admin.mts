import { getUser } from '@netlify/identity'

const OWNER_EMAIL = (Netlify.env.get('OWNER_EMAIL') || 'ogmegbeast@gmail.com').toLowerCase()

const ADMIN_EMAILS: Set<string> = new Set(
  [OWNER_EMAIL, 'nichole_avery@yahoo.com'].map((e) => e.toLowerCase()),
)

export interface AdminUser {
  id: string
  email: string
}

export async function requireAdmin(): Promise<AdminUser | Response> {
  const user = await getUser().catch(() => null)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const email = (user.email || '').toLowerCase()
  const isAdmin = !!email && ADMIN_EMAILS.has(email)
  if (!isAdmin) return new Response('Forbidden', { status: 403 })

  return { id: user.id, email: user.email || '' }
}
