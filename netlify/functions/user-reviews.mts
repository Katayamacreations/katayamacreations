import type { Context } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { db } from "../../db/index.js";
import { reviews, reviewImages } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";

export default async (_req: Request, _context: Context) => {
  const user = await getUser().catch(() => null);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userReviews = await db
    .select()
    .from(reviews)
    .where(eq(reviews.userId, user.id))
    .orderBy(desc(reviews.createdAt));

  const reviewIds = userReviews.map((r) => r.id);
  let images: typeof reviewImages.$inferSelect[] = [];
  if (reviewIds.length > 0) {
    const allImages = await Promise.all(
      reviewIds.map((rid) =>
        db.select().from(reviewImages).where(eq(reviewImages.reviewId, rid))
      )
    );
    images = allImages.flat();
  }

  const result = userReviews.map((r) => ({
    ...r,
    images: images.filter((img) => img.reviewId === r.id),
  }));

  return Response.json({ reviews: result });
};
