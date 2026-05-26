import type { Context } from '@netlify/functions'
import { requireAdmin } from './_admin.mjs'
import { db } from '../../db/index.js'
import { messages, notifications } from '../../db/schema.js'
import { eq, desc } from 'drizzle-orm'

export default async (req: Request, _context: Context) => {
  const admin = await requireAdmin()
  if (admin instanceof Response) return admin

  if (req.method === 'GET') {
    const rows = await db
      .select()
      .from(messages)
      .orderBy(desc(messages.createdAt))
      .limit(100)
    return Response.json(rows)
  }

  if (req.method === 'PATCH') {
    const body = (await req.json()) as { id: number; reply?: string }
    if (!body.id) return new Response('Missing id', { status: 400 })

    if (body.reply !== undefined) {
      const [msg] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, body.id))
        .limit(1)

      await db
        .update(messages)
        .set({
          adminReply: body.reply.trim().slice(0, 5000),
          repliedAt: new Date(),
          isRead: true,
        })
        .where(eq(messages.id, body.id))

      if (msg?.userId) {
        await db.insert(notifications).values({
          type: 'reply',
          title: 'New reply to your message',
          body: `Re: ${(msg.subject || msg.body).slice(0, 100)}`,
          relatedId: String(msg.id),
          userId: msg.userId,
        })
      }
    } else {
      await db
        .update(messages)
        .set({ isRead: true })
        .where(eq(messages.id, body.id))
    }

    return Response.json({ ok: true })
  }

  return new Response('Method not allowed', { status: 405 })
}
