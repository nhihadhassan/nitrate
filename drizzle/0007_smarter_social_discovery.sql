-- Nitrate 1.5 — Smarter Social Discovery

ALTER TABLE "nitrate"."users" ADD COLUMN IF NOT EXISTS "taste_circle_feed_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "nitrate"."taste_circle_members" (
  "user_id" uuid NOT NULL,
  "member_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "taste_circle_members_pk" PRIMARY KEY("user_id", "member_user_id"),
  CONSTRAINT "taste_circle_not_self" CHECK ("user_id" <> "member_user_id")
);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "nitrate"."taste_circle_members" ADD CONSTRAINT "taste_circle_owner_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "nitrate"."taste_circle_members" ADD CONSTRAINT "taste_circle_member_fk" FOREIGN KEY ("member_user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "taste_circle_member_idx" ON "nitrate"."taste_circle_members" USING btree ("member_user_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "nitrate"."recommendation_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "kind" text NOT NULL,
  "reason_kind" text,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "restored_at" timestamp with time zone,
  CONSTRAINT "recommendation_feedback_target_check" CHECK ("target_type" IN ('user', 'movie', 'person')),
  CONSTRAINT "recommendation_feedback_kind_check" CHECK ("kind" IN ('hide', 'already_know', 'less_like_this'))
);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "nitrate"."recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_user_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "recommendation_feedback_active_key" ON "nitrate"."recommendation_feedback" USING btree ("user_id", "target_type", "target_id", "kind") WHERE "restored_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recommendation_feedback_expiry_idx" ON "nitrate"."recommendation_feedback" USING btree ("user_id", "expires_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "nitrate"."person_follows" (
  "user_id" uuid NOT NULL,
  "person_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "person_follows_pk" PRIMARY KEY("user_id", "person_id")
);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "nitrate"."person_follows" ADD CONSTRAINT "person_follows_user_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "nitrate"."person_follows" ADD CONSTRAINT "person_follows_person_fk" FOREIGN KEY ("person_id") REFERENCES "nitrate"."people"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_follows_person_idx" ON "nitrate"."person_follows" USING btree ("person_id");
