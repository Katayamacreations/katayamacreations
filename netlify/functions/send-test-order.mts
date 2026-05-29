import type { Context } from '@netlify/functions'
import { renderOrderEmailHtml, renderOrderEmailText, SAMPLE_ORDER } from './_order-email.mjs'
import { sendEmail, isEmailConfigured } from './_send-email.mjs'

const OWNER_EMAIL = Netlify.env.get('OWNER_EMAIL') || 'ogmegbeast@gmail.com'

export default async (req: Request, _context: Context) => {
  if (!isEmailConfigured()) {
    return new Response(
      'No email provider is configured on this site. Connect Mailgun (or set RESEND_API_KEY) under Site settings, then redeploy and try again.',
      { status: 503 },
    )
  }

  const url = new URL(req.url)
  const to = url.searchParams.get('to') || OWNER_EMAIL

  const res = await sendEmail({
    to,
    replyTo: OWNER_EMAIL,
    subject: '[TEST] New order: Sample Customer — $52.05',
    html: renderOrderEmailHtml(SAMPLE_ORDER),
    text: renderOrderEmailText(SAMPLE_ORDER),
  })

  if (!res.ok) {
    console.error('Test order send failed', res.provider, res.status, res.error || '')
    return new Response(`Test send failed (${res.status})`, { status: 502 })
  }

  return new Response(`Test order email sent to ${to}.`, { status: 200 })
}

export const config = {
  path: '/api/send-test-order',
}
