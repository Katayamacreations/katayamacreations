import type { Context } from '@netlify/functions'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { notifications } from '../../db/schema.js'
import { eq, desc, and } from 'drizzle-orm'

export default async (req: Request, _context: Context) => {
  const user = await getUser().catch(() => null)
  if (!user) return new Response('Unauthorized', { status: 401 })

  if (req.method === 'GET') {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50)
    return Response.json(rows)
  }

  if (req.method === 'PATCH') {
    const { id } = (await req.json()) as { id: number }
    if (!id) return new Response('Missing id', { status: 400 })
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
    return Response.json({ ok: true })
  }

  if (req.method === 'POST') {
    const { action } = (await req.json()) as { action?: string }
    if (action === 'mark-all-read') {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.isRead, false), eq(notifications.userId, user.id)))
      return Response.json({ ok: true })
    }
    return new Response('Unknown action', { status: 400 })
  }

  return new Response('Method not allowed', { status: 405 })
}
