# Nitrate

A social film diary, and the movie club that runs itself.

Nitrate does the things a film-tracking network has to do — log what you watch,
keep a diary worth re-reading, rate and review, build lists and watchlists,
follow people whose taste you trust — and adds the part nobody else does
properly: **Movie Clubs**, where a group gets a shared queue, nomination rounds,
blind voting, scheduled movie nights with RSVPs, blind post-screening ratings, a
private discussion, and a permanent shared history.

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router), React 19, TypeScript strict | Server components keep authorisation on the server by default |
| Styling | Tailwind CSS v4 | CSS-first tokens; themes swap variables, so components need no `dark:` variants |
| Database | PostgreSQL (Supabase), Drizzle ORM | Typed SQL without hiding the query plan |
| Auth | Hand-rolled sessions: scrypt hashes, SHA-256 session tokens, httpOnly cookies | No dependency churn, sliding expiry, full control |
| Film data | TMDB behind a provider interface | Swappable; falls back to our own catalogue during an outage |
| Images | `next/image` for posters; avatars and club art in Postgres, served immutably | Zero object-storage setup for an MVP |
| Tests | Vitest — unit plus integration against a real database | The interesting bugs are in SQL |

## Architecture

```
src/
  app/           Routes. Server components by default.
  components/    UI. Client components only where interaction demands it.
  server/
    db/          Drizzle schema — one `nitrate` Postgres schema, 30 tables
    auth/        Password hashing, sessions
    movies/      Provider abstraction (TMDB + offline) and canonical ingestion
    services/    Business logic. Everything a route or action needs lives here.
    actions/     Server actions: validate → authorise → call a service
    import/      Letterboxd CSV pipeline
  lib/           Framework-free helpers shared by client and server
```

Three rules the codebase holds to:

**Authorisation is in the query, not the component.** Privacy predicates
(`viewableSql`, `notBlockedSql`) compose into the `WHERE` clause, so a private
diary entry, list or club is not fetched and then hidden — it never leaves
Postgres. The integration suite asserts this from the perspective of a stranger,
a follower and a blocked user.

**One write path per concept.** Every route that changes how a user feels about a
film — the film page buttons, the log sheet, the importer, the post-screening
panel — calls `updateFilmState`. Aggregates and activity events cannot drift
because there is nowhere else to change them from.

**The club round is a real state machine.** `ROUND_TRANSITIONS` in
`services/clubs.ts` is the single source of truth; every transition is checked
server-side, so a stale tab cannot reopen voting on a completed screening.

## Notable decisions

- **Ratings are integer half-stars, 1–10.** Never floats. `7` is ★★★½.
- **Watched ≠ logged.** You can mark a film seen without inventing a date; the
  log sheet has a "Seen it, no date" action for exactly this.
- **Rewatches never overwrite history.** Each viewing keeps its own date, rating,
  review and tags. Only the user's *current* rating feeds a film's average, so a
  film's score is one vote per person, not one per viewing.
- **A film's community average is maintained by delta**, with a jsonb histogram,
  so the film page never runs an aggregate over every rating row.
- **Votes are genuinely blind.** While a round is open the server does not send
  vote totals to the client at all — there is nothing to inspect in devtools.
- **Club ratings are blind by default.** Before you submit you see the number of
  ratings in and nothing else. No average to anchor on.
- **Imports are idempotent.** Every diary entry carries a deterministic
  `externalKey`; re-running an import is a no-op, and nothing unmatched is ever
  silently discarded.
- **Wheel picks are decided server-side.** A weekly round can be settled by a
  spin instead of a vote: the server picks with `crypto.randomInt`, commits the
  winner and a seed in one transaction, then the client animates to a result it
  had no hand in choosing. Spinning twice replays the stored outcome, so there
  are no re-rolls from a refresh or a second tab.
- **Email goes through an outbox, not an inline send.** Mail is written in the
  same transaction as the thing that caused it, then drained by an hourly job
  that claims each row before any network call. A provider outage delays
  delivery; a rolled-back action sends nothing.
- **Provider outages degrade, they do not fail.** A circuit breaker falls back to
  our own catalogue and the UI says so plainly.

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, SESSION_SECRET, TMDB_API_KEY
npm run db:migrate
npm run dev
```

### Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Pooled (transaction mode) connection for the app runtime |
| `DIRECT_DATABASE_URL` | migrations | Session-mode connection; supports DDL |
| `SESSION_SECRET` | yes | 32+ random bytes |
| `TMDB_API_KEY` | yes in practice | v4 read token or v3 key. Without it the app runs on its local catalogue only |
| `NEXT_PUBLIC_SITE_URL` | yes | Used for invite links and absolute URLs |
| `RESEND_API_KEY` | for real email | Without it mail queues and prints to the log; the admin outbox still shows it |
| `EMAIL_FROM` | with Resend | Must be on a domain verified with your provider |
| `CRON_SECRET` | in production | Bearer token the weekly-pick cron must present |

## Verification

```bash
npm run verify   # typecheck → lint → tests → production build
```

The Vitest suite includes an integration file that runs against `DATABASE_URL`
if one is present, covering the whole club cycle (nominate → vote → reveal →
schedule → RSVP → complete → blind-rate → discuss), privacy enforcement,
blocking, aggregate correctness and import idempotency. It namespaces and cleans
up everything it creates.

## Attribution

Film metadata and artwork are provided by [TMDB](https://www.themoviedb.org/).
This product uses the TMDB API but is not endorsed or certified by TMDB.
