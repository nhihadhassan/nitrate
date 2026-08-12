# Rachad Julijan Diyack Movie Club

A social film diary for the group — and the movie club that runs itself.

It does the things a film-tracking network has to do: log what you watch, keep a
diary worth re-reading, rate and review, build lists and watchlists, follow
people whose taste you trust. Then it adds the part nobody else does properly —
**Movie Clubs**, where everyone submits one film a week, **the wheel picks at
random**, and the group gets an email telling them what they're watching.

**Live:** https://nitrate-nhihadhassan-2432s-projects.vercel.app — public, no sign-in wall.

---

## Documentation

| Doc | What's in it |
| --- | --- |
| **[HANDOFF](docs/HANDOFF.md)** | Where everything lives, env vars, what blocks other people using it, how to run and deploy, gotchas |
| **[FEATURES](docs/FEATURES.md)** | Everything that is built and working |
| **[DECISIONS](docs/DECISIONS.md)** | Why the code looks like this, the bugs found and how, deployment history |
| **[ROADMAP](docs/ROADMAP.md)** | What to do next, in order of what actually unblocks people |
| **[RENAMING](docs/RENAMING.md)** | How to change the product's name — one constant, five exceptions, five minutes |

---

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router), React 19, TypeScript strict | Server components keep authorisation on the server by default |
| Styling | Tailwind CSS v4 | CSS-first tokens; themes swap variables, so components need no `dark:` variants |
| Database | PostgreSQL (Supabase), Drizzle ORM | Typed SQL without hiding the query plan |
| Auth | Hand-rolled sessions: scrypt hashes, SHA-256 session tokens, httpOnly cookies | No dependency churn, sliding expiry, full control |
| Film data | TMDB behind a provider interface | Swappable; falls back to our own catalogue during an outage |
| Email | Resend behind a transport interface, with a durable outbox | A provider outage delays delivery instead of losing it |
| Images | `next/image` for posters; avatars and club art in Postgres, served immutably | Zero object-storage setup for an MVP |
| Tests | Vitest — unit plus integration against a real database | The interesting bugs are in SQL |

## Architecture

```
src/
  app/           Routes. Server components by default.
  components/    UI. Client components only where interaction demands it.
  server/
    db/          Drizzle schema — one `nitrate` Postgres schema, 43 tables
    auth/        Password hashing, sessions
    movies/      Provider abstraction (TMDB + offline) and canonical ingestion
    email/       Transport, templates and the outbox queue
    services/    Business logic. Everything a route or action needs lives here.
    actions/     Server actions: validate → authorise → call a service
    import/      Letterboxd CSV pipeline
  lib/           Framework-free helpers, plus brand.ts (the only place the name lives)
```

Three rules the codebase holds to — expanded in [DECISIONS](docs/DECISIONS.md):

1. **Authorisation is in the query, not the component.** Privacy predicates
   compose into the `WHERE` clause, so a private diary entry, list or club never
   leaves Postgres.
2. **One write path per concept.** Everything that changes your relationship
   with a film calls `updateFilmState`, so aggregates and activity cannot drift.
3. **The club round is a real state machine.** Every transition is checked
   server-side, so a stale tab cannot reopen voting on a completed screening.

## Notable behaviour

- **Ratings are integer half-stars, 1–10.** Never floats. `7` is ★★★½.
- **Watched ≠ logged.** Mark a film seen without inventing a date.
- **Rewatches never overwrite history.** Each viewing keeps its own date, rating
  and review; a film's average counts each person once, not once per viewing.
- **Votes and club ratings are blind at the transport layer.** While a round is
  open the server does not send totals to the client at all.
- **The wheel cannot be re-rolled.** The server picks with `crypto.randomInt` and
  commits behind a row lock; spinning again replays the same result.
- **Imports are idempotent** and never silently discard an unmatched row.
- **Provider outages degrade, they do not fail.**

## Running locally

```bash
npm install
cp .env.example .env.local   # see docs/HANDOFF.md §3 for every key
npm run db:migrate
npm run dev
```

```bash
npm run verify               # typecheck → lint → 43 tests → production build
```

The Vitest suite includes an integration file that runs against `DATABASE_URL`
when one is present, covering the full club cycle (submit → spin → email, and
nominate → vote → reveal → schedule → RSVP → complete → blind-rate → discuss),
privacy enforcement, blocking, aggregate correctness, rate limiting and import
idempotency. It namespaces and cleans up everything it creates.

## Attribution

Film metadata and artwork are provided by [TMDB](https://www.themoviedb.org/).
This product uses the TMDB API but is not endorsed or certified by TMDB.
