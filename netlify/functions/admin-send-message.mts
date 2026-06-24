import type { Context } from '@netlify/functions'
import { requireAdmin } from './_admin.mts'
import { sendEmail } from './_send-email.mjs'
import { wrapEmail, escapeHtml, SITE_NAME, COLORS, siteUrl, ctaButton } from './_email-brand.mjs'
import { db } from '../../db/index.js'
import { messages, notifications } from '../../db/schema.js'

function renderMessageToCustomer(opts: { subject: string; body: string }): string {
  const safeSubject = escapeHtml(opts.subject || '')
  const safeBody = escapeHtml(opts.body).replace(/\n/g, '<br>')
  return wrapEmail(
    `<h1 style="margin:0 0 16px;font-size:22px;color:${COLORS.heading};">${SITE_NAME}</h1>
${safeSubject ? `<p style="margin:0 0 6px;color:${COLORS.muted};font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Subject</p>
<p style="margin:0 0 16px;color:${COLORS.heading};font-weight:700;">${safeSubject}</p>` : ''}
<p style="margin:0;line-height:1.6;color:${COLORS.body};">${safeBody}</p>
${ctaButton('Reply in your account', `${siteUrl()}/account.html`)}`,
    `You're receiving this because ${SITE_NAME} sent you a message. Sign in to your account to reply.`,
    opts.subject || `A new message from ${SITE_NAME}`,
  )
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const admin = await requireAdmin()
  if (admin instanceof Response) return admin

  const body = (await req.json()) as {
    userId?: string
    userEmail?: string
    userName?: string
    subject?: string
    body?: string
  }

  const targetUserId = (body.userId || '').trim()
  const targetEmail = (body.userEmail || '').trim()
  const msgBody = (body.body || '').trim()

  if (!targetUserId) return new Response('A recipient is required', { status: 400 })
  if (!msgBody) return new Response('Message body is required', { status: 400 })

  const subject = (body.subject || '').trim().slice(0, 200)
  const storedBody = msgBody.slice(0, 5000)
  const userName = (body.userName || '').trim().slice(0, 200)

  try {
    const [msg] = await db
      .insert(messages)
      .values({
        userId: targetUserId,
        userEmail: targetEmail,
        userName,
        subject,
        body: storedBody,
        initiatedBy: 'admin',
        // The admin authored this, so there's nothing for the admin to "read".
        isRead: true,
      })
      .returning()

    // Notify the customer in-app so it surfaces on their account notifications.
    await db.insert(notifications).values({
      type: 'message',
      title: `New message from ${SITE_NAME}`,
      body: (subject || storedBody).slice(0, 100),
      relatedId: String(msg.id),
      userId: targetUserId,
    })

    // Best-effort email so the customer knows to check their account. A send failure
    // must not fail the message itself.
    if (targetEmail) {
      try {
        const sent = await sendEmail({
          to: targetEmail,
          subject: subject || `A new message from ${SITE_NAME}`,
          html: renderMessageToCustomer({ subject, body: storedBody }),
          text: `${SITE_NAME}\n\n${subject ? `Subject: ${subject}\n\n` : ''}${storedBody}\n\nSign in to your account to reply: ${siteUrl()}/account.html`,
        })
        if (!sent.ok) {
          console.error(`Customer message email failed (${sent.provider} ${sent.status}): ${sent.error || ''}`)
        }
      } catch (err) {
        console.error('Customer message email send failed', err)
      }
    }

    return Response.json({ ok: true, id: msg.id })
  } catch {
    return new Response('Failed to send message', { status: 500 })
  }
}
