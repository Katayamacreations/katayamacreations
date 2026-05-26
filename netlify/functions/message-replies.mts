import type { Context } from '@netlify/functions'
import { getUser } from '@netlify/identity'
import { requireAdmin } from './_admin.mts'
import { db } from '../../db/index.js'
import { messages, messageReplies, notifications } from '../../db/schema.js'
import { eq, asc } from 'drizzle-orm'

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
        .set({ adminReply: replyBody.slice(0, 5000), repliedAt: new Date(), isRead: true })
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
