import type { Context } from '@netlify/functions'
import { requireAdmin } from './_admin.mjs'
import { wrapEmail, escapeHtml, SITE_NAME, OWNER_EMAIL } from './_email-brand.mjs'

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
    return new Response('Method not allowed', { status: 405 })
  }

  const guard = await requireAdmin()
  if (guard instanceof Response) return guard

  let body: MassEmailBody
  try {
    body = (await req.json()) as MassEmailBody
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const subject = String(body.subject || '').trim()
  const bodyText = String(body.bodyText || '').trim()
  const bodyHtmlInput = String(body.bodyHtml || '').trim()

  if (!subject) return new Response('Subject is required', { status: 400 })
  if (!bodyText && !bodyHtmlInput) return new Response('Email body is required', { status: 400 })

  const recipients = (Array.isArray(body.recipients) ? body.recipients : [])
    .map((r) => String(r || '').trim().toLowerCase())
    .filter((r) => isValidEmail(r))
  const unique = Array.from(new Set(recipients))

  if (unique.length === 0) {
    return new Response('No valid recipients', { status: 400 })
  }
  if (unique.length > 500) {
    return new Response('Too many recipients (max 500)', { status: 400 })
  }

  const apiKey = Netlify.env.get('RESEND_API_KEY')
  if (!apiKey) {
    return new Response('Email service is not configured (RESEND_API_KEY missing).', { status: 500 })
  }

  const html = bodyHtmlInput
    ? wrapHtml(bodyHtmlInput)
    : wrapHtml(escapeHtml(bodyText).replace(/\n/g, '<br>'))

  const text = bodyText || bodyHtmlInput.replace(/<[^>]*>/g, '')

  const batches: string[][] = []
  for (let i = 0; i < unique.length; i += 50) batches.push(unique.slice(i, i + 50))

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
        errors.push(`HTTP ${res.status}: ${err.slice(0, 200)}`)
      }
    } catch (err) {
      failed += batch.length
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  return Response.json({ ok: failed === 0, sent, failed, batches: batches.length, errors })
}
