-- Nitrate 1.6 — Shared Curation

ALTER TYPE "nitrate"."notification_type" ADD VALUE IF NOT EXISTS 'list_collaboration_invite';--> statement-breakpoint

ALTER TABLE "nitrate"."lists" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "nitrate"."lists" ADD COLUMN IF NOT EXISTS "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "nitrate"."lists" ADD COLUMN IF NOT EXISTS "cloned_from_list_id" uuid;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "nitrate"."lists" ADD CONSTRAINT "lists_clone_source_fk" FOREIGN KEY ("cloned_from_list_id") REFERENCES "nitrate"."lists"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lists_pinned_idx" ON "nitrate"."lists" USING btree ("user_id", "is_pinned", "updated_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "nitrate"."list_collaboration_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "list_id" uuid NOT NULL,
  "inviter_user_id" uuid NOT NULL,
  "invitee_user_id" uuid NOT NULL,
  "role" text DEFAULT 'editor' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "responded_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  CONSTRAINT "list_collab_invite_role_check" CHECK ("role" = 'editor'),
  CONSTRAINT "list_collab_invite_status_check" CHECK ("status" IN ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  CONSTRAINT "list_collab_invite_not_self" CHECK ("inviter_user_id" <> "invitee_user_id")
);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "nitrate"."list_collaboration_invitations" ADD CONSTRAINT "list_collab_invite_list_fk" FOREIGN KEY ("list_id") REFERENCES "nitrate"."lists"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "nitrate"."list_collaboration_invitations" ADD CONSTRAINT "list_collab_invite_inviter_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "nitrate"."list_collaboration_invitations" ADD CONSTRAINT "list_collab_invite_invitee_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "list_collab_invite_pending_key" ON "nitrate"."list_collaboration_invitations" USING btree ("list_id", "invitee_user_id") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "list_collab_invite_inbox_idx" ON "nitrate"."list_collaboration_invitations" USING btree ("invitee_user_id", "status", "expires_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "nitrate"."list_activity" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "list_id" uuid NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "action" text NOT NULL,
  "list_item_id" uuid,
  "movie_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "list_activity_action_check" CHECK ("action" IN ('list_updated', 'item_added', 'item_removed', 'note_updated', 'reordered', 'collaborator_added', 'collaborator_removed', 'cloned', 'bulk_transferred'))
);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "nitrate"."list_activity" ADD CONSTRAINT "list_activity_list_fk" FOREIGN KEY ("list_id") REFERENCES "nitrate"."lists"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "nitrate"."list_activity" ADD CONSTRAINT "list_activity_actor_fk" FOREIGN KEY ("actor_user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "nitrate"."list_activity" ADD CONSTRAINT "list_activity_item_fk" FOREIGN KEY ("list_item_id") REFERENCES "nitrate"."list_items"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "nitrate"."list_activity" ADD CONSTRAINT "list_activity_movie_fk" FOREIGN KEY ("movie_id") REFERENCES "nitrate"."movies"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "list_activity_list_time_idx" ON "nitrate"."list_activity" USING btree ("list_id", "created_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "nitrate"."saved_lists" (
  "user_id" uuid NOT NULL,
  "list_id" uuid NOT NULL,
  "is_pinned" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "saved_lists_pk" PRIMARY KEY ("user_id", "list_id")
);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "nitrate"."saved_lists" ADD CONSTRAINT "saved_lists_user_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "nitrate"."saved_lists" ADD CONSTRAINT "saved_lists_list_fk" FOREIGN KEY ("list_id") REFERENCES "nitrate"."lists"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_lists_user_sort_idx" ON "nitrate"."saved_lists" USING btree ("user_id", "is_pinned", "created_at");
