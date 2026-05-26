import type { Context } from '@netlify/functions'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { messages } from '../../db/schema.js'
import { eq, desc, and, isNull, sql } from 'drizzle-orm'

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const user = await getUser().catch(() => null)
  if (!user) return new Response('Unauthorized', { status: 401 })

  try {
    const rows = await db
      .select({
        id: messages.id,
        userId: messages.userId,
        userEmail: messages.userEmail,
        userName: messages.userName,
        subject: messages.subject,
        body: messages.body,
        adminReply: messages.adminReply,
        repliedAt: messages.repliedAt,
        isRead: messages.isRead,
        createdAt: messages.createdAt,
        deletedAt: messages.deletedAt,
        deletedBy: messages.deletedBy,
        replyCount: sql<number>`(SELECT count(*) FROM message_replies WHERE message_id = ${messages.id})`.as('reply_count'),
      })
      .from(messages)
      .where(and(eq(messages.userId, user.id), isNull(messages.deletedAt)))
      .orderBy(desc(messages.createdAt))
      .limit(50)

    return Response.json(rows)
  } catch {
    return Response.json([], { status: 200 })
  }
}
