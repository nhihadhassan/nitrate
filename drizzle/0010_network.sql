ALTER TYPE "nitrate"."notification_type" ADD VALUE IF NOT EXISTS 'mention';
ALTER TYPE "nitrate"."notification_type" ADD VALUE IF NOT EXISTS 'club_join_request';
ALTER TYPE "nitrate"."notification_type" ADD VALUE IF NOT EXISTS 'club_join_approved';
ALTER TYPE "nitrate"."notification_type" ADD VALUE IF NOT EXISTS 'club_join_declined';

ALTER TABLE "nitrate"."clubs" ADD COLUMN "join_policy" text NOT NULL DEFAULT 'invite_only';
ALTER TABLE "nitrate"."clubs" ADD CONSTRAINT "clubs_join_policy_check" CHECK ("join_policy" IN ('invite_only', 'request', 'open'));
CREATE INDEX "clubs_public_join_idx" ON "nitrate"."clubs" USING btree ("visibility", "join_policy", "member_count");

ALTER TABLE "nitrate"."users" ADD COLUMN "taste_highlights" text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE "nitrate"."notifications" ADD COLUMN "group_key" text;
ALTER TABLE "nitrate"."notifications" ADD COLUMN "group_count" integer NOT NULL DEFAULT 1;
CREATE INDEX "notifications_group_idx" ON "nitrate"."notifications" USING btree ("user_id", "group_key", "created_at");
CREATE UNIQUE INDEX "notifications_active_group_key" ON "nitrate"."notifications" ("user_id", "group_key") WHERE "group_key" IS NOT NULL;

CREATE TABLE "nitrate"."product_flags" (
  "key" text PRIMARY KEY NOT NULL,
  "mode" text NOT NULL DEFAULT 'auto',
  "unlocked_at" timestamp with time zone,
  "eligible_since" date,
  "evaluated_at" timestamp with time zone,
  "metrics" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_by_user_id" uuid,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "product_flags_mode_check" CHECK ("mode" IN ('auto', 'forced_on', 'forced_off')),
  CONSTRAINT "product_flags_updated_by_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "nitrate"."users"("id") ON DELETE set null
);

INSERT INTO "nitrate"."product_flags" ("key") VALUES
  ('people'), ('community_lists'), ('public_clubs'), ('community_trends')
ON CONFLICT ("key") DO NOTHING;

CREATE TABLE "nitrate"."network_eligibility_daily" (
  "surface" text NOT NULL,
  "day" date NOT NULL,
  "eligible" boolean NOT NULL,
  "metrics" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "network_eligibility_surface_check" CHECK ("surface" IN ('people', 'community_lists', 'public_clubs', 'community_trends')),
  CONSTRAINT "network_eligibility_daily_key" PRIMARY KEY ("surface", "day")
);

CREATE TABLE "nitrate"."club_join_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "club_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "message" text,
  "decided_by_user_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "decided_at" timestamp with time zone,
  CONSTRAINT "club_join_requests_status_check" CHECK ("status" IN ('pending', 'approved', 'declined', 'withdrawn')),
  CONSTRAINT "club_join_requests_club_fk" FOREIGN KEY ("club_id") REFERENCES "nitrate"."clubs"("id") ON DELETE cascade,
  CONSTRAINT "club_join_requests_user_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade,
  CONSTRAINT "club_join_requests_decider_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "nitrate"."users"("id") ON DELETE set null
);
CREATE UNIQUE INDEX "club_join_requests_pending_key" ON "nitrate"."club_join_requests" ("club_id", "user_id") WHERE "status" = 'pending';
CREATE INDEX "club_join_requests_club_idx" ON "nitrate"."club_join_requests" ("club_id", "status", "created_at");
CREATE INDEX "club_join_requests_user_idx" ON "nitrate"."club_join_requests" ("user_id", "status", "created_at");

CREATE TABLE "nitrate"."profile_pins" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "target_type" text NOT NULL,
  "target_id" uuid NOT NULL,
  "position" smallint NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "profile_pins_type_check" CHECK ("target_type" IN ('review', 'list')),
  CONSTRAINT "profile_pins_position_check" CHECK ("position" BETWEEN 1 AND 6),
  CONSTRAINT "profile_pins_user_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade,
  CONSTRAINT "profile_pins_user_position_key" UNIQUE ("user_id", "position"),
  CONSTRAINT "profile_pins_user_target_key" UNIQUE ("user_id", "target_type", "target_id")
);

CREATE TABLE "nitrate"."discussion_mentions" (
  "post_id" uuid NOT NULL,
  "mentioned_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "discussion_mentions_key" PRIMARY KEY ("post_id", "mentioned_user_id"),
  CONSTRAINT "discussion_mentions_post_fk" FOREIGN KEY ("post_id") REFERENCES "nitrate"."club_discussion_posts"("id") ON DELETE cascade,
  CONSTRAINT "discussion_mentions_user_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade
);
CREATE INDEX "discussion_mentions_user_idx" ON "nitrate"."discussion_mentions" ("mentioned_user_id", "created_at");
