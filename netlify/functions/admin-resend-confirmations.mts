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

interface ResendResult {
  email: string
  status: 'sent' | 'failed' | 'skipped'
  detail?: string
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

  // An optional `emails` array lets the admin resend to specific accounts only. When it is
  // absent (or empty) we fall back to the original behavior of resending to every
  // unconfirmed account at once.
  let requestedEmails: string[] | null = null
  try {
    const body = await req.json().catch(() => ({}))
    if (body && Array.isArray(body.emails)) {
      const cleaned = body.emails
        .filter((e: unknown): e is string => typeof e === 'string')
        .map((e: string) => e.trim().toLowerCase())
        .filter(Boolean)
      requestedEmails = Array.from(new Set(cleaned))
    }
  } catch {
    requestedEmails = null
  }

  // Gather every user across all pages so no account is missed.
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

  const byEmail = new Map<string, (typeof users)[number]>()
  for (const u of users) {
    if (u.email) byEmail.set(u.email.toLowerCase(), u)
  }
  const unconfirmed = users.filter((u) => !u.confirmedAt && !!u.email)

  // Build the list of recipients to actually email, and capture up-front skips so the
  // admin sees exactly why a chosen address was not sent to.
  const results: ResendResult[] = []
  let targets: typeof users

  if (requestedEmails && requestedEmails.length > 0) {
    targets = []
    for (const email of requestedEmails) {
      const user = byEmail.get(email)
      if (!user) {
        results.push({ email, status: 'skipped', detail: 'No account found with this email.' })
      } else if (user.confirmedAt) {
        results.push({ email, status: 'skipped', detail: 'Already confirmed — no confirmation needed.' })
      } else {
        targets.push(user)
      }
    }
  } else {
    targets = unconfirmed
  }

  if (targets.length === 0) {
    return Response.json({
      ok: true,
      total: users.length,
      unconfirmed: unconfirmed.length,
      requested: requestedEmails ? requestedEmails.length : null,
      sent: 0,
      failed: 0,
      skipped: results.filter((r) => r.status === 'skipped').length,
      results,
      errors: [],
    })
  }

  const signupUrl = `${config.url.replace(/\/$/, '')}/signup`
  let sent = 0
  let failed = 0
  const errors: string[] = []

  // Send sequentially to stay friendly to GoTrue's mailer rate limits.
  for (const user of targets) {
    const email = user.email as string
    try {
      const res = await fetch(signupUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: randomPassword() }),
      })
      if (res.ok) {
        sent++
        results.push({ email, status: 'sent' })
      } else {
        failed++
        const detail = (await res.text().catch(() => '')).slice(0, 200)
        // GoTrue rate-limits how often a confirmation can be re-sent to the same address.
        // Surface that clearly instead of letting it read as a generic failure.
        const friendly =
          res.status === 429
            ? 'Identity is rate-limiting confirmations for this address — wait a minute and try again.'
            : `${res.status} ${detail}`.trim()
        results.push({ email, status: 'failed', detail: friendly })
        errors.push(`${email}: ${friendly}`.trim())
      }
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ email, status: 'failed', detail: msg })
      errors.push(`${email}: ${msg}`)
    }
  }

  return Response.json({
    ok: failed === 0,
    total: users.length,
    unconfirmed: unconfirmed.length,
    requested: requestedEmails ? requestedEmails.length : null,
    sent,
    failed,
    skipped: results.filter((r) => r.status === 'skipped').length,
    results: results.slice(0, 200),
    errors: errors.slice(0, 25),
  })
}
