import type { Context } from '@netlify/functions'
import { requireAdmin } from './_admin.mts'
import { db } from '../../db/index.js'
import { messages } from '../../db/schema.js'
import { eq, desc, isNull, sql } from 'drizzle-orm'

export default async (req: Request, _context: Context) => {
  const admin = await requireAdmin()
  if (admin instanceof Response) return admin

  if (req.method === 'GET') {
    const rows = await db
      .select({
        id: messages.id,
        userId: messages.userId,
        userEmail: messages.userEmail,
        userName: messages.userName,
        subject: messages.subject,
        body: messages.body,
        initiatedBy: messages.initiatedBy,
        adminReply: messages.adminReply,
        repliedAt: messages.repliedAt,
        isRead: messages.isRead,
        createdAt: messages.createdAt,
        deletedAt: messages.deletedAt,
        deletedBy: messages.deletedBy,
        replyCount: sql<number>`(SELECT count(*) FROM message_replies WHERE message_id = ${messages.id})`.as('reply_count'),
        adminReplyCount: sql<number>`(SELECT count(*) FROM message_replies WHERE message_id = ${messages.id} AND sender_type = 'admin')`.as('admin_reply_count'),
        userReplyCount: sql<number>`(SELECT count(*) FROM message_replies WHERE message_id = ${messages.id} AND sender_type = 'user')`.as('user_reply_count'),
      })
      .from(messages)
      .where(isNull(messages.deletedAt))
      .orderBy(desc(messages.createdAt))
      .limit(100)
    return Response.json(rows)
  }

  if (req.method === 'PATCH') {
    const body = (await req.json()) as { id: number }
    if (!body.id) return new Response('Missing id', { status: 400 })

    await db
      .update(messages)
      .set({ isRead: true })
      .where(eq(messages.id, body.id))

    return Response.json({ ok: true })
  }

  return new Response('Method not allowed', { status: 405 })
}
