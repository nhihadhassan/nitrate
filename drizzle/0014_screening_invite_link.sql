-- An external invite page for a movie night (Partiful, an event page, a group
-- chat thread) alongside the existing watch link.
--
-- Purely additive: one nullable column. Existing rows read as NULL, which is
-- the same "no invite link" every screening has today, and nothing reads it
-- until the UI does.
ALTER TABLE "nitrate"."screenings" ADD COLUMN IF NOT EXISTS "invite_link" text;
