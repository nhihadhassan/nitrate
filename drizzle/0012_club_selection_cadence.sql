ALTER TABLE "nitrate"."clubs" ADD COLUMN IF NOT EXISTS "selection_cadence" text DEFAULT 'weekly' NOT NULL;--> statement-breakpoint
ALTER TABLE "nitrate"."clubs" ALTER COLUMN "selection_cadence" SET DEFAULT 'monthly';--> statement-breakpoint
ALTER TABLE "nitrate"."clubs" ADD COLUMN IF NOT EXISTS "custom_cadence_days" smallint;--> statement-breakpoint
ALTER TABLE "nitrate"."clubs" ADD CONSTRAINT "clubs_selection_cadence_check" CHECK ("selection_cadence" IN ('weekly','biweekly','monthly','custom'));--> statement-breakpoint
ALTER TABLE "nitrate"."clubs" ADD CONSTRAINT "clubs_custom_cadence_days_check" CHECK ("custom_cadence_days" IS NULL OR "custom_cadence_days" BETWEEN 2 AND 365);--> statement-breakpoint
ALTER TABLE "nitrate"."selection_rounds" ADD COLUMN IF NOT EXISTS "round_start_at" timestamp with time zone;--> statement-breakpoint
UPDATE "nitrate"."selection_rounds" SET "round_start_at" = "created_at" WHERE "round_start_at" IS NULL;--> statement-breakpoint
ALTER TABLE "nitrate"."selection_rounds" ALTER COLUMN "round_start_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "nitrate"."selection_rounds" ALTER COLUMN "round_start_at" SET NOT NULL;--> statement-breakpoint
INSERT INTO "nitrate"."club_member_permissions" ("club_id","user_id","permission","granted_by_user_id")
SELECT cm."club_id", cm."user_id", 'manage_club_settings', c."owner_id"
FROM "nitrate"."club_members" cm
JOIN "nitrate"."clubs" c ON c."id" = cm."club_id"
WHERE cm."role" IN ('owner','admin') AND cm."status" = 'active'
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "nitrate"."clubs"
SET "selection_cadence" = 'monthly', "custom_cadence_days" = NULL, "weekly_pick_enabled" = false, "updated_at" = now()
WHERE (
  "id" = 'b4449f80-7462-4c94-8554-3badcb152a67'
  OR lower(trim("name")) IN ('rachad jullian diyack movie club', 'rachad julijan diyack movie club')
) AND "deleted_at" IS NULL;
