# Next steps

Ordered by what actually unblocks people, not by what is most interesting to
build.

---

## Now

The three launch blockers are cleared: the site is public, Resend is configured
against a verified domain and verified with a live send, and the deploy token
was left in place by choice.

What is still worth doing soon:

- **Audit test data before removing it.** The database now contains more than
  the original single club, so do not use the old blanket-cleanup assumption.
  Remove known test accounts through the normal account-deletion path only
  after confirming ownership and retained club history.
- **Bootstrap an admin intentionally** so `/admin` is reachable (SQL in
  `docs/HANDOFF.md` §7). No administrator should be inferred from test data.

The GitHub repo is connected to Vercel for push-to-deploy (the "manual CLI
runs" note here was stale — every push to `main` deploys on its own). CI now
runs `npm run verify` on every pull request and on `main` (`.github/workflows/ci.yml`).

## Next — the obvious gaps

**Restore a precise weekly time.** Currently the weekly round triggers on a
weekday only, because Vercel Hobby caps cron at daily. On Pro, restore the
hourly schedule and re-enable the `weeklyPickHour` picker — the column is still
there.

**Rename the Vercel project.** Repo, project and URL still say `nitrate`. Purely
cosmetic; changes the live URL, and needs account-level permissions.

**Push notifications for the PWA.** The manifest and service worker ship
without them by design (see `docs/DECISIONS.md`) — a real push story needs
subscription management and a delivery guarantee, not a small add-on.

---

## Later — genuinely valuable, genuinely more work

**Advanced statistics.** Per-year breakdowns, most-rewatched, highest-rated
decade, and now `viewing_context`/`ownership_copies` (1.7) as new facts to
surface. Taste compatibility between members specifically stays deferred — see
`docs/DECISIONS.md`'s "deliberately not done" list.

**External calendar sync** (Google/Outlook, two-way). The `.ics` download
covers "get it on my calendar"; a live sync is a materially bigger, OAuth-scoped
project for a want nobody has asked for yet.

**Close friends**, as a visibility tier narrower than followers for diary
entries and reviews specifically — distinct from taste circles (1.5), which are
a feed audience, not a privacy level. Would need a fourth value on the
visibility enum and an audience table.

**A precise weather/mood-aware Tonight.** Out of scope for now — the three
current signals (time, genre, availability) plus scope (watchlist vs. broader)
cover the common case without turning the sheet into a questionnaire.

---

## Health and maintenance

- **Compatibility-tested dependency upgrade.** The production dependency audit
  still reports advisories in Drizzle 0.38 and the Next 15/PostCSS chain. The
  available fixes cross compatibility boundaries (Drizzle 0.45 and Next 16),
  so handle them as a dedicated migration with database, build, and browser
  regression coverage rather than folding them into an interface patch.
- **Error monitoring.** Vercel's runtime errors caught two production bugs, but
  something like Sentry would give stack traces against source maps and alerting.
- **Integration tests, when run, still write to a real database.** They now
  require their own `TEST_DATABASE_URL` (distinct from `DATABASE_URL`; see
  `test/setup-db.ts`) and are opt-in via `npm run test:integration`, so
  `npm run verify` and CI never touch a database — but pointing
  `TEST_DATABASE_URL` at a proper Supabase branch rather than a hand-run
  scratch database would still be safer than what's there today.
- **Housekeeping is wired.** The daily Movie Club cron now prunes expired
  sessions and rate-limit counters after opening rounds, dispatching reminders,
  and flushing email.
- **The benign postgres.js timer warning is addressed.** Serverless connection
  teardown is left to the runtime instead of an application idle timer that can
  resume late after an instance freeze.
