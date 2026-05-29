import type { Context } from '@netlify/functions'
import { admin, getIdentityConfig } from '@netlify/identity'
import { requireAdmin } from './_admin.mjs'

// Netlify Identity (GoTrue) has no dedicated "resend confirmation" admin endpoint.
// The supported way to re-send the real "Confirm your email" template to an account
// that has never confirmed is to POST to the public `/signup` endpoint again with that
// email. For an existing *unconfirmed* user GoTrue re-issues the confirmation email
// rather than creating a duplicate. A password is required by the endpoint; since an
// unconfirmed account cannot be logged into anyway (login is blocked until confirmation,
// and clicking the confirmation link signs the user straight in), we send a throwaway
// random value here and never store it.

function randomPassword(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 })
  }

  const guard = await requireAdmin()
  if (guard instanceof Response) return guard

  const config = getIdentityConfig()
  if (!config?.url) {
    return Response.json({ ok: false, error: 'Identity is not configured for this site.' }, { status: 500 })
  }

  // Gather every user across all pages so no unconfirmed account is missed.
  const users: Awaited<ReturnType<typeof admin.listUsers>> = []
  try {
    const perPage = 200
    for (let page = 1; page <= 50; page++) {
      const batch = await admin.listUsers({ page, perPage })
      if (!batch || batch.length === 0) break
      users.push(...batch)
      if (batch.length < perPage) break
    }
  } catch (err) {
    console.error('admin-resend-confirmations: listUsers failed', err)
    const message = err instanceof Error ? err.message : 'Identity admin request failed'
    return new Response(message, { status: 502 })
  }

  const unconfirmed = users.filter((u) => !u.confirmedAt && !!u.email)

  if (unconfirmed.length === 0) {
    return Response.json({ ok: true, total: users.length, unconfirmed: 0, sent: 0, failed: 0, errors: [] })
  }

  const signupUrl = `${config.url.replace(/\/$/, '')}/signup`
  let sent = 0
  let failed = 0
  const errors: string[] = []

  // Send sequentially to stay friendly to GoTrue's mailer rate limits.
  for (const user of unconfirmed) {
    const email = user.email as string
    try {
      const res = await fetch(signupUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: randomPassword() }),
      })
      if (res.ok) {
        sent++
      } else {
        failed++
        const detail = await res.text().catch(() => '')
        errors.push(`${email}: ${res.status} ${detail.slice(0, 160)}`.trim())
      }
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${email}: ${msg}`)
    }
  }

  return Response.json({
    ok: failed === 0,
    total: users.length,
    unconfirmed: unconfirmed.length,
    sent,
    failed,
    errors: errors.slice(0, 25),
  })
}
