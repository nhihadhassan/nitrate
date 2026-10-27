# Nitrate

**Your films. Their films. Our films.**

Nitrate is a social film diary and Movie Club app. Track films, keep reviews and
lists, discover people with shared taste, and organize a group from movie ideas
through picks, a wheel or vote, scheduling, and post-film discussion.

The local folder is still named **LetterCube**; the product, repository and
hosting project are **Nitrate**. Product copy comes from `src/lib/brand.ts`.

[Live app](https://nitrate-iota.vercel.app) ·
[GitHub](https://github.com/nhihadhassan/nitrate)

## Current capabilities

- Accounts, onboarding, profiles, following, blocking, notifications and moderation.
- Film/person discovery with TMDB and a local catalogue fallback.
- Diary entries, rewatches, half-star ratings, reviews, watchlists and private notes.
- Collaborative lists, saved/pinned lists, physical/digital ownership and account export.
- Personal statistics and yearly recaps, club Yearbooks and revocable snapshot shares.
- Recommendations, Tonight, taste comparison, taste circles and followed filmmakers.
- Movie Clubs with optional themed rounds, sealed member picks, blind voting,
  random wheel selection, explicit manager overrides, screening polls, RSVP,
  calendars, diary logging, ratings, discussion, reactions and optional Tenor GIFs.
- Network discovery with evidence thresholds and administrative feature controls.
- Light/dark themes, responsive navigation, reduced motion and a PWA offline fallback.

This is a source-backed inventory, reviewed **27 October 2026**. Unit/build checks
and public HTTP checks have different coverage from signed-in, database, email
and physical-device testing. See [verification and known gaps](docs/STATUS.md),
including the unresolved club aggregate blind-rating gap.

## Documentation

| Document | Purpose |
| --- | --- |
| [Features](docs/FEATURES.md) | Implemented workflows and conditional capabilities |
| [Status](docs/STATUS.md) | Current verification evidence and limits |
| [Handoff](docs/HANDOFF.md) | Setup, environment, migrations, deployment and operations |
| [Storage](docs/STORAGE.md) | Safe disk cleanup, recovery and worktree policy |
| [Roadmap](docs/ROADMAP.md) | Remaining gaps and priorities |
| [Design & product](DESIGN_AND_PRODUCT.md) | Product principles, surfaces, design and accessibility |
| [Product brief](PRODUCT.md) | Audience and concise product direction |
| [Decisions](docs/DECISIONS.md) | Architecture, constraints and historical decisions |
| [Club terminology](docs/CLUB_TERMINOLOGY.md) | Member-facing vocabulary |
| [Renaming](docs/RENAMING.md) | Brand configuration and infrastructure identifiers |
| [Historical releases](docs/releases/README.md) | Original 1.3–2.0 dossiers and evidence |
| [Design references](docs/design-reference/README.md) | Preserved mockups, outside public runtime assets |

## Stack and architecture

Next.js 15.5.x (App Router), React 19, strict TypeScript, Tailwind CSS 4,
PostgreSQL, Drizzle, custom sessions, TMDB, Resend and optional Tenor.
Use Node **20 or newer**; the lockfile is authoritative for dependency versions.

```text
src/app/          Pages, API routes, server rendering and gated dev fixtures
src/components/   Shared UI and interactive workflows
src/server/       Services, actions, auth, privacy, providers, email and import
src/server/db/    63 tables in the dedicated nitrate schema
src/lib/          Shared helpers, pure domain logic and brand configuration
drizzle/          Ordered SQL migrations and metadata, 0000 through 0017
scripts/          Deliberate migration and local storage commands
test/             Test guards and storage safety tests
```

Authorization belongs on the server. Film state changes share one service;
rewatches retain independent history. Ratings use integers 1–10 for half stars.
The wheel animates a server-committed result; replay does not draw again.
Managers can explicitly edit the pool or choose/correct a result before the
night is completed, with permission checks and attribution.

## Local setup

```bash
npm ci
cp .env.example .env.local
# Set DATABASE_URL and SESSION_SECRET; configure optional providers as needed.
npm run db:migrate   # confirm this is the intended development database first
npm run dev
```

Database migrations are deliberate, never an app startup side effect. Application
and migration credentials can target a live shared database: read
[Handoff](docs/HANDOFF.md) before running them.

```bash
npm run verify       # TypeScript, lint, unit tests, production build
npm run test:storage # Temporary-repository cleanup safety checks
```

Database integration is separate and opt-in:

```bash
# Point TEST_DATABASE_URL at a distinct disposable database first.
npm run db:migrate:test
npm run test:integration
```

## Free up local disk space

```bash
npm run storage:report -- --worktree-dependencies
npm run storage:clean -- --worktree-dependencies
```

These commands inspect the main checkout and registered worktrees inside
`.claude/worktrees/`. Cleanup removes generated build/test files and, with the
flag above, duplicate worktree dependencies. It preserves source, dirty work,
Git history, environment files, images and worktree checkouts. To also remove
the main dependency install, add `--dependencies`, then restore it with `npm ci`.
See [Storage](docs/STORAGE.md) for safeguards and recovery.

## Attribution and licence

Film metadata and artwork are provided by [TMDB](https://www.themoviedb.org/).
This product uses the TMDB API but is not endorsed or certified by TMDB.
Released under the [MIT License](LICENSE).
