ALTER TABLE "nitrate"."diary_entries"
  ADD COLUMN "viewing_context" text;

ALTER TABLE "nitrate"."diary_entries"
  ADD CONSTRAINT "diary_entries_viewing_context_check"
  CHECK ("viewing_context" IS NULL OR "viewing_context" IN ('cinema', 'home', 'friend_home', 'club', 'festival', 'travel', 'other'));

CREATE INDEX "diary_viewing_context_idx"
  ON "nitrate"."diary_entries" USING btree ("user_id", "viewing_context", "watched_date");

CREATE TABLE "nitrate"."ownership_copies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "movie_id" uuid NOT NULL,
  "format" text NOT NULL,
  "edition" text,
  "notes" text,
  "purchased_on" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ownership_copies_format_check" CHECK ("format" IN ('4k_uhd', 'blu_ray', 'dvd', 'digital', 'other')),
  CONSTRAINT "ownership_copies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "nitrate"."users"("id") ON DELETE cascade,
  CONSTRAINT "ownership_copies_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "nitrate"."movies"("id") ON DELETE cascade
);

CREATE INDEX "ownership_user_movie_idx" ON "nitrate"."ownership_copies" USING btree ("user_id", "movie_id");
CREATE INDEX "ownership_user_format_idx" ON "nitrate"."ownership_copies" USING btree ("user_id", "format");
