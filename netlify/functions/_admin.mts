import { getUser } from '@netlify/identity'

const OWNER_EMAIL = (Netlify.env.get('OWNER_EMAIL') || 'ogmegbeast@gmail.com').toLowerCase()

const ADMIN_EMAILS: Set<string> = new Set(
  [OWNER_EMAIL, 'nichole_avery@yahoo.com', 'katayamacreations@outlook.com'].map((e) => e.toLowerCase()),
)

// Recipients for operational alerts (new orders, customer messages, etc.). The shop owner
// plus the Katayama Creations admin inbox both get notified.
const ALERT_RECIPIENTS: string[] = Array.from(
  new Set([OWNER_EMAIL, 'katayamacreations@outlook.com']),
)

export { OWNER_EMAIL, ADMIN_EMAILS, ALERT_RECIPIENTS }

export interface AdminUser {
  id: string
  email: string
}

export async function requireAdmin(): Promise<AdminUser | Response> {
  const user = await getUser().catch(() => null)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const email = (user.email || '').toLowerCase()
  const hasAdminRole = Array.isArray(user.roles) && user.roles.includes('admin')
  const isAdmin = (!!email && ADMIN_EMAILS.has(email)) || hasAdminRole
  if (!isAdmin) return new Response('Forbidden', { status: 403 })

  return { id: user.id, email: user.email || '' }
}
