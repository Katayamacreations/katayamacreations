import { pgTable, serial, text, timestamp, numeric, integer } from "drizzle-orm/pg-core";

export const reviews = pgTable("reviews", {
  id: serial().primaryKey(),
  orderId: text("order_id").notNull(),
  userId: text("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  userName: text("user_name").notNull().default(""),
  rating: numeric("rating", { precision: 2, scale: 1 }).notNull(),
  reviewText: text("review_text").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const reviewImages = pgTable("review_images", {
  id: serial().primaryKey(),
  reviewId: integer("review_id").notNull().references(() => reviews.id),
  blobKey: text("blob_key").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});
