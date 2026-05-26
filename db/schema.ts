import { pgTable, serial, text, timestamp, numeric, integer, date, boolean } from "drizzle-orm/pg-core";

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

export const notifications = pgTable("notifications", {
  id: serial().primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  relatedId: text("related_id").notNull().default(""),
  userId: text("user_id").notNull().default(""),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial().primaryKey(),
  userId: text("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  userName: text("user_name").notNull().default(""),
  subject: text("subject").notNull().default(""),
  body: text("body").notNull(),
  adminReply: text("admin_reply"),
  repliedAt: timestamp("replied_at"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
