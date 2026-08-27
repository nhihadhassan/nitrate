-- Nitrate 1.3 — Movie Night Utility
-- Region preference + email preferences, a private watchlist note, and the
-- movie-night availability poll (an optional step between a winner being
-- chosen and a screening being scheduled — it never inserts a screening
-- itself; only scheduleScreening does).

ALTER TABLE "nitrate"."users" ADD COLUMN IF NOT EXISTS "watch_region" text;--> statement-breakpoint
ALTER TABLE "nitrate"."users" ADD COLUMN IF NOT EXISTS "email_movie_night_reminders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "nitrate"."users" ADD COLUMN IF NOT EXISTS "email_picks_and_voting" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "nitrate"."users" ADD COLUMN IF NOT EXISTS "email_winner_selected" boolean DEFAULT true NOT NULL;--> statement-breakpoint

ALTER TABLE "nitrate"."user_movie_state" ADD COLUMN IF NOT EXISTS "note" text;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "nitrate"."poll_status" AS ENUM('open', 'closed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "nitrate"."poll_availability" AS ENUM('yes', 'maybe', 'no');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "nitrate"."screening_polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"status" "nitrate"."poll_status" DEFAULT 'open' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nitrate"."screening_poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nitrate"."screening_poll_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"option_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"availability" "nitrate"."poll_availability" NOT NULL,
	"responded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "nitrate"."screening_polls" ADD CONSTRAINT "screening_polls_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "nitrate"."clubs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "nitrate"."screening_polls" ADD CONSTRAINT "screening_polls_round_id_selection_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "nitrate"."selection_rounds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "nitrate"."screening_polls" ADD CONSTRAINT "screening_polls_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "nitrate"."movies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "nitrate"."screening_polls" ADD CONSTRAINT "screening_polls_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "nitrate"."screening_poll_options" ADD CONSTRAINT "screening_poll_options_poll_id_screening_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "nitrate"."screening_polls"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "nitrate"."screening_poll_responses" ADD CONSTRAINT "screening_poll_responses_option_id_screening_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "nitrate"."screening_poll_options"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "nitrate"."screening_poll_responses" ADD CONSTRAINT "screening_poll_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "polls_club_idx" ON "nitrate"."screening_polls" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "polls_round_idx" ON "nitrate"."screening_polls" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "poll_options_poll_idx" ON "nitrate"."screening_poll_options" USING btree ("poll_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "poll_response_key" ON "nitrate"."screening_poll_responses" USING btree ("option_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "poll_responses_user_idx" ON "nitrate"."screening_poll_responses" USING btree ("user_id");
