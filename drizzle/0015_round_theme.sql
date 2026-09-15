-- A theme a round can carry — genre, actor, director, decade, seasonal, or a
-- club's own custom idea (e.g. "🎃 Spooky Season", "Leonardo DiCaprio Night").
--
-- Purely additive: five nullable columns. Existing rounds read as no theme,
-- which is the same "no theme" every round has today, and nothing reads them
-- until the UI does.
ALTER TABLE "nitrate"."selection_rounds" ADD COLUMN IF NOT EXISTS "theme_id" text;
ALTER TABLE "nitrate"."selection_rounds" ADD COLUMN IF NOT EXISTS "theme_name" text;
ALTER TABLE "nitrate"."selection_rounds" ADD COLUMN IF NOT EXISTS "theme_description" text;
ALTER TABLE "nitrate"."selection_rounds" ADD COLUMN IF NOT EXISTS "theme_type" text;
ALTER TABLE "nitrate"."selection_rounds" ADD COLUMN IF NOT EXISTS "theme_criteria" jsonb;
