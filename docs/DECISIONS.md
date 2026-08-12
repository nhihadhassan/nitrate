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
| 11 Aug 2026 | Resend configured on the verified `nhihadhassan.ca` domain; live send confirmed |
| 11 Aug 2026 | `NEXT_PUBLIC_SITE_URL` set in production — the first test email carried `localhost` links |

---

## Things deliberately not done

- **Real-time push.** No websockets or SSE. Pages are fresh on load and on your
  own actions; someone else's spin does not move your screen until you refresh.
- **Renaming internal identifiers** after the rebrand — schema, role, cookie,
  localStorage keys, CSS animation names. Costs a migration and signs everyone
  out, for nothing a user can see.
- **TV and episode tracking**, per the PRD's non-goals.
- **ML recommendations.** Club suggestions are explainable heuristics; the data
  model can support more later.
- **Collaborative lists.** The `list_collaborators` table exists and is unused,
  so the feature can be added without a rebuild.
- **Unrestricted DMs.** Club discussions cover the need with far less moderation
  surface.
