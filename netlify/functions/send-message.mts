import type { Context } from '@netlify/functions'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { messages, notifications } from '../../db/schema.js'

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

  try {
    const [msg] = await db
      .insert(messages)
      .values({
        userId: user.id,
        userEmail: user.email || '',
        userName,
        subject: (body.subject || '').trim().slice(0, 200),
        body: msgBody.slice(0, 5000),
      })
      .returning()

    await db.insert(notifications).values({
      type: 'message',
      title: 'New message',
      body: `From ${userName || user.email}: ${(body.subject || msgBody).slice(0, 100)}`,
      relatedId: String(msg.id),
    })

    return Response.json({ ok: true, id: msg.id })
  } catch {
    return new Response('Failed to send message', { status: 500 })
  }
}
