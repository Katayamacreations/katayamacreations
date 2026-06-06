import type { Context } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { getStore } from "@netlify/blobs";
import { db } from "../../db/index.js";
import { reviews, reviewImages, notifications } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { sendEmail } from "./_send-email.mjs";
import { renderReviewEmailHtml, renderReviewEmailText } from "./_review-email.mjs";
import { ALERT_RECIPIENTS } from "./_admin.mjs";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

function newBlobKey() {
  return `rv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "");
  const buf = Buffer.from(clean, "base64");
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const user = await getUser().catch(() => null);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: {
    orderId?: string;
    rating?: number;
    reviewText?: string;
    userName?: string;
    images?: { dataBase64: string; fileName: string; contentType: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const orderId = String(body.orderId || "").trim();
  const rating = Number(body.rating);
  const reviewText = String(body.reviewText || "").trim();
  const userName = String(body.userName || user.email || "").trim();

  if (!orderId) return new Response("orderId is required", { status: 400 });
  if (isNaN(rating) || rating < 0.5 || rating > 5) {
    return new Response("rating must be between 0.5 and 5", { status: 400 });
  }
  const roundedRating = Math.round(rating * 2) / 2;

  const REVIEW_WAIT_DAYS = 14;
  const orderStore = getStore("orders");
  const { blobs } = await orderStore.list({ prefix: `${user.id}/` });
  let matchedOrder: Record<string, unknown> | null = null;
  for (const b of blobs) {
    try {
      const o = await orderStore.get(b.key, { type: "json" }) as Record<string, unknown>;
      if (o && o.id === orderId) { matchedOrder = o; break; }
    } catch { /* skip */ }
  }
  if (!matchedOrder) {
    return new Response("Order not found", { status: 404 });
  }
  const isDelivered = String(matchedOrder.status || "").toLowerCase() === "delivered";
  const placedAt = matchedOrder.placedAt ? new Date(String(matchedOrder.placedAt)) : null;
  const daysSincePlaced = placedAt ? (Date.now() - placedAt.getTime()) / (1000 * 60 * 60 * 24) : 0;
  const isOldEnough = daysSincePlaced >= REVIEW_WAIT_DAYS;
  if (!isDelivered && !isOldEnough) {
    const daysLeft = Math.ceil(REVIEW_WAIT_DAYS - daysSincePlaced);
    return new Response(
      JSON.stringify({ error: "Review not yet available", daysLeft }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const existing = await db
    .select()
    .from(reviews)
    .where(
      and(eq(reviews.orderId, orderId), eq(reviews.userId, user.id))
    );

  let reviewId: number;
  let isNewReview = false;

  if (existing.length > 0) {
    await db
      .update(reviews)
      .set({
        rating: String(roundedRating),
        reviewText,
        userName,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, existing[0].id));
    reviewId = existing[0].id;
  } else {
    const [inserted] = await db
      .insert(reviews)
      .values({
        orderId,
        userId: user.id,
        userEmail: user.email || "",
        userName,
        rating: String(roundedRating),
        reviewText,
      })
      .returning();
    reviewId = inserted.id;
    isNewReview = true;
  }

  const imageStore = getStore("review-photos");
  const uploadedImages: { id: number; blobKey: string; fileName: string }[] = [];

  if (Array.isArray(body.images)) {
    for (const img of body.images.slice(0, 5)) {
      const ct = String(img.contentType || "").toLowerCase();
      if (!ALLOWED_TYPES.has(ct)) continue;
      if (!img.dataBase64) continue;

      let bytes: Uint8Array;
      try {
        bytes = decodeBase64(img.dataBase64);
      } catch {
        continue;
      }
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_SIZE) continue;

      const blobKey = newBlobKey();
      await imageStore.set(blobKey, bytes, {
        metadata: { contentType: ct, fileName: img.fileName || "photo" },
      });

      const [row] = await db
        .insert(reviewImages)
        .values({
          reviewId,
          blobKey,
          fileName: String(img.fileName || "photo").slice(0, 255),
          contentType: ct,
        })
        .returning();
      uploadedImages.push({ id: row.id, blobKey, fileName: row.fileName });
    }
  }

  // Notify the shop admins when a customer leaves a brand-new review. Updates to an
  // existing review are intentionally quiet so edits don't re-alert. Both the in-app
  // notification and the email are best-effort — a failure here must not fail the review.
  if (isNewReview) {
    try {
      await db.insert(notifications).values({
        type: "review",
        title: "New review",
        body: `${userName || "A customer"} left a ${roundedRating}-star review`,
        relatedId: String(reviewId),
      });
    } catch (err) {
      console.error("Review notification insert failed", err);
    }

    try {
      const reviewData = {
        userName,
        userEmail: user.email || "",
        orderId,
        rating: roundedRating,
        reviewText,
        imageCount: uploadedImages.length,
      };
      const emailRes = await sendEmail({
        to: ALERT_RECIPIENTS,
        replyTo: user.email || ALERT_RECIPIENTS[0],
        subject: `New review: ${userName || "a customer"} — ${roundedRating}★`,
        html: renderReviewEmailHtml(reviewData),
        text: renderReviewEmailText(reviewData),
      });
      if (!emailRes.ok) {
        console.error(`Review alert email failed (${emailRes.provider} ${emailRes.status}): ${emailRes.error || ""}`);
      }
    } catch (err) {
      console.error("Review alert email send failed", err);
    }
  }

  return Response.json({ ok: true, reviewId, images: uploadedImages });
};
