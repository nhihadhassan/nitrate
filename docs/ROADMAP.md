# Next steps

Ordered by what actually unblocks people, not by what is most interesting to
build.

---

## Now

The three launch blockers are cleared: the site is public, Resend is configured
against a verified domain and verified with a live send, and the deploy token
was left in place by choice.

What is still worth doing soon:

- **Clear the test data** — one account (`ninaverity`) with an undeliverable
  `@nitrate.test` address, and one club. Say the word and it can be wiped.
- **Make yourself an admin** so `/admin` is reachable (SQL in `docs/HANDOFF.md` §7).

The GitHub repo is connected to Vercel for push-to-deploy (the "manual CLI
runs" note here was stale — every push to `main` deploys on its own). CI now
runs `npm run verify` on every pull request and on `main` (`.github/workflows/ci.yml`).

## Next — the obvious gaps

**Installable on phones.** A web app manifest, icons and a service worker would
let the club add it to their home screen and have it feel like an app. Small
job, high perceived payoff for a group that will mostly use this on mobile.

**Email notification preferences.** Members can mute a whole club, but cannot
choose to get the winner email and skip the submissions nudge. As more email
types are added this becomes necessary rather than nice.

**Screening reminders.** `getScreeningsNeedingReminder` and the
`reminderSentAt` column already exist and are unused. The cron could send "movie
night is tomorrow" with almost no new code.

**Restore a precise weekly time.** Currently the weekly round triggers on a
weekday only, because Vercel Hobby caps cron at daily. On Pro, restore the
hourly schedule and re-enable the `weeklyPickHour` picker — the column is still
there.

**Rename the Vercel project.** Repo, project and URL still say `nitrate`. Purely
cosmetic; changes the live URL, and needs account-level permissions.

---

## Later — genuinely valuable, genuinely more work

**Data export.** The PRD promises users own their history. Import exists; export
does not. CSV and JSON of diary, ratings, reviews, lists and watchlist.

**Advanced statistics.** Per-year breakdowns, most-rewatched, highest-rated
decade, taste compatibility between members. The data is all there.

**Annual recap.** Shareable end-of-year cards. A natural moment for a group like
this and an organic reason to come back.

**Group recommendation engine.** Club suggestions are currently three
explainable heuristics. The data model supports scoring across member
watchlists, ratings and club history — the PRD's "94% group match" idea.

**Streaming availability.** "Where can we actually watch this tonight" is the
question the queue cannot answer. Region-aware, via properly licensed provider
data.

**Collaborative lists.** `list_collaborators` exists and is unused; the feature
can be added without touching the schema.

**Close friends.** A trusted audience narrower than followers, for diary entries
and reviews. The visibility enum would need a fourth value and an audience table.

---

## Health and maintenance

- **Error monitoring.** Vercel's runtime errors caught two production bugs, but
  something like Sentry would give stack traces against source maps and alerting.
- **Integration tests, when run, still write to a real database.** They now
  require their own `TEST_DATABASE_URL` (distinct from `DATABASE_URL`; see
  `test/setup-db.ts`) and are opt-in via `npm run test:integration`, so
  `npm run verify` and CI never touch a database — but pointing
  `TEST_DATABASE_URL` at a proper Supabase branch rather than a hand-run
  scratch database would still be safer than what's there today.
- **Session cleanup.** `pruneExpiredSessions` and `pruneRateLimits` exist but are
  never called. Add them to the daily cron.
- **A benign warning in production logs.** `TimeoutNegativeWarning` from
  postgres.js timer bookkeeping on frozen serverless instances. Harmless, noisy;
  tuning `idle_timeout` would quiet it.
