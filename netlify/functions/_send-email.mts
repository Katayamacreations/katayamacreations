// Shared outbound email transport.
//
// Email now goes out through Mailgun, configured as the site's connected mail provider
// via the Netlify email integration (the NETLIFY_EMAILS_* environment variables). This
// helper is the single place that talks to a provider, so every function sends the same
// way. If Mailgun is not configured it falls back to the legacy Resend API so nothing
// silently stops sending.

const SITE_NAME = 'Katayama Creations'

// Read an env var across both function runtimes: the modern runtime exposes the `Netlify`
// global, while the legacy handler (identity-signup) only has `process.env`.
function env(key: string): string | undefined {
  try {
    const v = (globalThis as { Netlify?: { env?: { get(k: string): string | undefined } } }).Netlify?.env?.get?.(key)
    if (v != null && v !== '') return v
  } catch {
    /* Netlify global not present — fall through to process.env */
  }
  const pv = typeof process !== 'undefined' ? process.env?.[key] : undefined
  return pv != null && pv !== '' ? pv : undefined
}

function mailgunConfig() {
  const provider = (env('NETLIFY_EMAILS_PROVIDER') || '').toLowerCase()
  const apiKey = env('NETLIFY_EMAILS_PROVIDER_API_KEY')
  const domain = env('NETLIFY_EMAILS_MAILGUN_DOMAIN')
  if (provider !== 'mailgun' || !apiKey || !domain) return null
  const region = (env('NETLIFY_EMAILS_MAILGUN_HOST_REGION') || 'us').toLowerCase()
  const baseUrl = region.startsWith('eu') ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net'
  return { apiKey, domain, baseUrl }
}

// Default sender. Prefer an explicit WELCOME_FROM_EMAIL override; otherwise send from the
// connected Mailgun domain so messages pass SPF/DKIM, falling back to the Resend sandbox.
function defaultFrom(): string {
  const override = env('WELCOME_FROM_EMAIL')
  if (override) return override
  const mg = mailgunConfig()
  if (mg) return `${SITE_NAME} <noreply@${mg.domain}>`
  return `${SITE_NAME} <onboarding@resend.dev>`
}

function ownerEmail(): string {
  return env('OWNER_EMAIL') || 'ogmegbeast@gmail.com'
}

export interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
  bcc?: string | string[]
  signal?: AbortSignal
}

export interface SendEmailResult {
  ok: boolean
  status: number
  provider: 'mailgun' | 'resend' | 'none'
  error?: string
}

function basicAuth(user: string, pass: string): string {
  const raw = `${user}:${pass}`
  if (typeof btoa === 'function') return btoa(raw)
  return Buffer.from(raw).toString('base64')
}

function toList(v: string | string[] | undefined): string[] {
  if (!v) return []
  return (Array.isArray(v) ? v : [v]).map((s) => String(s).trim()).filter(Boolean)
}

// True when at least one provider is configured. Functions use this to fail fast with a
// clear message instead of attempting a send that can't succeed.
export function isEmailConfigured(): boolean {
  return !!mailgunConfig() || !!env('RESEND_API_KEY')
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const to = toList(params.to)
  const bcc = toList(params.bcc)
  if (to.length === 0 && bcc.length === 0) {
    return { ok: false, status: 0, provider: 'none', error: 'No recipients' }
  }

  const from = params.from || defaultFrom()
  const replyTo = params.replyTo || ownerEmail()

  const mg = mailgunConfig()
  if (mg) {
    const form = new URLSearchParams()
    form.set('from', from)
    if (to.length) form.set('to', to.join(','))
    if (bcc.length) form.set('bcc', bcc.join(','))
    form.set('subject', params.subject)
    form.set('html', params.html)
    if (params.text) form.set('text', params.text)
    if (replyTo) form.set('h:Reply-To', replyTo)

    try {
      const res = await fetch(`${mg.baseUrl}/v3/${mg.domain}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth('api', mg.apiKey)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
        signal: params.signal,
      })
      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        console.error(`Mailgun API error ${res.status}: ${errBody.slice(0, 500)}`)
        return { ok: false, status: res.status, provider: 'mailgun', error: errBody.slice(0, 200) }
      }
      return { ok: true, status: res.status, provider: 'mailgun' }
    } catch (err) {
      console.error('Mailgun send failed', err)
      return { ok: false, status: 0, provider: 'mailgun', error: err instanceof Error ? err.message : String(err) }
    }
  }

  // Fallback: legacy Resend transport.
  const resendKey = env('RESEND_API_KEY')
  if (!resendKey) {
    return { ok: false, status: 0, provider: 'none', error: 'No email provider configured' }
  }
  const payload: Record<string, unknown> = {
    from,
    subject: params.subject,
    html: params.html,
  }
  if (to.length) payload.to = to
  if (bcc.length) payload.bcc = bcc
  if (params.text) payload.text = params.text
  if (replyTo) payload.reply_to = replyTo

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: params.signal,
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error(`Resend API error ${res.status}: ${errBody.slice(0, 500)}`)
      return { ok: false, status: res.status, provider: 'resend', error: errBody.slice(0, 200) }
    }
    return { ok: true, status: res.status, provider: 'resend' }
  } catch (err) {
    console.error('Resend send failed', err)
    return { ok: false, status: 0, provider: 'resend', error: err instanceof Error ? err.message : String(err) }
  }
}
