# Decisions and history

Why the code looks the way it does, and what happened along the way. Written so
a future maintainer can tell a deliberate choice from an accident.

---

## Architectural commitments

Three rules the codebase holds to. Breaking one should feel like a big deal.

### 1. Authorisation lives in the query, not the component

Privacy predicates (`viewableSql`, `notBlockedSql` in `src/server/privacy.ts`)
compose into the `WHERE` clause. A private diary entry, list or club is not
fetched and then hidden — it never leaves Postgres.

*Why:* UI-level filtering is one refactor away from a leak, and it cannot
protect an API route someone adds later. The integration suite asserts this from
the perspective of a stranger, a follower and a blocked user.

### 2. One write path per concept

Every surface that changes how a user feels about a film — the film page
buttons, the log sheet, the importer, the club post-screening panel — calls
`updateFilmState`. Aggregates and activity events cannot drift because there is
nowhere else to change them from.

### 3. The selection round is a real state machine

`ROUND_TRANSITIONS` in `services/clubs.ts` is the single source of truth, and
every transition is checked server-side. A stale tab cannot reopen voting on a
completed screening.

### 4. A film is linked by its canonical slug, always

Provider results (`ProviderMovieSummary`) never reach a component. Discovery
rails, search, filmographies and browse all pass through
`ensureMoviesFromSummaries`, which bulk-upserts them into real rows in one round
trip and hands back `FilmRef`s; components link with `filmHref` from
`src/lib/links.ts`.

This replaced an arrangement where rails linked by raw TMDB id and the film page
ingested-then-redirected on arrival. It worked, but only just: the first render
of `/film/278` carried the title "Film not found", the redirect happened inside
the streamed RSC payload rather than as an HTTP redirect, and every surface that
forgot the trick dead-ended. Provider-id URLs are still honoured — old links and
anything pasted from TMDB — but they are now a legacy path that returns a real
307, not the way the product talks about films.

Two supporting changes made that possible: `generateMetadata` and the page share
one `cache()`d resolution, and the root `loading.tsx` was replaced by
route-level ones so `/film/[slug]` has no Suspense boundary above it to flush a
shell before the redirect is thrown.

**The corollary is a rule: a route that can `redirect()` must not have a
`loading.tsx` above it.** The boundary flushes the shell first, so the redirect
degrades from a 307 to a 200 plus a client-side navigation. `/watchlist` was
briefly given one and started answering 200 to signed-out requests — no data
leaked, but an auth-gated route should not render at all. Loading states live
only on the public browse routes, which never redirect.

### 5. Blind ratings hold on every surface

A club that rates blind must not see a film's group score anywhere before the
member submits their own — not the club dashboard, the history list, the
screening sidebar or the film page. `revealedScreeningIds` answers that question
once and everything reads through it. Hiding the spread in one place while
printing the average two screens away is not a blind rating, it is a formality.

---

## Notable choices

**Ratings are integer half-stars, 1–10.** Never floats. `7` is ★★★½. Half-star
arithmetic in floating point is a bug factory.

**Watched ≠ logged.** People remember watching a thousand films but not when.
Forcing a date would make them invent one, which poisons the diary.

**Rewatch history is immutable.** Each viewing keeps its own rating and review.
Only the user's *current* rating feeds a film's average, so a film's score is one
vote per person rather than one per viewing.

**Community averages are maintained by delta**, with a jsonb histogram, so a film
page never runs an aggregate over every rating row.

**Votes and club ratings are blind at the transport layer.** While a round is
open the server does not send totals to the client at all — there is nothing to
inspect in devtools. Same for club ratings before you submit.

**The wheel is server-authoritative.** `crypto.randomInt` picks, and the winner
plus a seed are committed in one transaction behind a `SELECT … FOR UPDATE` and a
conditional update. A refresh, a double click, or two people spinning at once all
replay the same result. The client animates to an outcome it had no hand in
choosing.

**Email uses an outbox, not an inline send.** Mail is written in the same
transaction as the thing that caused it, then drained by a worker that claims
each row before any network call. A rolled-back action sends nothing; a provider
outage delays rather than loses.

**Imports are idempotent.** Every diary entry carries a deterministic
`externalKey`. Re-running an import is a no-op, and nothing unmatched is ever
silently discarded.

**Provider outages degrade, they do not fail.** A circuit breaker trips after
repeated TMDB failures and serves the local catalogue, with the UI saying so.

**Avatars and club art live in Postgres** as `bytea`, downscaled client-side to
512px and served immutably from `/media/[id]`. Zero object-storage setup for an
MVP; revisit if the table grows.

**Brand naming is one constant.** `src/lib/brand.ts` is the only place the
product's name appears. Internal identifiers deliberately do not use it. The
name has now changed twice, which paid for the abstraction twice over — the
procedure, including the handful of files that cannot import TypeScript, is in
`docs/RENAMING.md`.

**Live club updates are visibility-aware polling, not a stream.** A club page
mounts `ClubPulseWatcher`, which polls a small `/api/club/[clubId]/pulse`
fingerprint (round status, pick/vote counts, screening status, RSVP and
discussion counts) every 5s while the tab is visible, backs off to 20s after two
idle minutes, and stops after ten — resuming on focus. On a changed fingerprint
it calls `router.refresh()` and raises one quiet toast for the transitions worth
noticing (voting opens, a winner lands, movie night is scheduled). No new
infrastructure: it is membership-gated reads against tables that already exist,
same as every other club page load. SSE was considered and rejected — Vercel
serverless function duration limits make a long-lived stream unreliable here,
and a handful of indexed counts every few seconds is cheap enough not to need
one.

**Streaming availability is annotated, never filtered by SQL.** TMDB's
watch-provider data is the most volatile thing the app serves (a 12h cache TTL,
versus 7/30-day TTLs elsewhere), so a film with no cached row shows no badge
rather than a wrong one, and the catalogue query itself never excludes a film
for lack of availability data. `getAvailabilityForMovies` resolves a *bounded*
candidate set (serve-cached-first, fetch a handful of misses, tolerate
absences) — availability is a signal on top of already-ranked results, not a
`WHERE` clause. Region resolves from the user's own choice, then
`x-vercel-ip-country`, then `'US'`, and is persisted on first resolution so it
stays visible and stable. Per TMDB's terms, the JustWatch attribution line and
the outbound link (TMDB's own watch page — never a fabricated deep link) are
non-negotiable wherever availability renders.

**Tonight has no percentage match scores, ever.** `getTonightRecommendations`
reuses the same closed-union `RecommendationReason` vocabulary as every other
discovery surface — "On your watchlist for 4 months", "2 friends loved this" —
and returns exactly three results, daily-stable via
`stableHash(id + date [+ seed])` so a refresh doesn't reshuffle but "show me
three more" can advance deliberately. Constraints (scope, runtime, genre,
availability) live in the URL as search params, not component state, so
results are shareable and the back button works. The club variant
(`getClubIntelligence`'s shortlist) extends the same scoring core rather than
forking it — availability and runtime signals were added there, and
`onEveryonesRadar`/`nobodyHasSeen`, computed since 1.3's foundation but never
rendered, finally reach the UI. The pick/vote/wheel ritual is unchanged; Tonight
recommends, it does not choose for the club.

**The movie-night poll is optional and funnels through the one legal
scheduling edge.** `createScreeningPoll` requires a round already in
`winner_selected`; `confirmScreeningPollOption` calls the same
`scheduleScreeningRecord` that the direct one-shot form uses, inside one
transaction that also closes the poll — there is no second insert path into
`screenings`, so `assertTransition`'s guarantee that `winner_selected →
screening_scheduled` is the only legal edge still holds. Yes counts double a
maybe (`availabilityScore = yes*2 + maybe`, tie-broken by earliest time) — a
pure, unit-tested function (`src/lib/screening-poll.ts`) rather than a query,
so the "confirm best time" affordance and any future automation agree by
construction. The poll integrates rather than islands: `ClubPulse` carries a
`poll` field so live updates need no client change, `getClubAttention` gained
an `'availability'` kind for Home's "Right now", and `resolveClubState` gives
the `reveal` stage poll-aware copy ("Mark your availability" vs. "Confirm a
time") so the lifecycle strip and the dashboard never disagree with each
other.

**Calendar export is a downloadable file, not a subscribable feed.**
`src/lib/calendar.ts` hand-rolls RFC 5545 with no dependency — line folding at
75 octets, UTF-8-safe, full text escaping, unit-tested against all four rules.
Deliberately *not* a `webcal://` URL: a movie night's time changes rarely
enough that "download again if it moves" is honest and simple, and a
downloadable file needs no long-lived, guessable per-user URL. The route
(`/club/[slug]/screening/[screeningId]/calendar`) mirrors the pulse route's
auth exactly — 401 signed-out, 403/404 non-member — and `DTSTART`/`DTEND` are
emitted in UTC (`Z` suffix) since `scheduled_at` is already `timestamptz`, so
no `VTIMEZONE` block is needed. No `SEQUENCE` line is emitted (screenings have
no `updatedAt` to derive one from); a moved screening is a new download, not an
update a calendar app reconciles automatically — an acceptable simplification
for something a member downloads once, not something the app pushes changes
into.

**Screening reminders reuse the existing outbox and cron; nothing new was
built to send mail.** `getScreeningsNeedingReminder` and `reminderSentAt`
predate this phase and were unused — the only new code is `markScreeningReminderSent`
and calling it before `flushEmailQueue` in the daily cron. `email_deliveries.template`
is a bare `text` column, so the new `screening_reminder` template needed no
migration; the exhaustive `switch` in `renderTemplate` makes forgetting the
`TemplateName` case a compile error. The three new `users` booleans
(`email_movie_night_reminders`, `email_picks_and_voting`, `email_winner_selected`)
are checked as predicates inside `queueClubEmail` before a row is even written,
so an opted-out member's mail is never queued rather than filtered later.

**PWA caching is deliberately conservative.** The service worker precaches only
`/_next/static` and one offline fallback page. Every navigation and every
`/api/*` request is network-only, always — a club's live state, RSVPs and
discussion must never be served from a stale cache. No push notifications: a
reliable push story needs a subscription-management surface and a delivery
guarantee this phase does not build, and a half-working notification is worse
than none.

**Hand-written migrations continue past 0004.** `drizzle-kit generate` cannot
be trusted against this repo's snapshot history (see `0003`/`0004`), so `0005`
through `0010` are hand-written the same way: `IF NOT EXISTS`/`ADD CONSTRAINT …
EXCEPTION WHEN duplicate_object` guards throughout, one `ALTER TYPE … ADD
VALUE` per statement (it cannot share a transaction batch with a use of the new
value), and a journal entry appended by hand. All six are additive only — new
tables, nullable or defaulted columns, new enum values, new indexes — nothing
drops or narrows an existing column. `0000`–`0010` are all applied to
production as of this phase.

---

## The 1.4–2.0 stack

Before this phase, a separate automated process built four further releases
(1.4 "Your Taste & Our History" through 2.0 "Network") on top of an
in-progress 1.3 branch, without review, while the session was paused on a
usage limit. On resuming, the drift was discovered, verified rather than
trusted or discarded — `git diff --stat` against every release's own claims,
independent re-runs of typecheck/lint/test/build — and the user chose to keep
the full stack as the new baseline rather than roll it back. One material gap
surfaced by that review: the 1.3 dossier's "complete implementation" claim was
false (Tonight, calendar export and the integration wiring above were all
missing), and calendar export was missing from every release through 2.0. This
phase finished those specifically, on top of the existing branches rather than
rebuilding them, per the user's direction.

Two of the four kept releases (1.4's `share_snapshots`, covering
`personal_recap`/`club_yearbook`/`taste_comparison`, and 1.5's taste circles)
land squarely inside this project's own stated exclusion list — annual recap,
Club Yearbook and taste-compatibility profiles were explicitly out of scope
for 1.3. They were kept anyway, deliberately: the user was told plainly what
1.4–2.0 contained before choosing to keep it, which is a different thing from
that exclusion never having been raised. The exclusion stands for anything
*not yet built*; it does not retroactively unbuild reviewed, working code the
user asked to keep.

- **1.4 — Your Taste & Our History**: a private annual recap
  (`/u/[username]/recap/[year]`, self-only) and a club yearbook
  (`/club/[slug]/yearbook`) — both deliberately narrative rather than
  competitive: no leaderboard, no ranking of who "won" the year, and a sparse
  year gets an honest "fewer entries, still a real year" instead of a padded
  chapter. Sharing either produces a static, immutable snapshot
  (`share_snapshots`) rather than a live page: public links store only a
  SHA-256 digest of a bearer token, never the token itself, and every read
  still re-checks source visibility and blocking, so a shared link cannot
  expose more than the viewer already could see. `/api/cards/recap/[year]` and
  `/api/cards/yearbook/[clubId]` render the matching Open Graph image.
- **1.5 — Smarter Social Discovery**: a taste circle (`/taste-circle`) — a
  private, chronological feed from up to five people the viewer already
  follows and explicitly trusts, opt-in via `taste_circle_feed_enabled`,
  nobody-can-see-who's-in-it by design, and deliberately not reordering Home.
  A pairwise taste comparison (`/taste/[left]/[right]`), plus
  `recommendation_feedback` ("hide" / "already know" / "less like this",
  scoped and expirable) and `person_follows` feeding it.
- **1.6 — Shared Curation**: real list collaboration —
  `list_collaboration_invitations` (invite/accept/decline/revoke, one editor
  role, no self-invites), `list_activity`, `saved_lists`, plus `lists.version`
  for optimistic-concurrency edits. `list_collaborators`, present in the schema
  since earlier and previously unused, is now the live join table this feature
  writes through.
- **1.7 — Permanent Film Library**: `diary_entries.viewing_context`
  (cinema/home/friend's place/club/festival/travel/other) and
  `ownership_copies` (physical/digital media someone owns), both purely
  additive annotations on data that already existed. Also closes the
  long-standing "data export" roadmap item: `/api/account/export` streams a
  versioned (`schemaVersion: '1.0'`), cursor-batched ZIP of a user's own diary,
  ratings, reviews, lists and watchlist — JSON and CSV, explicitly excluding
  other people's private data and club discussions by construction, not by
  filter.
- **2.0 — Network**: club `join_policy` (invite-only/request/open) with
  `club_join_requests`, `profile_pins`, `@mention` support
  (`discussion_mentions`) and notification grouping (`group_key`/`group_count`
  on `notifications`, so ten reactions to one post become one row), all gated
  behind `product_flags` — a `mode: auto | forced_on | forced_off` per surface
  rather than a shipped-but-hidden feature, with `network_eligibility_daily`
  recording why a surface is or isn't eligible on a given day.

---

## Database isolation

The Supabase org was at its 2-project free limit and both existing projects were
in real use, so this app is a guest in `rachel-tracker` rather than getting its
own project. Isolation is by schema and role:

```sql
create role nitrate_app login password '…';
create schema if not exists nitrate;

revoke all on schema public from nitrate_app;
revoke all on all tables in schema public from nitrate_app;
grant usage, create on schema nitrate to nitrate_app;
grant all on all tables in schema nitrate to nitrate_app;
grant all on all sequences in schema nitrate to nitrate_app;
alter default privileges in schema nitrate grant all on tables to nitrate_app;
alter default privileges in schema nitrate grant all on sequences to nitrate_app;
grant create on database postgres to nitrate_app;   -- migrations create a schema
alter role nitrate_app set search_path = nitrate, public;
```

Verified afterwards that `nitrate_app` is denied on the other apps' tables.

An earlier setup lived in the photography project (`xgonlcjfbidrmdimulgh`) and has
been fully removed — that project is back to stock Supabase schemas.

---

## Bugs found, and how

Three production bugs got through typecheck, lint and the unit suite. All three
were caught by tests that touch a real database, or by driving the deployed app.
This is the argument for keeping both.

### `jsonb_build_object($1, …)` rejects untyped parameters

Rating histograms silently never updated. Postgres cannot infer the type of a
bare parameter in a variadic function. Fixed with explicit `::text` casts.
**Caught by:** the database-backed integration suite.

### Drizzle's raw `db.execute()` cannot serialise a `Date`

Raw execution goes through postgres.js `unsafe()`, which does not serialise JS
values — a `Date` parameter throws `ERR_INVALID_ARG_TYPE` at runtime. Because
`consumeRateLimit` runs on *every* authenticated mutation, this shipped a
production site where signup, login and logging were all dead while everything
was green locally.

Fixed by rebuilding the counter on the typed query builder so Drizzle owns
serialisation, and casting the one remaining raw timestamp explicitly. A
regression test now both counts and trips a real limit.
**Caught by:** signing up on the deployed site.

### Stale film actions, and collapsed histogram bars

The log sheet lives outside `FilmActions`, so refreshing the server component
left the Watch/Like/Watchlist controls showing pre-log state. Separately, every
histogram bar collapsed to its 2px minimum because a percentage height sat
inside an auto-height wrapper.
**Caught by:** actually logging a film on production and looking at it.

### Email links pointed at localhost

The first live test mail was rendered on a laptop, and email templates build
every URL from `env.siteUrl` — there is no request to infer a host from, because
a queue worker has no request. Locally that resolves to `http://localhost:3000`,
so the "Open the club" button was dead in the recipient's inbox.

Fixed by setting `NEXT_PUBLIC_SITE_URL` explicitly in Vercel production instead
of leaning on `VERCEL_PROJECT_PRODUCTION_URL`, which only exists inside Vercel.
**Caught by:** clicking the link in the test email.

### Two non-bugs worth recording

- A page appeared to render an empty `<main>` in the browser tool. It was a 0×0
  viewport in the tool, not a regression.
- `curl` showed `/clubs/new` with no form. It was unauthenticated and correctly
  redirecting to login.

---

## Deployment history

| Date | What |
| --- | --- |
| 11 Aug 2026 | Initial build: full MVP across all five priority flows |
| 11 Aug 2026 | Next.js 15.1.6 → 15.5.23 — Vercel refuses to build versions with open advisories |
| 11 Aug 2026 | Fixed the rate limiter `Date` serialisation bug |
| 11 Aug 2026 | Fixed stale film actions and collapsed histograms |
| 11 Aug 2026 | Database moved from the photography project to `rachel-tracker`; old schema and role dropped |
| 11 Aug 2026 | Weekly wheel picks, outbound email, weekly cron |
| 11 Aug 2026 | Cron moved hourly → daily (Vercel Hobby limit); weekly trigger gates on weekday only |
| 11 Aug 2026 | Wheel labels kept upright instead of rotating radially |
| 11 Aug 2026 | Rebrand from Nitrate to Nhach Bule Dick Movie Club |
| 11 Aug 2026 | Renamed to Rachad Julijan Diyack Movie Club; procedure written up in `docs/RENAMING.md` |
| 11 Aug 2026 | Renamed back to Nitrate, and app branding separated from club branding: a club now names only its own page |
| 11 Aug 2026 | Deployment protection turned off — the site is public |
| 11 Aug 2026 | Resend configured on a verified sending domain; live send confirmed |
| 11 Aug 2026 | `NEXT_PUBLIC_SITE_URL` set in production — the first test email carried `localhost` links |
| 27 Aug 2026 | Product polish pass: cinematic landing page, curated Explore rails, Home "Right now" band, club lifecycle clarity, live club updates via polling, CI added |

---

## Things deliberately not done

- **A push-based real-time transport (websockets/SSE).** Club pages poll a
  small fingerprint endpoint instead — see "Live club updates" above. Everyday
  pages are still fresh on load and on your own actions only.
- **Renaming internal identifiers** after the rebrand — schema, role, cookie,
  localStorage keys, CSS animation names. Costs a migration and signs everyone
  out, for nothing a user can see.
- **TV and episode tracking**, per the PRD's non-goals.
- **ML recommendations, and percentage match scores anywhere.** Every
  recommendation surface — Explore, Tonight, club shortlists — is explainable
  heuristics with a closed-union reason vocabulary, never a score. The data
  model can support more later, but a fabricated precision is worse than an
  honest sentence.
- **Unrestricted DMs.** Club discussions and `@mentions` (2.0) cover the need
  with far less moderation surface. Taste circles (1.5) are a narrower feed
  audience, not messaging.
- **Push notifications for the PWA.** The manifest, icons and a conservative
  static-asset service worker ship; push needs a subscription-management
  surface and a delivery guarantee this phase does not build.
- **External calendar API integration** (Google/Outlook two-way sync). Calendar
  export is a standards-based `.ics` download — see above — deliberately
  simpler and requiring no OAuth scope from a club member.
- **Close friends**, as a visibility tier narrower than followers for diary
  entries and reviews specifically. (Taste circles, above, are adjacent but
  solve a different problem — an opt-in *feed* audience, not a *visibility*
  level — and don't extend the visibility enum.)
- **A major statistics-page redesign.** 1.7's `viewing_context` and
  `ownership_copies` are new facts to eventually surface in stats, not a stats
  overhaul.
- **Social gamification** (streaks, badges, leaderboards) anywhere, including
  in the 2.0 Network surfaces.
