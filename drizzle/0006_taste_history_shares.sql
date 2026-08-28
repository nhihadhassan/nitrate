-- Nitrate 1.4 — Your Taste & Our History
-- Public links store only a SHA-256 digest of a 32-byte bearer token. Payloads
-- are sanitized, immutable snapshots; every read still re-checks source
-- visibility and blocking before returning them.

CREATE TABLE IF NOT EXISTS "nitrate"."share_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "schema_version" smallint DEFAULT 1 NOT NULL,
  "token_hash" bytea NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source_user_id" uuid,
  "compared_user_id" uuid,
  "source_club_id" uuid,
  "source_year" smallint,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  "last_accessed_at" timestamp with time zone,
  CONSTRAINT "share_snapshot_kind_check" CHECK ("kind" IN ('personal_recap', 'club_yearbook', 'taste_comparison')),
  CONSTRAINT "share_snapshot_schema_check" CHECK ("schema_version" >= 1)
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "nitrate"."share_snapshots" ADD CONSTRAINT "share_snapshots_owner_fk" FOREIGN KEY ("owner_user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "nitrate"."share_snapshots" ADD CONSTRAINT "share_snapshots_source_user_fk" FOREIGN KEY ("source_user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "nitrate"."share_snapshots" ADD CONSTRAINT "share_snapshots_compared_user_fk" FOREIGN KEY ("compared_user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "nitrate"."share_snapshots" ADD CONSTRAINT "share_snapshots_club_fk" FOREIGN KEY ("source_club_id") REFERENCES "nitrate"."clubs"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "share_snapshots_token_hash_key" ON "nitrate"."share_snapshots" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "share_snapshots_owner_idx" ON "nitrate"."share_snapshots" USING btree ("owner_user_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "share_snapshots_source_idx" ON "nitrate"."share_snapshots" USING btree ("source_user_id", "source_club_id", "revoked_at");
