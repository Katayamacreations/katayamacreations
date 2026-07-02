import type { Context } from '@netlify/functions'
import { getUser } from '@netlify/identity'
import { requireAdmin } from './_admin.mts'
import { sendEmail } from './_send-email.mjs'
import { wrapEmail, escapeHtml, SITE_NAME, COLORS, siteUrl, ctaButton } from './_email-brand.mjs'
import { db } from '../../db/index.js'
import { messages, messageReplies, notifications } from '../../db/schema.js'
import { eq, asc } from 'drizzle-orm'

function renderReplyToCustomer(opts: { subject: string; body: string }): string {
  const safeSubject = escapeHtml(opts.subject || '')
  const safeBody = escapeHtml(opts.body).replace(/\n/g, '<br>')
  return wrapEmail(
    `<h1 style="margin:0 0 16px;font-size:22px;color:${COLORS.heading};">${SITE_NAME}</h1>
${safeSubject ? `<p style="margin:0 0 6px;color:${COLORS.muted};font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Thread</p>
<p style="margin:0 0 16px;color:${COLORS.heading};font-weight:700;">${safeSubject}</p>` : ''}
<p style="margin:0 0 6px;color:${COLORS.muted};font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">New reply</p>
<p style="margin:0;line-height:1.6;color:${COLORS.body};">${safeBody}</p>
${ctaButton('Read and reply', `${siteUrl()}/account.html#messages`)}`,
    `You're receiving this because ${SITE_NAME} replied to your message thread. Sign in to your account to reply.`,
    `New reply from ${SITE_NAME}`,
  )
}

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url)
  const messageId = Number(url.searchParams.get('messageId'))
  if (!messageId) return new Response('Missing messageId', { status: 400 })

  const user = await getUser().catch(() => null)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const admin = await requireAdmin()
  const isAdmin = !(admin instanceof Response)

  if (req.method === 'GET') {
    const [msg] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1)

    if (!msg) return new Response('Not found', { status: 404 })
    if (!isAdmin && msg.userId !== user.id) {
      return new Response('Forbidden', { status: 403 })
    }

    const replies = await db
      .select()
      .from(messageReplies)
      .where(eq(messageReplies.messageId, messageId))
      .orderBy(asc(messageReplies.createdAt))

    if (msg.adminReply && replies.length === 0) {
      const [migrated] = await db
        .insert(messageReplies)
        .values({
          messageId,
          senderType: 'admin',
          senderName: 'Admin',
          body: msg.adminReply,
        })
        .returning()
      if (msg.repliedAt) {
        await db
          .update(messageReplies)
          .set({ createdAt: msg.repliedAt })
          .where(eq(messageReplies.id, migrated.id))
        migrated.createdAt = msg.repliedAt
      }
      replies.push(migrated)
    }

    return Response.json({ message: msg, replies })
  }

  if (req.method === 'POST') {
    const body = (await req.json()) as { body?: string }
    const replyBody = (body.body || '').trim()
    if (!replyBody) return new Response('Reply body is required', { status: 400 })

    const [msg] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1)

    if (!msg) return new Response('Not found', { status: 404 })
    if (!isAdmin && msg.userId !== user.id) {
      return new Response('Forbidden', { status: 403 })
    }

    const senderType = isAdmin ? 'admin' : 'user'
    const meta = (user as Record<string, unknown>).user_metadata as Record<string, string> | undefined
    const senderName = isAdmin
      ? 'Admin'
      : (meta?.full_name && String(meta.full_name)) ||
        [meta?.firstName, meta?.lastName].filter(Boolean).join(' ').trim() ||
        user.email || ''

    const existingReplies = await db
      .select({ id: messageReplies.id })
      .from(messageReplies)
      .where(eq(messageReplies.messageId, messageId))
      .limit(1)

    if (msg.adminReply && existingReplies.length === 0) {
      const [migrated] = await db
        .insert(messageReplies)
        .values({
          messageId,
          senderType: 'admin',
          senderName: 'Admin',
          body: msg.adminReply,
        })
        .returning()
      if (msg.repliedAt) {
        await db
          .update(messageReplies)
          .set({ createdAt: msg.repliedAt })
          .where(eq(messageReplies.id, migrated.id))
      }
    }

    const [reply] = await db
      .insert(messageReplies)
      .values({
        messageId,
        senderType,
        senderName,
        body: replyBody.slice(0, 5000),
      })
      .returning()

    if (isAdmin) {
      await db
        .update(messages)
        .set({ repliedAt: new Date(), isRead: true })
        .where(eq(messages.id, messageId))

      if (msg.userId) {
        await db.insert(notifications).values({
          type: 'reply',
          title: 'New reply to your message',
          body: `Re: ${(msg.subject || msg.body).slice(0, 100)}`,
          relatedId: String(msg.id),
          userId: msg.userId,
        })
      }

      if (msg.userEmail) {
        try {
          const subject = msg.subject || `Your message with ${SITE_NAME}`
          const sent = await sendEmail({
            to: msg.userEmail,
            subject: `New reply from ${SITE_NAME}`,
            html: renderReplyToCustomer({ subject, body: replyBody.slice(0, 5000) }),
            text: `${SITE_NAME}\n\nNew reply${subject ? `: ${subject}` : ''}\n\n${replyBody.slice(0, 5000)}\n\nSign in to read and reply: ${siteUrl()}/account.html#messages`,
          })
          if (!sent.ok) {
            console.error(`Customer reply email failed (${sent.provider} ${sent.status}): ${sent.error || ''}`)
          }
        } catch (err) {
          console.error('Customer reply email send failed', err)
        }
      }
    } else {
      await db.insert(notifications).values({
        type: 'message',
        title: 'New reply from customer',
        body: `${senderName}: Re: ${(msg.subject || msg.body).slice(0, 100)}`,
        relatedId: String(msg.id),
      })
    }

    return Response.json({ ok: true, reply })
  }

  return new Response('Method not allowed', { status: 405 })
}
