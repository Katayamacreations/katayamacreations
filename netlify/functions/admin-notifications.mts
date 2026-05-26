import type { Context } from '@netlify/functions'
import { requireAdmin } from './_admin.mjs'
import { db } from '../../db/index.js'
import { notifications } from '../../db/schema.js'
import { eq, desc } from 'drizzle-orm'

export default async (req: Request, _context: Context) => {
  const admin = await requireAdmin()
  if (admin instanceof Response) return admin

  if (req.method === 'GET') {
    const rows = await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(50)
    return Response.json(rows)
  }

  if (req.method === 'PATCH') {
    const { id } = (await req.json()) as { id: number }
    if (!id) return new Response('Missing id', { status: 400 })
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id))
    return Response.json({ ok: true })
  }

  if (req.method === 'POST') {
    const { action } = (await req.json()) as { action?: string }
    if (action === 'mark-all-read') {
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.isRead, false))
      return Response.json({ ok: true })
    }
    return new Response('Unknown action', { status: 400 })
  }

  return new Response('Method not allowed', { status: 405 })
}
