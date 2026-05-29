import type { Context } from '@netlify/functions'
import { getUser } from '@netlify/identity'
import { sendEmail } from './_send-email.mjs'
import { ALERT_RECIPIENTS } from './_admin.mjs'
import { wrapEmail, escapeHtml, SITE_NAME, COLORS } from './_email-brand.mjs'
import { db } from '../../db/index.js'
import { messages, notifications } from '../../db/schema.js'

function renderMessageAlert(opts: { name: string; email: string; subject: string; body: string }): string {
  const safeName = escapeHtml(opts.name || 'A customer')
  const safeEmail = escapeHtml(opts.email)
  const safeSubject = escapeHtml(opts.subject || '(no subject)')
  const safeBody = escapeHtml(opts.body).replace(/\n/g, '<br>')
  return wrapEmail(
    `<h1 style="margin:0 0 8px;font-size:22px;color:${COLORS.heading};">New customer message</h1>
<p style="margin:0 0 16px;color:${COLORS.body};font-size:14px;">From <strong>${safeName}</strong> — <a href="mailto:${safeEmail}" style="color:${COLORS.link};">${safeEmail}</a></p>
<p style="margin:0 0 6px;color:${COLORS.muted};font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Subject</p>
<p style="margin:0 0 16px;color:${COLORS.heading};font-weight:700;">${safeSubject}</p>
<p style="margin:0 0 6px;color:${COLORS.muted};font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Message</p>
<p style="margin:0;line-height:1.6;color:${COLORS.body};">${safeBody}</p>`,
    `You're receiving this because a customer sent a message through ${SITE_NAME}. Reply directly to reach them.`,
    `${safeName} sent a new message: ${safeSubject}`,
  )
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const user = await getUser().catch(() => null)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = (await req.json()) as { subject?: string; body?: string }
  const msgBody = (body.body || '').trim()
  if (!msgBody) return new Response('Message body is required', { status: 400 })

  const meta = (user as Record<string, unknown>).user_metadata as Record<string, string> | undefined
  const userName =
    (meta?.full_name && String(meta.full_name)) ||
    [meta?.firstName, meta?.lastName].filter(Boolean).join(' ').trim() ||
    ''

  const subject = (body.subject || '').trim().slice(0, 200)
  const storedBody = msgBody.slice(0, 5000)

  try {
    const [msg] = await db
      .insert(messages)
      .values({
        userId: user.id,
        userEmail: user.email || '',
        userName,
        subject,
        body: storedBody,
      })
      .returning()

    await db.insert(notifications).values({
      type: 'message',
      title: 'New message',
      body: `From ${userName || user.email}: ${(subject || storedBody).slice(0, 100)}`,
      relatedId: String(msg.id),
    })

    // Alert the admins by email so a customer message isn't missed. Best-effort: a send
    // failure must not fail the customer's submission.
    try {
      const alert = await sendEmail({
        to: ALERT_RECIPIENTS,
        replyTo: user.email || ALERT_RECIPIENTS[0],
        subject: `New message from ${userName || user.email || 'a customer'}${subject ? `: ${subject}` : ''}`,
        html: renderMessageAlert({ name: userName, email: user.email || '', subject, body: storedBody }),
        text: `New customer message\n\nFrom: ${userName || ''} <${user.email || ''}>\nSubject: ${subject || '(no subject)'}\n\n${storedBody}`,
      })
      if (!alert.ok) {
        console.error(`Message alert email failed (${alert.provider} ${alert.status}): ${alert.error || ''}`)
      }
    } catch (err) {
      console.error('Message alert email send failed', err)
    }

    return Response.json({ ok: true, id: msg.id })
  } catch {
    return new Response('Failed to send message', { status: 500 })
  }
}
