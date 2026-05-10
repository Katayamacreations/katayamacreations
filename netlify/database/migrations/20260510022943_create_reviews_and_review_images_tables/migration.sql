CREATE TABLE "review_images" (
	"id" serial PRIMARY KEY,
	"review_id" integer NOT NULL,
	"blob_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY,
	"order_id" text NOT NULL,
	"user_id" text NOT NULL,
	"user_email" text NOT NULL,
	"user_name" text DEFAULT '' NOT NULL,
	"rating" numeric(2,1) NOT NULL,
	"review_text" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "review_images" ADD CONSTRAINT "review_images_review_id_reviews_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id");