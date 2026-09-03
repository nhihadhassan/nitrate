ALTER TYPE "nitrate"."activity_type" ADD VALUE IF NOT EXISTS 'club_pick_deadline_extended';--> statement-breakpoint
ALTER TYPE "nitrate"."notification_type" ADD VALUE IF NOT EXISTS 'club_pick_deadline_extended';--> statement-breakpoint
ALTER TABLE "nitrate"."nominations" ADD COLUMN IF NOT EXISTS "submitted_by_user_id" uuid;--> statement-breakpoint
UPDATE "nitrate"."nominations" SET "submitted_by_user_id" = "nominated_by_user_id" WHERE "submitted_by_user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "nitrate"."nominations" ALTER COLUMN "submitted_by_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "nitrate"."nominations" ADD CONSTRAINT "nominations_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "nitrate"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nitrate"."club_member_permissions" (
  "club_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "permission" text NOT NULL,
  "granted_by_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "club_member_permissions_pk" PRIMARY KEY("club_id","user_id","permission"),
  CONSTRAINT "club_member_permissions_club_fk" FOREIGN KEY ("club_id") REFERENCES "nitrate"."clubs"("id") ON DELETE cascade,
  CONSTRAINT "club_member_permissions_user_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade,
  CONSTRAINT "club_member_permissions_granted_by_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "club_member_permissions_user_idx" ON "nitrate"."club_member_permissions" USING btree ("club_id","user_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nitrate"."selection_round_participants" (
  "round_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "participating" boolean DEFAULT true NOT NULL,
  "updated_by_user_id" uuid NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "selection_round_participants_pk" PRIMARY KEY("round_id","user_id"),
  CONSTRAINT "selection_round_participants_round_fk" FOREIGN KEY ("round_id") REFERENCES "nitrate"."selection_rounds"("id") ON DELETE cascade,
  CONSTRAINT "selection_round_participants_user_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade,
  CONSTRAINT "selection_round_participants_updated_by_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "round_participants_user_idx" ON "nitrate"."selection_round_participants" USING btree ("user_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nitrate"."selection_round_reveals" (
  "round_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "method" text NOT NULL,
  "revealed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "selection_round_reveals_pk" PRIMARY KEY("round_id","user_id"),
  CONSTRAINT "selection_round_reveals_round_fk" FOREIGN KEY ("round_id") REFERENCES "nitrate"."selection_rounds"("id") ON DELETE cascade,
  CONSTRAINT "selection_round_reveals_user_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade,
  CONSTRAINT "selection_round_reveals_method_check" CHECK ("method" IN ('animated','skipped'))
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nitrate"."selection_round_reactions" (
  "round_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "reaction" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "selection_round_reactions_pk" PRIMARY KEY("round_id","user_id"),
  CONSTRAINT "selection_round_reactions_round_fk" FOREIGN KEY ("round_id") REFERENCES "nitrate"."selection_rounds"("id") ON DELETE cascade,
  CONSTRAINT "selection_round_reactions_user_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade,
  CONSTRAINT "selection_round_reactions_check" CHECK ("reaction" IN ('love','excited','curious'))
);--> statement-breakpoint
INSERT INTO "nitrate"."club_member_permissions" ("club_id","user_id","permission","granted_by_user_id")
SELECT cm."club_id", cm."user_id", permission, c."owner_id"
FROM "nitrate"."club_members" cm
JOIN "nitrate"."clubs" c ON c."id" = cm."club_id"
CROSS JOIN unnest(ARRAY['extend_submission_deadline','start_wheel','submit_picks_for_others','edit_movie_night','invite_members','remove_members','manage_weekly_participation']::text[]) AS permission
WHERE cm."role" IN ('owner','admin')
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "nitrate"."selection_round_participants" ("round_id","user_id","participating","updated_by_user_id")
SELECT sr."id", cm."user_id", true, sr."created_by_user_id"
FROM "nitrate"."selection_rounds" sr
JOIN "nitrate"."club_members" cm ON cm."club_id" = sr."club_id" AND cm."status" = 'active'
WHERE sr."status" IN ('draft','nominations_open','voting_open','winner_selected','screening_scheduled','completed')
ON CONFLICT DO NOTHING;
