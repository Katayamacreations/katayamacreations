import type { Context } from '@netlify/functions'
import { requireAdmin } from './_admin.mjs'
import { wrapEmail, escapeHtml, SITE_NAME } from './_email-brand.mjs'
import { sendEmail, isEmailConfigured } from './_send-email.mjs'

const OWNER_EMAIL = Netlify.env.get('OWNER_EMAIL') || 'ogmegbeast@gmail.com'

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

  if (!isEmailConfigured()) {
    console.error('admin-mass-email: no email provider configured')
    return Response.json(
      { ok: false, errors: ['Email service is not configured. Connect Mailgun (or set RESEND_API_KEY) in site settings.'] },
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
    const res = await sendEmail({
      to: OWNER_EMAIL,
      bcc: batch,
      replyTo: OWNER_EMAIL,
      subject,
      html,
      text,
    })
    if (res.ok) {
      sent += batch.length
    } else {
      failed += batch.length
      console.error(`admin-mass-email: ${res.provider} error ${res.status}:`, (res.error || '').slice(0, 500))
      errors.push(`Email service error (${res.status}): ${(res.error || '').slice(0, 200)}`)
    }
  }

  return Response.json({ ok: failed === 0, sent, failed, batches: batches.length, errors })
}
