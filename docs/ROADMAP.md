# Next steps

Ordered by what actually unblocks people, not by what is most interesting to
build.

---

## Now — before anyone else can use it

These are configuration, not code. All three are in `docs/HANDOFF.md` §4.

1. **Turn off Vercel Deployment Protection.** Until this is done, friends hit an
   SSO wall. One toggle in project settings.
2. **Configure Resend** (`RESEND_API_KEY`, `EMAIL_FROM` on a verified domain).
   Until then, club emails queue but never leave the building.
3. **Rotate the credentials that passed through chat** — the Vercel deploy token
   and, if you want to be thorough, the TMDB key.

Worth doing at the same time:

- **Connect the GitHub repo to Vercel** for push-to-deploy. Deploys are
  currently manual CLI runs.
- **Clear the test data** — one account (`ninaverity`) and one club. Say the word
  and it can be wiped.

---

## Next — the obvious gaps

**Live updates during a spin.** The single biggest gap against expectations. If
two people are on the club page and one spins, the other should see it happen.
Simplest honest version: poll the round endpoint every few seconds while a round
is open. Better: an SSE endpoint per club. This is the difference between
"synced" and "real time" and it is a real piece of work, not a flag.

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
- **CI.** `npm run verify` passes locally and is never enforced. A GitHub Action
  on pull requests would stop a regression reaching production.
- **Integration tests write to the live database.** They clean up after
  themselves, but pointing them at a Supabase branch or scratch project would be
  safer.
- **Session cleanup.** `pruneExpiredSessions` and `pruneRateLimits` exist but are
  never called. Add them to the daily cron.
- **A benign warning in production logs.** `TimeoutNegativeWarning` from
  postgres.js timer bookkeeping on frozen serverless instances. Harmless, noisy;
  tuning `idle_timeout` would quiet it.
