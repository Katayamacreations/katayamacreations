import type { Context } from '@netlify/functions'
import { renderOrderEmailHtml, renderOrderEmailText, SAMPLE_ORDER } from './_order-email.mjs'

const FROM_EMAIL = Netlify.env.get('WELCOME_FROM_EMAIL') || 'Katayama Creations <onboarding@resend.dev>'
const OWNER_EMAIL = Netlify.env.get('OWNER_EMAIL') || 'ogmegbeast@gmail.com'

export default async (req: Request, _context: Context) => {
  const apiKey = Netlify.env.get('RESEND_API_KEY')
  if (!apiKey) {
    return new Response(
      'RESEND_API_KEY is not set on this site. Add it under Site settings → Environment variables, then redeploy and try again.',
      { status: 503 },
    )
  }

  const url = new URL(req.url)
  const to = url.searchParams.get('to') || OWNER_EMAIL

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      reply_to: OWNER_EMAIL,
      subject: '[TEST] New order: Sample Customer — $52.05',
      html: renderOrderEmailHtml(SAMPLE_ORDER),
      text: renderOrderEmailText(SAMPLE_ORDER),
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('Resend test order failed', res.status, body)
    return new Response(`Test send failed (${res.status})`, { status: 502 })
  }

  return new Response(`Test order email sent to ${to}.`, { status: 200 })
}

export const config = {
  path: '/api/send-test-order',
}
