import type { Context } from "@netlify/functions";
import { getUser, admin } from "@netlify/identity";
import { getStore } from "@netlify/blobs";
import { db } from "../../db/index.js";
import { reviews, reviewImages } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const user = await getUser().catch(() => null);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = user.id;

  // Anonymize reviews so they remain visible but aren't linked to this user
  await db
    .update(reviews)
    .set({
      userId: "deleted",
      userEmail: "",
      userName: "Former Customer",
      updatedAt: new Date(),
    })
    .where(eq(reviews.userId, userId));

  // Delete orders from blob store
  const orderStore = getStore("orders");
  const { blobs } = await orderStore.list({ prefix: `${userId}/` });
  await Promise.all(blobs.map((b) => orderStore.delete(b.key).catch(() => {})));

  // Delete the Identity user
  await admin.deleteUser(userId);

  return Response.json({ ok: true });
};
