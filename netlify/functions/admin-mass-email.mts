import type { Context } from '@netlify/functions'
import { requireAdmin } from './_admin.mjs'
import { wrapEmail, escapeHtml, SITE_NAME } from './_email-brand.mjs'

const OWNER_EMAIL = Netlify.env.get('OWNER_EMAIL') || 'ogmegbeast@gmail.com'
const FROM_EMAIL = Netlify.env.get('WELCOME_FROM_EMAIL') || `${SITE_NAME} <onboarding@resend.dev>`

interface MassEmailBody {
  recipients?: string[]
  subject?: string
  bodyHtml?: string
  bodyText?: string
}

function wrapHtml(inner: string) {
  return wrapEmail(
    `<div style="line-height:1.6;font-size:14px;">${inner}</div>`,
    `You're receiving this because you have an account at ${SITE_NAME}.`,
  )
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, errors: ['Method not allowed'] }, { status: 405 })
  }

  const guard = await requireAdmin()
  if (guard instanceof Response) return guard

  let body: MassEmailBody
  try {
    body = (await req.json()) as MassEmailBody
  } catch {
    return Response.json({ ok: false, errors: ['Invalid JSON'] }, { status: 400 })
  }

  const subject = String(body.subject || '').trim()
  const bodyText = String(body.bodyText || '').trim()
  const bodyHtmlInput = String(body.bodyHtml || '').trim()

  if (!subject) return Response.json({ ok: false, errors: ['Subject is required'] }, { status: 400 })
  if (!bodyText && !bodyHtmlInput) return Response.json({ ok: false, errors: ['Email body is required'] }, { status: 400 })

  const recipients = (Array.isArray(body.recipients) ? body.recipients : [])
    .map((r) => String(r || '').trim().toLowerCase())
    .filter((r) => isValidEmail(r))
  const unique = Array.from(new Set(recipients))
    .filter((r) => r.toLowerCase() !== OWNER_EMAIL.toLowerCase())

  if (unique.length === 0) {
    return Response.json({ ok: false, errors: ['No valid recipients'] }, { status: 400 })
  }
  if (unique.length > 500) {
    return Response.json({ ok: false, errors: ['Too many recipients (max 500)'] }, { status: 400 })
  }

  const apiKey = Netlify.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.error('admin-mass-email: RESEND_API_KEY is not configured')
    return Response.json(
      { ok: false, errors: ['Email service is not configured. Please add RESEND_API_KEY in site settings.'] },
      { status: 500 },
    )
  }

  const html = bodyHtmlInput
    ? wrapHtml(bodyHtmlInput)
    : wrapHtml(escapeHtml(bodyText).replace(/\n/g, '<br>'))

  const text = bodyText || bodyHtmlInput.replace(/<[^>]*>/g, '')

  const BATCH_SIZE = 49
  const batches: string[][] = []
  for (let i = 0; i < unique.length; i += BATCH_SIZE) batches.push(unique.slice(i, i + BATCH_SIZE))

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const batch of batches) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [OWNER_EMAIL],
          bcc: batch,
          reply_to: OWNER_EMAIL,
          subject,
          html,
          text,
        }),
      })
      if (res.ok) {
        sent += batch.length
      } else {
        failed += batch.length
        const err = await res.text().catch(() => '')
        console.error(`admin-mass-email: Resend API error ${res.status}:`, err.slice(0, 500))
        errors.push(`Email service error (${res.status}): ${err.slice(0, 200)}`)
      }
    } catch (err) {
      failed += batch.length
      const msg = err instanceof Error ? err.message : String(err)
      console.error('admin-mass-email: fetch failed:', msg)
      errors.push(msg)
    }
  }

  return Response.json({ ok: failed === 0, sent, failed, batches: batches.length, errors })
}
