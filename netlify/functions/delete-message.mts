import type { Context } from '@netlify/functions'
import { getUser } from '@netlify/identity'
import { requireAdmin } from './_admin.mts'
import { db } from '../../db/index.js'
import { messages } from '../../db/schema.js'
import { eq, and, isNull } from 'drizzle-orm'

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body = (await req.json()) as { id: number }
  if (!body.id) return new Response('Missing id', { status: 400 })

  const admin = await requireAdmin().catch(() => null)
  const isAdmin = admin && !(admin instanceof Response)

  if (isAdmin) {
    const [msg] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.id, body.id), isNull(messages.deletedAt)))
      .limit(1)

    if (!msg) return new Response('Message not found', { status: 404 })

    await db
      .update(messages)
      .set({ deletedAt: new Date(), deletedBy: 'admin' })
      .where(eq(messages.id, body.id))

    return Response.json({ ok: true })
  }

  const user = await getUser().catch(() => null)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const [msg] = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.id, body.id),
        eq(messages.userId, user.id),
        isNull(messages.deletedAt),
      ),
    )
    .limit(1)

  if (!msg) return new Response('Message not found', { status: 404 })

  await db
    .update(messages)
    .set({ deletedAt: new Date(), deletedBy: 'user' })
    .where(eq(messages.id, body.id))

  return Response.json({ ok: true })
}
