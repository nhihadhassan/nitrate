CREATE TYPE "nitrate"."email_status" AS ENUM('queued', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "nitrate"."selection_mode" AS ENUM('vote', 'wheel');--> statement-breakpoint
CREATE TABLE "nitrate"."email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"to_email" text NOT NULL,
	"template" text NOT NULL,
	"subject" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "nitrate"."email_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider_message_id" text,
	"error" text,
	"dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "nitrate"."clubs" ADD COLUMN "weekly_pick_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "nitrate"."clubs" ADD COLUMN "weekly_pick_day" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "nitrate"."clubs" ADD COLUMN "weekly_pick_hour" smallint DEFAULT 18 NOT NULL;--> statement-breakpoint
ALTER TABLE "nitrate"."clubs" ADD COLUMN "weekly_pick_last_opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "nitrate"."selection_rounds" ADD COLUMN "mode" "nitrate"."selection_mode" DEFAULT 'vote' NOT NULL;--> statement-breakpoint
ALTER TABLE "nitrate"."selection_rounds" ADD COLUMN "spun_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "nitrate"."selection_rounds" ADD COLUMN "spin_seed" text;--> statement-breakpoint
ALTER TABLE "nitrate"."email_deliveries" ADD CONSTRAINT "email_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_status_idx" ON "nitrate"."email_deliveries" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_dedupe_key" ON "nitrate"."email_deliveries" USING btree ("dedupe_key");