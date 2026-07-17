import type { Context } from '@netlify/functions'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { userCarts } from '../../db/schema.js'
import { eq } from 'drizzle-orm'

interface CartItem {
  price?: unknown
  qty?: unknown
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'PUT') return new Response('Method not allowed', { status: 405 })

  const user = await getUser().catch(() => null)
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: { items?: CartItem[] }
  try {
    body = (await req.json()) as { items?: CartItem[] }
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const items = Array.isArray(body.items) ? body.items.slice(0, 100) : []
  const summary = items.reduce(
    (result, item) => {
      const qty = Math.max(0, Math.min(99, Math.floor(Number(item?.qty) || 0)))
      const price = Math.max(0, Math.min(10000, Number(item?.price) || 0))
      result.itemCount += qty
      result.subtotal += price * qty
      return result
    },
    { itemCount: 0, subtotal: 0 },
  )

  if (summary.itemCount === 0) {
    await db.delete(userCarts).where(eq(userCarts.userId, user.id))
    return Response.json({ hasCart: false, itemCount: 0 })
  }

  const subtotal = summary.subtotal.toFixed(2)
  await db
    .insert(userCarts)
    .values({
      userId: user.id,
      userEmail: user.email || '',
      itemCount: summary.itemCount,
      subtotal,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userCarts.userId,
      set: {
        userEmail: user.email || '',
        itemCount: summary.itemCount,
        subtotal,
        updatedAt: new Date(),
      },
    })

  return Response.json({ hasCart: true, itemCount: summary.itemCount, subtotal })
}
