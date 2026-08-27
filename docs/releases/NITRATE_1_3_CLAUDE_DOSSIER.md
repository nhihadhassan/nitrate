# Nitrate 1.3 — Movie Night Utility

## Release identity

- Local branch: `feat/movie-night-utility`
- Recorded parent: `885ae7ea6cd57794ebbbbb35af61b4fbf57b2973`
- Final verified code payload: `deaaa3aa8232e631302c045cf14091a1ac9abebd`
- Version: `1.3.0`
- Publication state: local only; not pushed, merged, tagged, migrated in production, or deployed by Codex

The documentation commit follows the verified payload and does not alter runtime code. At review time, use `git rev-parse feat/movie-night-utility` to capture the local dossier commit, and compare runtime code through the payload hash above.

## Complete implementation

- Region-aware streaming, rent, buy, and free availability is implemented through the movie-provider abstraction and cached by region. Provider outages and offline mode return no invented availability.
- Settings exposes the resolved automatic region and an explicit region override.
- Admins may propose two to eight future screening times. Active club members may answer yes, maybe, or no and revise their answer while the poll is open.
- A partial unique index permits one open poll per round. Confirming a time claims the poll and creates the screening in one database transaction, preventing two stale admin tabs from scheduling twice.
- The poll UI explains its ranking: yes counts strongest, maybe breaks ties, and the earliest time wins a remaining tie. It never silently schedules a result.
- Scheduled screenings receive one in-app reminder and, for opted-in members, one durable outbox email inside the 24-hour window.
- Email settings separately control movie-night reminders, picks and voting, and winning-film messages. Club mute controls continue to apply.
- Watchlist notes are private, owner-only, limited to 500 characters, and update only while the film remains on that owner’s watchlist.
- The installable web app includes a manifest, generated 192/512 PNG icons, maskable icon metadata, an account install surface, and a service worker.
- The service worker caches only the public offline shell and static assets. It never caches authenticated HTML, API responses, diary data, club data, or watchlist notes.
- The offline screen states that personal data requires a connection.

## Migration

Apply only this release migration after reviewing it:

1. `drizzle/0005_movie_night_utility.sql`

It is additive. It adds the watch region, three email preference columns, the private watchlist note, poll enums/tables, foreign keys, indexes, one-open-poll enforcement, and per-poll time uniqueness.

Use the guarded local sequence before any production work:

```bash
TEST_DATABASE_URL='postgresql://isolated-test-database' npm run db:migrate:test
npm run test:integration
```

The migration command has no fallback to the application database. It refuses a missing URL and refuses a test database whose normalized host, port, and database name match `DATABASE_URL`, `DIRECT_DATABASE_URL`, `POSTGRES_URL`, or `POSTGRES_PRISMA_URL`. It never prints a connection string.

## Dependencies and environment

- Added runtime dependencies: none.
- Added development dependencies: none.
- New required production environment variables: none.
- Verification-only variable: `TEST_DATABASE_URL`.
- Optional direct verification connection: `TEST_DIRECT_DATABASE_URL`.
- Existing `TMDB_API_KEY` or offline provider behavior remains unchanged.
- Existing `CRON_SECRET`, `RESEND_API_KEY`, and daily cron route deliver reminders through the established outbox.

## Verification record

Recorded on 2026-08-27 from the verified payload:

| Gate | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass, zero warnings |
| `npm test` | Pass, 5 files and 35 tests |
| `npm run build` | Pass, Next.js 15.5.23 production build |
| `git diff --check` | Pass |
| Missing test URL guard | Pass; refused before connecting |
| `npm run test:integration` | Safely skipped all 20 tests because this workspace has no `TEST_DATABASE_URL` |
| Local browser, 320/390/768/1440 | Pass after correcting a 320-pixel landing-rail overflow |
| Error overlay and console | None at all four widths; no console errors or warnings |
| Document width | Exact viewport width at all four sizes |
| Keyboard and screen-reader structure | One main landmark, named navigation, ordered H1/H2 structure, and no unnamed visible controls on the public representative route |
| Touch layout | Mobile controls remain at the product’s 44-pixel minimum; poll response controls explicitly use the same minimum |
| Reduced motion | Existing global reduced-motion rules remain active; new poll, note, install, and offline UI adds no motion dependency |
| Install endpoints | Manifest 200, 192px PNG 200, service worker 200 |

Database verification is deliberately not marked pass. Claude must provide a genuinely isolated test database, run the guarded migration, and run the prepared integration suite before production promotion. The suite now covers poll creation, response replacement, aggregate visibility, atomic confirmation, duplicate-confirmation rejection, club lifecycle, blind ratings, imports, privacy, and the existing multi-table invariants.

## Fixtures and states

- Unit fixtures cover empty polls, score ties, firm-yes preference, and deterministic earliest-time selection.
- Integration fixtures create namespaced synthetic users, films, memberships, nominations, poll responses, a screening, attendance, and blind ratings, then tear them down.
- Provider failure uses the existing offline provider and returns no availability section.
- UI copy handles empty availability, open polls, closed/cancelled polls, saving notes, offline mode, and unsupported browser install prompts.
- No production data or live site mutation was used.

## Known limitations and deferrals

- Watch-provider data is only as current and complete as TMDB/JustWatch. Nitrate does not fabricate service deep links.
- Offline mode is an installable shell, not offline access to private user content.
- Reminder dispatch shares the existing daily cron cadence; a late cron remains idempotent but can deliver later than the start of the 24-hour window.
- Country and provider statistics remain deferred.

## Claude review and promotion procedure

1. Confirm the branch is still local and compare `885ae7ea6cd57794ebbbbb35af61b4fbf57b2973..deaaa3aa8232e631302c045cf14091a1ac9abebd`.
2. Inspect any changes made to current `main` after the recorded parent. Rebase or merge only this 1.3 branch’s changes; do not combine 1.4 or later releases.
3. Set `TEST_DATABASE_URL` to a disposable isolated database. Run `npm run db:migrate:test`, `npm run test:integration`, and `npm run verify`.
4. Review `drizzle/0005_movie_night_utility.sql`, confirm the production target, and apply only that migration using the project’s normal reviewed production process.
5. Merge only 1.3 into GitHub `main`, push, and wait for the existing Vercel production deployment. Codex has done none of those operations.
6. Confirm GitHub `main`, the Vercel deployment commit, and the canonical domain all identify the same commit.
7. Verify region settings, film availability, provider failure, poll response replacement, atomic confirmation, reminders, email preferences, private watchlist notes, installability, offline privacy, and representative 320/390/768/1440 layouts.
8. Confirm a second stale admin action cannot create another screening and that no watchlist note is returned to another user.
9. Stop before 1.4 if migration, privacy, delivery, canonical-domain, or representative flow validation fails.

## Rollback

- Application rollback: redeploy the prior production commit and disable access to the new UI while investigating.
- Database rollback: do not drop the additive columns or poll tables during an incident. They are backward-compatible with the prior application. Remove data structures only in a separately reviewed cleanup migration after retention and backup review.
- Email rollback: stop the cron or disable reminder dispatch in code; queued outbox records remain inspectable and idempotent.

The 1.3 code is complete. Claude should review and promote it, not reimplement Movie Night Utility from the roadmap.
