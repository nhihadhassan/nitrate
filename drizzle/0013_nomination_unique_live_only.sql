-- Narrow the nomination uniqueness to *live* picks.
--
-- `nominations_round_movie_key` was a plain unique index on (round_id,
-- movie_id), so a withdrawn pick still reserved its film for the rest of the
-- round. `insertPick` only looks for a non-withdrawn duplicate before
-- inserting, so the friendly check passed and the insert then failed with a
-- raw PostgresError — reachable by removing a pick and choosing that film
-- again, by the same member or anyone else.
--
-- The new predicate is strictly looser than the old index, so every row that
-- satisfied the old constraint still satisfies this one: no data can conflict
-- and nothing is deleted.
DROP INDEX IF EXISTS "nitrate"."nominations_round_movie_key";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "nominations_round_movie_key"
  ON "nitrate"."nominations" ("round_id","movie_id")
  WHERE "withdrawn_at" IS NULL;
