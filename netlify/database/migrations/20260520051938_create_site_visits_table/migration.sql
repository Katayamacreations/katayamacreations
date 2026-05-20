CREATE TABLE "site_visits" (
	"id" serial PRIMARY KEY,
	"visit_date" date NOT NULL,
	"path" text DEFAULT '/' NOT NULL,
	"country" text DEFAULT 'Unknown' NOT NULL,
	"country_code" text DEFAULT '' NOT NULL,
	"city" text DEFAULT 'Unknown' NOT NULL,
	"latitude" numeric(9,6),
	"longitude" numeric(9,6),
	"created_at" timestamp DEFAULT now()
);
