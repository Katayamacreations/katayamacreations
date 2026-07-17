CREATE TABLE "user_carts" (
	"user_id" text PRIMARY KEY,
	"user_email" text DEFAULT '' NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"subtotal" numeric(10,2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
