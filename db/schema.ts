import { pgTable, serial, text, timestamp, numeric, integer, date } from "drizzle-orm/pg-core";

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

export const siteVisits = pgTable("site_visits", {
  id: serial().primaryKey(),
  visitDate: date("visit_date").notNull(),
  path: text("path").notNull().default("/"),
  country: text("country").notNull().default("Unknown"),
  countryCode: text("country_code").notNull().default(""),
  city: text("city").notNull().default("Unknown"),
  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }),
  createdAt: timestamp("created_at").defaultNow(),
});
