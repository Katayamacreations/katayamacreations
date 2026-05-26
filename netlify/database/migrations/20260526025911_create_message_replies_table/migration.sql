CREATE TABLE "message_replies" (
	"id" serial PRIMARY KEY,
	"message_id" integer NOT NULL,
	"sender_type" text NOT NULL,
	"sender_name" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "message_replies" ADD CONSTRAINT "message_replies_message_id_messages_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id");