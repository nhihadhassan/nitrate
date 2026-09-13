-- A theme members can be inspired by when nominating for a round (e.g.
-- "Horror", "80s", "Leonardo DiCaprio"), set once when the round starts.
--
-- Purely additive: one nullable column. Existing rounds read as NULL, which
-- is the same "no theme" every round has today, and nothing reads it until
-- the UI does.
ALTER TABLE "nitrate"."selection_rounds" ADD COLUMN IF NOT EXISTS "theme" text;
