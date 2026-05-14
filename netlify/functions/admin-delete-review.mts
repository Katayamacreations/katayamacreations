import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { db } from "../../db/index.js";
import { reviews, reviewImages } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { requireAdmin } from "./_admin.mjs";

export default async (req: Request, _context: Context) => {
  if (req.method !== "DELETE") {
    return new Response("Method not allowed", { status: 405 });
  }

  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const url = new URL(req.url);
  const reviewId = parseInt(url.searchParams.get("id") || "", 10);
  if (!reviewId || isNaN(reviewId)) {
    return new Response("Missing or invalid review id", { status: 400 });
  }

  const existing = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId));

  if (existing.length === 0) {
    return new Response("Review not found", { status: 404 });
  }

  const images = await db
    .select()
    .from(reviewImages)
    .where(eq(reviewImages.reviewId, reviewId));

  if (images.length > 0) {
    const store = getStore("review-photos");
    await Promise.all(
      images.map((img) => store.delete(img.blobKey).catch(() => {})),
    );
    await db.delete(reviewImages).where(eq(reviewImages.reviewId, reviewId));
  }

  await db.delete(reviews).where(eq(reviews.id, reviewId));

  return Response.json({ ok: true, deletedId: reviewId });
};
