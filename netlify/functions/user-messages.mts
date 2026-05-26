import type { Context } from '@netlify/functions'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { messages } from '../../db/schema.js'
import { eq, desc } from 'drizzle-orm'

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const user = await getUser().catch(() => null)
  if (!user) return new Response('Unauthorized', { status: 401 })

  try {
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.userId, user.id))
      .orderBy(desc(messages.createdAt))
      .limit(50)

    return Response.json(rows)
  } catch {
    return Response.json([], { status: 200 })
  }
}
