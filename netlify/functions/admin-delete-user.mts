import type { Context } from '@netlify/functions'
import { admin } from '@netlify/identity'
import { getStore } from '@netlify/blobs'
import { requireAdmin, OWNER_EMAIL } from './_admin.mjs'
import { db } from '../../db/index.js'
import { reviews, notifications, messages } from '../../db/schema.js'
import { eq } from 'drizzle-orm'

// Lets an admin permanently delete a customer's account from the admin user page. This
// removes the Identity user and cleans up the data tied to them, mirroring the customer's
// own "delete my account" flow (delete-account.mts):
//   - Reviews are anonymized rather than removed, so existing testimonials stay visible
//     but are no longer linked to a real person.
//   - Stored orders (Netlify Blobs) and the user's notifications are deleted.
//   - Messages are anonymized so any support thread history is retained without the
//     customer's name/email.
// The site owner can never be deleted, and an admin can't delete their own account here.
export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const guard = await requireAdmin()
  if (guard instanceof Response) return guard

  let body: { userId?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const userId = (body.userId || '').trim()
  if (!userId) {
    return new Response('userId is required', { status: 400 })
  }

  if (userId === guard.id) {
    return new Response('You cannot delete your own account here', { status: 403 })
  }

  let targetUser
  try {
    targetUser = await admin.getUser(userId)
  } catch {
    return new Response('User not found', { status: 404 })
  }

  const targetEmail = (targetUser.email || '').toLowerCase()
  if (targetEmail === OWNER_EMAIL) {
    return new Response('Cannot delete the site owner', { status: 403 })
  }

  // Anonymize reviews so they remain visible but aren't linked to this user.
  await db
    .update(reviews)
    .set({ userId: 'deleted', userEmail: '', userName: 'Former Customer', updatedAt: new Date() })
    .where(eq(reviews.userId, userId))

  // Anonymize the customer's messages so support history is kept without their identity.
  await db
    .update(messages)
    .set({ userId: 'deleted', userEmail: '', userName: 'Former Customer' })
    .where(eq(messages.userId, userId))

  // Remove the user's notifications outright — they're personal and have no archival value.
  await db.delete(notifications).where(eq(notifications.userId, userId))

  // Delete the user's stored orders from the blob store.
  try {
    const orderStore = getStore('orders')
    const { blobs } = await orderStore.list({ prefix: `${userId}/` })
    await Promise.all(blobs.map((b) => orderStore.delete(b.key).catch(() => {})))
  } catch (err) {
    console.error('admin-delete-user: failed to clear orders', err)
  }

  // Delete the Identity user last, so the data cleanup above runs even if this fails.
  try {
    await admin.deleteUser(userId)
  } catch (err) {
    console.error('admin-delete-user: deleteUser failed', err)
    return new Response('Failed to delete user', { status: 502 })
  }

  return Response.json({ ok: true, userId })
}
