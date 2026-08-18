ALTER TYPE "nitrate"."activity_type" ADD VALUE IF NOT EXISTS 'club_member_joined';
ALTER TYPE "nitrate"."activity_type" ADD VALUE IF NOT EXISTS 'club_movie_picked';
ALTER TYPE "nitrate"."activity_type" ADD VALUE IF NOT EXISTS 'club_screening_rsvp';
ALTER TYPE "nitrate"."activity_type" ADD VALUE IF NOT EXISTS 'club_rating_submitted';

ALTER TABLE "nitrate"."selection_rounds"
  ADD COLUMN IF NOT EXISTS "picks_closed_at" timestamp with time zone;
