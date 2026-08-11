CREATE SCHEMA IF NOT EXISTS "nitrate";
--> statement-breakpoint
CREATE TYPE "nitrate"."activity_type" AS ENUM('film_logged', 'film_watched', 'film_rated', 'film_liked', 'review_created', 'list_created', 'list_updated', 'user_followed', 'club_created', 'club_movie_selected', 'club_screening_scheduled', 'club_screening_completed');--> statement-breakpoint
CREATE TYPE "nitrate"."club_member_status" AS ENUM('active', 'left', 'banned');--> statement-breakpoint
CREATE TYPE "nitrate"."club_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "nitrate"."club_visibility" AS ENUM('private', 'public');--> statement-breakpoint
CREATE TYPE "nitrate"."credit_kind" AS ENUM('cast', 'crew');--> statement-breakpoint
CREATE TYPE "nitrate"."entry_source" AS ENUM('manual', 'import', 'club');--> statement-breakpoint
CREATE TYPE "nitrate"."import_row_kind" AS ENUM('watched', 'diary', 'rating', 'review', 'watchlist', 'list_item');--> statement-breakpoint
CREATE TYPE "nitrate"."import_status" AS ENUM('uploaded', 'matching', 'preview', 'importing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "nitrate"."match_status" AS ENUM('pending', 'matched', 'ambiguous', 'unmatched', 'skipped', 'imported', 'failed');--> statement-breakpoint
CREATE TYPE "nitrate"."media_kind" AS ENUM('avatar', 'club_image', 'list_cover');--> statement-breakpoint
CREATE TYPE "nitrate"."notification_type" AS ENUM('new_follower', 'review_liked', 'list_liked', 'review_comment', 'list_comment', 'comment_reply', 'club_invitation', 'club_member_joined', 'club_nominations_opened', 'club_voting_opened', 'club_voting_ending', 'club_winner_selected', 'club_screening_scheduled', 'club_screening_reminder', 'club_screening_completed', 'club_discussion_reply', 'moderation_action');--> statement-breakpoint
CREATE TYPE "nitrate"."report_category" AS ENUM('spam', 'harassment', 'hate_speech', 'sexual_content', 'violence', 'self_harm', 'spoilers', 'misinformation', 'impersonation', 'other');--> statement-breakpoint
CREATE TYPE "nitrate"."report_status" AS ENUM('open', 'reviewing', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "nitrate"."round_status" AS ENUM('draft', 'nominations_open', 'voting_open', 'winner_selected', 'screening_scheduled', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "nitrate"."rsvp_status" AS ENUM('going', 'maybe', 'cant');--> statement-breakpoint
CREATE TYPE "nitrate"."screening_status" AS ENUM('scheduled', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "nitrate"."subject_type" AS ENUM('user', 'review', 'comment', 'list', 'club', 'club_post');--> statement-breakpoint
CREATE TYPE "nitrate"."user_role" AS ENUM('member', 'moderator', 'admin');--> statement-breakpoint
CREATE TYPE "nitrate"."visibility" AS ENUM('public', 'followers', 'private');--> statement-breakpoint
CREATE TABLE "nitrate"."activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"type" "nitrate"."activity_type" NOT NULL,
	"visibility" "nitrate"."visibility" DEFAULT 'public' NOT NULL,
	"movie_id" uuid,
	"diary_entry_id" uuid,
	"list_id" uuid,
	"club_id" uuid,
	"screening_id" uuid,
	"target_user_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nitrate"."analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nitrate"."attendances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"screening_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rsvp" "nitrate"."rsvp_status",
	"attended" boolean,
	"responded_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "nitrate"."blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "nitrate"."club_discussion_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"screening_id" uuid,
	"parent_id" uuid,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"contains_spoilers" boolean DEFAULT false NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "nitrate"."club_discussion_reactions" (
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_discussion_reactions_post_id_user_id_emoji_pk" PRIMARY KEY("post_id","user_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "nitrate"."club_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"invited_user_id" uuid,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nitrate"."club_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "nitrate"."club_role" DEFAULT 'member' NOT NULL,
	"status" "nitrate"."club_member_status" DEFAULT 'active' NOT NULL,
	"notifications_muted" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nitrate"."club_queue_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"added_by_user_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "nitrate"."club_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"screening_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nitrate"."clubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"image_asset_id" uuid,
	"visibility" "nitrate"."club_visibility" DEFAULT 'private' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"interests" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"owner_id" uuid NOT NULL,
	"invite_code" text NOT NULL,
	"member_count" integer DEFAULT 1 NOT NULL,
	"screening_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "nitrate"."comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subject_type" "nitrate"."subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"parent_id" uuid,
	"body" text NOT NULL,
	"contains_spoilers" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "nitrate"."credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movie_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"kind" "nitrate"."credit_kind" NOT NULL,
	"character" text,
	"department" text,
	"job" text,
	"sort_order" integer DEFAULT 999 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nitrate"."diary_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"watched_date" date NOT NULL,
	"rating" smallint,
	"liked" boolean DEFAULT false NOT NULL,
	"review_text" text,
	"contains_spoilers" boolean DEFAULT false NOT NULL,
	"is_rewatch" boolean DEFAULT false NOT NULL,
	"visibility" "nitrate"."visibility" DEFAULT 'public' NOT NULL,
	"source" "nitrate"."entry_source" DEFAULT 'manual' NOT NULL,
	"screening_id" uuid,
	"import_batch_id" uuid,
	"external_key" text,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "nitrate"."diary_entry_tags" (
	"diary_entry_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "diary_entry_tags_diary_entry_id_tag_id_pk" PRIMARY KEY("diary_entry_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "nitrate"."favorite_films" (
	"user_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "favorite_films_user_id_position_pk" PRIMARY KEY("user_id","position")
);
--> statement-breakpoint
CREATE TABLE "nitrate"."follows" (
	"follower_id" uuid NOT NULL,
	"following_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_id_following_id_pk" PRIMARY KEY("follower_id","following_id")
);
--> statement-breakpoint
CREATE TABLE "nitrate"."genres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nitrate"."import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text DEFAULT 'letterboxd' NOT NULL,
	"status" "nitrate"."import_status" DEFAULT 'uploaded' NOT NULL,
	"file_names" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "nitrate"."import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"kind" "nitrate"."import_row_kind" NOT NULL,
	"raw_title" text NOT NULL,
	"raw_year" integer,
	"raw_uri" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"matched_movie_id" uuid,
	"match_status" "nitrate"."match_status" DEFAULT 'pending' NOT NULL,
	"match_confidence" real,
	"candidates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dedupe_key" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nitrate"."list_collaborators" (
	"list_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"can_edit" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_collaborators_list_id_user_id_pk" PRIMARY KEY("list_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "nitrate"."list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"note" text,
	"added_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nitrate"."list_likes" (
	"user_id" uuid NOT NULL,
	"list_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_likes_user_id_list_id_pk" PRIMARY KEY("user_id","list_id")
);
--> statement-breakpoint
CREATE TABLE "nitrate"."lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"visibility" "nitrate"."visibility" DEFAULT 'public' NOT NULL,
	"is_ranked" boolean DEFAULT false NOT NULL,
	"allow_collaborators" boolean DEFAULT false NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "nitrate"."media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"kind" "nitrate"."media_kind" NOT NULL,
	"mime" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"byte_size" integer NOT NULL,
	"checksum" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nitrate"."moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"subject_type" "nitrate"."subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"report_id" uuid,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nitrate"."movie_genres" (
	"movie_id" uuid NOT NULL,
	"genre_id" uuid NOT NULL,
	CONSTRAINT "movie_genres_movie_id_genre_id_pk" PRIMARY KEY("movie_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE "nitrate"."movies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'tmdb' NOT NULL,
	"provider_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"original_title" text,
	"year" integer,
	"release_date" date,
	"runtime" integer,
	"tagline" text,
	"overview" text,
	"poster_path" text,
	"backdrop_path" text,
	"imdb_id" text,
	"original_language" text,
	"release_status" text,
	"adult" boolean DEFAULT false NOT NULL,
	"provider_popularity" real DEFAULT 0 NOT NULL,
	"provider_vote_average" real DEFAULT 0 NOT NULL,
	"provider_vote_count" integer DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"rating_sum" integer DEFAULT 0 NOT NULL,
	"rating_histogram" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"watch_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"log_count" integer DEFAULT 0 NOT NULL,
	"watchlist_count" integer DEFAULT 0 NOT NULL,
	"details_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nitrate"."nominations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"nominated_by_user_id" uuid NOT NULL,
	"pitch" text,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "nitrate"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"actor_id" uuid,
	"type" "nitrate"."notification_type" NOT NULL,
	"subject_type" "nitrate"."subject_type",
	"subject_id" uuid,
	"club_id" uuid,
	"body" text,
	"url" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nitrate"."people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'tmdb' NOT NULL,
	"provider_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"profile_path" text,
	"known_for_department" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nitrate"."provider_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nitrate"."rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nitrate"."reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"subject_type" "nitrate"."subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"subject_owner_id" uuid,
	"category" "nitrate"."report_category" NOT NULL,
	"details" text,
	"status" "nitrate"."report_status" DEFAULT 'open' NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolved_by_user_id" uuid,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "nitrate"."review_likes" (
	"user_id" uuid NOT NULL,
	"diary_entry_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_likes_user_id_diary_entry_id_pk" PRIMARY KEY("user_id","diary_entry_id")
);
--> statement-breakpoint
CREATE TABLE "nitrate"."screenings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"round_id" uuid,
	"movie_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"location" text,
	"watch_link" text,
	"notes" text,
	"status" "nitrate"."screening_status" DEFAULT 'scheduled' NOT NULL,
	"group_rating_count" integer DEFAULT 0 NOT NULL,
	"group_rating_sum" integer DEFAULT 0 NOT NULL,
	"attendee_count" integer DEFAULT 0 NOT NULL,
	"post_count" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "nitrate"."selection_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"title" text,
	"status" "nitrate"."round_status" DEFAULT 'draft' NOT NULL,
	"nomination_limit_per_member" smallint DEFAULT 1 NOT NULL,
	"nominations_close_at" timestamp with time zone,
	"voting_close_at" timestamp with time zone,
	"winner_nomination_id" uuid,
	"tie_break" text DEFAULT 'earliest_nomination' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "nitrate"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "nitrate"."tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nitrate"."user_movie_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"watched" boolean DEFAULT false NOT NULL,
	"watched_at" timestamp with time zone,
	"liked" boolean DEFAULT false NOT NULL,
	"liked_at" timestamp with time zone,
	"rating" smallint,
	"rated_at" timestamp with time zone,
	"in_watchlist" boolean DEFAULT false NOT NULL,
	"watchlisted_at" timestamp with time zone,
	"log_count" integer DEFAULT 0 NOT NULL,
	"last_watched_date" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nitrate"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"location" text,
	"website_url" text,
	"pronouns" text,
	"avatar_asset_id" uuid,
	"role" "nitrate"."user_role" DEFAULT 'member' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"profile_visibility" "nitrate"."visibility" DEFAULT 'public' NOT NULL,
	"default_entry_visibility" "nitrate"."visibility" DEFAULT 'public' NOT NULL,
	"show_watchlist_publicly" boolean DEFAULT true NOT NULL,
	"allow_follows" boolean DEFAULT true NOT NULL,
	"adult_content" boolean DEFAULT false NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"suspension_reason" text,
	"deleted_at" timestamp with time zone,
	"follower_count" integer DEFAULT 0 NOT NULL,
	"following_count" integer DEFAULT 0 NOT NULL,
	"film_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nitrate"."votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"nomination_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nitrate"."activity_events" ADD CONSTRAINT "activity_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."activity_events" ADD CONSTRAINT "activity_events_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "nitrate"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."activity_events" ADD CONSTRAINT "activity_events_diary_entry_id_diary_entries_id_fk" FOREIGN KEY ("diary_entry_id") REFERENCES "nitrate"."diary_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."activity_events" ADD CONSTRAINT "activity_events_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "nitrate"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."activity_events" ADD CONSTRAINT "activity_events_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."attendances" ADD CONSTRAINT "attendances_screening_id_screenings_id_fk" FOREIGN KEY ("screening_id") REFERENCES "nitrate"."screenings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."attendances" ADD CONSTRAINT "attendances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."club_discussion_posts" ADD CONSTRAINT "club_discussion_posts_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "nitrate"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."club_discussion_posts" ADD CONSTRAINT "club_discussion_posts_screening_id_screenings_id_fk" FOREIGN KEY ("screening_id") REFERENCES "nitrate"."screenings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."club_discussion_posts" ADD CONSTRAINT "club_discussion_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."club_discussion_reactions" ADD CONSTRAINT "club_discussion_reactions_post_id_club_discussion_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "nitrate"."club_discussion_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."club_discussion_reactions" ADD CONSTRAINT "club_discussion_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."club_invites" ADD CONSTRAINT "club_invites_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "nitrate"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."club_invites" ADD CONSTRAINT "club_invites_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."club_invites" ADD CONSTRAINT "club_invites_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."club_members" ADD CONSTRAINT "club_members_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "nitrate"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."club_members" ADD CONSTRAINT "club_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."club_queue_items" ADD CONSTRAINT "club_queue_items_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "nitrate"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."club_queue_items" ADD CONSTRAINT "club_queue_items_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "nitrate"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."club_queue_items" ADD CONSTRAINT "club_queue_items_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."club_ratings" ADD CONSTRAINT "club_ratings_screening_id_screenings_id_fk" FOREIGN KEY ("screening_id") REFERENCES "nitrate"."screenings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."club_ratings" ADD CONSTRAINT "club_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."clubs" ADD CONSTRAINT "clubs_image_asset_id_media_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "nitrate"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."clubs" ADD CONSTRAINT "clubs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "nitrate"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."credits" ADD CONSTRAINT "credits_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "nitrate"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."credits" ADD CONSTRAINT "credits_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "nitrate"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."diary_entries" ADD CONSTRAINT "diary_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."diary_entries" ADD CONSTRAINT "diary_entries_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "nitrate"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."diary_entry_tags" ADD CONSTRAINT "diary_entry_tags_diary_entry_id_diary_entries_id_fk" FOREIGN KEY ("diary_entry_id") REFERENCES "nitrate"."diary_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."diary_entry_tags" ADD CONSTRAINT "diary_entry_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "nitrate"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."favorite_films" ADD CONSTRAINT "favorite_films_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."favorite_films" ADD CONSTRAINT "favorite_films_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "nitrate"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."import_batches" ADD CONSTRAINT "import_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."import_rows" ADD CONSTRAINT "import_rows_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "nitrate"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."import_rows" ADD CONSTRAINT "import_rows_matched_movie_id_movies_id_fk" FOREIGN KEY ("matched_movie_id") REFERENCES "nitrate"."movies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."list_collaborators" ADD CONSTRAINT "list_collaborators_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "nitrate"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."list_collaborators" ADD CONSTRAINT "list_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."list_items" ADD CONSTRAINT "list_items_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "nitrate"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."list_items" ADD CONSTRAINT "list_items_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "nitrate"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."list_items" ADD CONSTRAINT "list_items_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "nitrate"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."list_likes" ADD CONSTRAINT "list_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."list_likes" ADD CONSTRAINT "list_likes_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "nitrate"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."lists" ADD CONSTRAINT "lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."moderation_actions" ADD CONSTRAINT "moderation_actions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "nitrate"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "nitrate"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."movie_genres" ADD CONSTRAINT "movie_genres_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "nitrate"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."movie_genres" ADD CONSTRAINT "movie_genres_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "nitrate"."genres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."nominations" ADD CONSTRAINT "nominations_round_id_selection_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "nitrate"."selection_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."nominations" ADD CONSTRAINT "nominations_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "nitrate"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."nominations" ADD CONSTRAINT "nominations_nominated_by_user_id_users_id_fk" FOREIGN KEY ("nominated_by_user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."reports" ADD CONSTRAINT "reports_subject_owner_id_users_id_fk" FOREIGN KEY ("subject_owner_id") REFERENCES "nitrate"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."reports" ADD CONSTRAINT "reports_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "nitrate"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."review_likes" ADD CONSTRAINT "review_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."review_likes" ADD CONSTRAINT "review_likes_diary_entry_id_diary_entries_id_fk" FOREIGN KEY ("diary_entry_id") REFERENCES "nitrate"."diary_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."screenings" ADD CONSTRAINT "screenings_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "nitrate"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."screenings" ADD CONSTRAINT "screenings_round_id_selection_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "nitrate"."selection_rounds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."screenings" ADD CONSTRAINT "screenings_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "nitrate"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."screenings" ADD CONSTRAINT "screenings_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."selection_rounds" ADD CONSTRAINT "selection_rounds_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "nitrate"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."selection_rounds" ADD CONSTRAINT "selection_rounds_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."user_movie_state" ADD CONSTRAINT "user_movie_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."user_movie_state" ADD CONSTRAINT "user_movie_state_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "nitrate"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."users" ADD CONSTRAINT "users_avatar_asset_id_media_assets_id_fk" FOREIGN KEY ("avatar_asset_id") REFERENCES "nitrate"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."votes" ADD CONSTRAINT "votes_round_id_selection_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "nitrate"."selection_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."votes" ADD CONSTRAINT "votes_nomination_id_nominations_id_fk" FOREIGN KEY ("nomination_id") REFERENCES "nitrate"."nominations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nitrate"."votes" ADD CONSTRAINT "votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_actor_idx" ON "nitrate"."activity_events" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_created_idx" ON "nitrate"."activity_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_club_idx" ON "nitrate"."activity_events" USING btree ("club_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_movie_idx" ON "nitrate"."activity_events" USING btree ("movie_id","created_at");--> statement-breakpoint
CREATE INDEX "analytics_name_idx" ON "nitrate"."analytics_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "analytics_user_idx" ON "nitrate"."analytics_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_key" ON "nitrate"."attendances" USING btree ("screening_id","user_id");--> statement-breakpoint
CREATE INDEX "attendance_user_idx" ON "nitrate"."attendances" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "blocks_blocked_idx" ON "nitrate"."blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "club_posts_screening_idx" ON "nitrate"."club_discussion_posts" USING btree ("screening_id","created_at");--> statement-breakpoint
CREATE INDEX "club_posts_club_idx" ON "nitrate"."club_discussion_posts" USING btree ("club_id","created_at");--> statement-breakpoint
CREATE INDEX "club_posts_parent_idx" ON "nitrate"."club_discussion_posts" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "club_invites_code_key" ON "nitrate"."club_invites" USING btree ("code");--> statement-breakpoint
CREATE INDEX "club_invites_club_idx" ON "nitrate"."club_invites" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "club_invites_user_idx" ON "nitrate"."club_invites" USING btree ("invited_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "club_members_key" ON "nitrate"."club_members" USING btree ("club_id","user_id");--> statement-breakpoint
CREATE INDEX "club_members_user_idx" ON "nitrate"."club_members" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "club_queue_key" ON "nitrate"."club_queue_items" USING btree ("club_id","movie_id");--> statement-breakpoint
CREATE INDEX "club_queue_club_idx" ON "nitrate"."club_queue_items" USING btree ("club_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "club_ratings_key" ON "nitrate"."club_ratings" USING btree ("screening_id","user_id");--> statement-breakpoint
CREATE INDEX "club_ratings_screening_idx" ON "nitrate"."club_ratings" USING btree ("screening_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clubs_slug_key" ON "nitrate"."clubs" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "clubs_invite_code_key" ON "nitrate"."clubs" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "clubs_visibility_idx" ON "nitrate"."clubs" USING btree ("visibility","member_count");--> statement-breakpoint
CREATE INDEX "comments_subject_idx" ON "nitrate"."comments" USING btree ("subject_type","subject_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_user_idx" ON "nitrate"."comments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credits_unique_key" ON "nitrate"."credits" USING btree ("movie_id","person_id","kind",coalesce("job", ''),coalesce("character", ''));--> statement-breakpoint
CREATE INDEX "credits_movie_idx" ON "nitrate"."credits" USING btree ("movie_id","kind","sort_order");--> statement-breakpoint
CREATE INDEX "credits_person_idx" ON "nitrate"."credits" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "diary_user_date_idx" ON "nitrate"."diary_entries" USING btree ("user_id","watched_date","created_at");--> statement-breakpoint
CREATE INDEX "diary_movie_idx" ON "nitrate"."diary_entries" USING btree ("movie_id","created_at");--> statement-breakpoint
CREATE INDEX "diary_review_idx" ON "nitrate"."diary_entries" USING btree ("movie_id","like_count");--> statement-breakpoint
CREATE UNIQUE INDEX "diary_external_key" ON "nitrate"."diary_entries" USING btree ("user_id","external_key");--> statement-breakpoint
CREATE UNIQUE INDEX "diary_screening_key" ON "nitrate"."diary_entries" USING btree ("user_id","screening_id");--> statement-breakpoint
CREATE INDEX "det_tag_idx" ON "nitrate"."diary_entry_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_user_movie_key" ON "nitrate"."favorite_films" USING btree ("user_id","movie_id");--> statement-breakpoint
CREATE INDEX "follows_following_idx" ON "nitrate"."follows" USING btree ("following_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "genres_slug_key" ON "nitrate"."genres" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "genres_provider_key" ON "nitrate"."genres" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "import_batches_user_idx" ON "nitrate"."import_batches" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "import_rows_dedupe_key" ON "nitrate"."import_rows" USING btree ("batch_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "import_rows_batch_idx" ON "nitrate"."import_rows" USING btree ("batch_id","match_status");--> statement-breakpoint
CREATE UNIQUE INDEX "list_items_unique_key" ON "nitrate"."list_items" USING btree ("list_id","movie_id");--> statement-breakpoint
CREATE INDEX "list_items_order_idx" ON "nitrate"."list_items" USING btree ("list_id","position");--> statement-breakpoint
CREATE INDEX "list_items_movie_idx" ON "nitrate"."list_items" USING btree ("movie_id");--> statement-breakpoint
CREATE INDEX "list_likes_list_idx" ON "nitrate"."list_likes" USING btree ("list_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lists_user_slug_key" ON "nitrate"."lists" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "lists_popular_idx" ON "nitrate"."lists" USING btree ("visibility","like_count");--> statement-breakpoint
CREATE INDEX "lists_user_idx" ON "nitrate"."lists" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "media_owner_idx" ON "nitrate"."media_assets" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "mod_actions_subject_idx" ON "nitrate"."moderation_actions" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "mod_actions_actor_idx" ON "nitrate"."moderation_actions" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "movie_genres_genre_idx" ON "nitrate"."movie_genres" USING btree ("genre_id");--> statement-breakpoint
CREATE UNIQUE INDEX "movies_provider_key" ON "nitrate"."movies" USING btree ("provider","provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "movies_slug_key" ON "nitrate"."movies" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "movies_title_idx" ON "nitrate"."movies" USING btree (lower("title"));--> statement-breakpoint
CREATE INDEX "movies_year_idx" ON "nitrate"."movies" USING btree ("year");--> statement-breakpoint
CREATE INDEX "movies_popularity_idx" ON "nitrate"."movies" USING btree ("provider_popularity");--> statement-breakpoint
CREATE INDEX "movies_rating_idx" ON "nitrate"."movies" USING btree ("rating_count","rating_sum");--> statement-breakpoint
CREATE UNIQUE INDEX "nominations_round_movie_key" ON "nitrate"."nominations" USING btree ("round_id","movie_id");--> statement-breakpoint
CREATE INDEX "nominations_round_idx" ON "nitrate"."nominations" USING btree ("round_id","created_at");--> statement-breakpoint
CREATE INDEX "nominations_user_idx" ON "nitrate"."nominations" USING btree ("nominated_by_user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "nitrate"."notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "nitrate"."notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_key" ON "nitrate"."notifications" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "people_provider_key" ON "nitrate"."people" USING btree ("provider","provider_id");--> statement-breakpoint
CREATE INDEX "people_slug_idx" ON "nitrate"."people" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "people_name_idx" ON "nitrate"."people" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "provider_cache_expiry_idx" ON "nitrate"."provider_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "nitrate"."reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_subject_idx" ON "nitrate"."reports" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_reporter_subject_key" ON "nitrate"."reports" USING btree ("reporter_id","subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "review_likes_entry_idx" ON "nitrate"."review_likes" USING btree ("diary_entry_id");--> statement-breakpoint
CREATE INDEX "screenings_club_time_idx" ON "nitrate"."screenings" USING btree ("club_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "screenings_status_idx" ON "nitrate"."screenings" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "screenings_movie_idx" ON "nitrate"."screenings" USING btree ("movie_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_club_number_key" ON "nitrate"."selection_rounds" USING btree ("club_id","round_number");--> statement-breakpoint
CREATE INDEX "rounds_club_status_idx" ON "nitrate"."selection_rounds" USING btree ("club_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_key" ON "nitrate"."sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "nitrate"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "nitrate"."sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_slug_key" ON "nitrate"."tags" USING btree ("user_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "ums_user_movie_key" ON "nitrate"."user_movie_state" USING btree ("user_id","movie_id");--> statement-breakpoint
CREATE INDEX "ums_watchlist_idx" ON "nitrate"."user_movie_state" USING btree ("user_id","in_watchlist","watchlisted_at");--> statement-breakpoint
CREATE INDEX "ums_watched_idx" ON "nitrate"."user_movie_state" USING btree ("user_id","watched");--> statement-breakpoint
CREATE INDEX "ums_movie_idx" ON "nitrate"."user_movie_state" USING btree ("movie_id");--> statement-breakpoint
CREATE INDEX "ums_rating_idx" ON "nitrate"."user_movie_state" USING btree ("movie_id","rating");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "nitrate"."users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_key" ON "nitrate"."users" USING btree (lower("username"));--> statement-breakpoint
CREATE INDEX "users_created_idx" ON "nitrate"."users" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "votes_round_user_key" ON "nitrate"."votes" USING btree ("round_id","user_id");--> statement-breakpoint
CREATE INDEX "votes_nomination_idx" ON "nitrate"."votes" USING btree ("nomination_id");