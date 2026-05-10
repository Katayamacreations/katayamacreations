import type { Context } from "@netlify/functions";
import { db } from "../../db/index.js";
import { reviews, reviewImages } from "../../db/schema.js";
import { desc, eq } from "drizzle-orm";

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const limitParam = parseInt(url.searchParams.get("limit") || "50", 10);
  const limit = Math.min(Math.max(limitParam, 1), 100);
  const offsetParam = parseInt(url.searchParams.get("offset") || "0", 10);
  const offset = Math.max(offsetParam, 0);

  const allReviews = await db
    .select()
    .from(reviews)
    .orderBy(desc(reviews.createdAt))
    .limit(limit)
    .offset(offset);

  const reviewIds = allReviews.map((r) => r.id);
  let images: typeof reviewImages.$inferSelect[] = [];
  if (reviewIds.length > 0) {
    const allImages = await Promise.all(
      reviewIds.map((rid) =>
        db.select().from(reviewImages).where(eq(reviewImages.reviewId, rid))
      )
    );
    images = allImages.flat();
  }

  const result = allReviews.map((r) => ({
    ...r,
    images: images.filter((img) => img.reviewId === r.id),
  }));

  return Response.json({ reviews: result });
};
