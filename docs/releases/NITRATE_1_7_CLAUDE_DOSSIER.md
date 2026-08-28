# Nitrate 1.7 — Your Permanent Film Library

## Release identity

- Local branch: `codex/nitrate-1-7-library`
- Recorded parent: `75c955d8884fc0a7c44d55e18820d24ab0cd711c`
- Final verified code payload: `6619d2f08b46f64cc7f1801adfa79660a6012fdc`
- Version: `1.7.0`
- Publication state: local only and unpushed; no production migration, Vercel change, or live mutation was performed

The dossier commit follows the verified payload and changes documentation only.

## Complete implementation

- `/api/account/export` authenticates the owner and streams a private ZIP with `no-store`, `nosniff`, and `noindex` headers. The archive is never persisted as a public asset.
- `ExportManifestV1` and the stable Nitrate 1.0 JSON contract record every file, record count, cursor batch size, privacy exclusions, user identity, and generation time.
- Large diary, film-state, list-item, and ownership sections are read in stable primary-key cursor batches of 250 and appended as streams. The complete ZIP is not buffered in application memory.
- The archive contains an account index, complete section JSON, human diary/film/ownership CSVs, and Letterboxd-compatible diary/watchlist files where the concepts map without invention. Nitrate half-star integers map exactly to Letterboxd 0.5–5 ratings.
- The export includes the owner’s profile, dated diary, watched/liked/rated/watchlist state, private watchlist notes, reviews, tags, favourites, owned lists, ownership copies, memberships, Movie Ideas contributions, nominations, votes, personal club ratings, and attendance.
- Club discussions and other members’ private records are absent by construction: every source query is owner-scoped and the discussion table is never imported by the exporter.
- Account Settings presents Export prominently and offers it again before deletion.
- Private ownership supports multiple 4K UHD, Blu-ray, DVD, digital, and other copies, each with optional edition, notes, and purchase date. Every create/update/delete query is scoped to the signed-in owner.
- Ownership is surfaced on Film, Watchlist, Explore, Tonight, profile Films, and Movie Club shortlist recommendations.
- Logging retains its quick default path. Optional viewing context is behind a collapsed disclosure and supports cinema, home, friend’s home, Movie Club, festival, travel, and other.
- Films and Diary expose progressive filters for film year, rating, genre, tags, director, rewatch, liked state, club, viewing context, runtime, ownership, and region-aware availability. Provider uncertainty is described honestly and is never converted into a false “unavailable” result.
- A typed import-adapter interface now wraps Letterboxd. IMDb remains intentionally absent until representative fixtures and demand support a safe mapping.

## Migration

Apply after 1.6 and only after review:

1. `drizzle/0009_permanent_film_library.sql`

The migration is additive. It adds nullable `diary_entries.viewing_context` with a closed check constraint and supporting index, plus `ownership_copies` with owner/movie foreign keys, checked formats, multi-copy rows, private metadata, and lookup indexes. It rewrites and deletes no existing row.

## Dependencies and environment

- Added runtime dependency: `archiver@7.0.1` for streamed ZIP output.
- Added development type dependency: `@types/archiver@6.0.3`.
- New production environment variables: none.
- Verification-only: existing `TEST_DATABASE_URL` / optional `TEST_DIRECT_DATABASE_URL`.
- Synthetic route gate: `ALLOW_SYNTHETIC_FIXTURES=true`; the route is a 404 otherwise.
- `npm audit --omit=dev` reports four inherited high-severity advisories in the existing Next/Drizzle dependency line. Their offered fixes require major framework/ORM upgrades and were not mixed into 1.7. Archiver introduced no reported production advisory. Treat the upgrade as separate reviewed work.

## Verification record

Recorded on 2026-08-27:

| Gate | Result |
| --- | --- |
| `npm run verify` | Pass: typecheck, lint with zero warnings, 10 unit files / 50 tests, production build |
| `git diff --check` | Pass |
| `npm run test:integration` | Safely skipped 26 prepared tests because no `TEST_DATABASE_URL` exists |
| `db:migrate:test` missing-URL guard | Pass; refused before connecting and printed no credentials |
| 320/390/768/1440 synthetic browser pass | Pass; document width matched viewport at every size |
| Sparse/normal/imported/high-volume fixtures | Pass |
| Private/blocked fixtures | Pass; privacy exclusions remained visible and no foreign private data appeared |
| Failure fixture | Pass; UI failed closed and synthetic ZIP returned 503 |
| ZIP snapshot | Pass; valid archive, manifest schema 1.0, cursor batch 250, and both privacy exclusions false-by-type |
| Keyboard/screen-reader semantics | Pass for new details/form/labels/nav/summary controls and semantic headings/lists |
| Touch targets | Pass at phone widths for new interactive controls |
| Reduced motion | Pass; new library/export interactions add no required animation |
| Console | No errors or warnings across fixture states |

The prepared isolated-database test proves multi-copy ownership, owner scoping, removal, and viewing-context persistence. Claude must run it after applying migrations through `0009` to a clean isolated database.

## Privacy and performance review

- The account route requires a valid unsuspended session. It exposes neither a share token nor a durable download URL.
- Export selects a safe profile projection and never includes password hashes, sessions, media bytes, moderation internals, discussions, or another member’s records.
- Letterboxd files leave unsupported URIs blank rather than fabricating mappings.
- The high-volume fixture represents 48,400 diary entries and 21,700 films. Runtime memory is bounded by a 250-row database page, the current serialized chunk, and Archiver’s stream buffers.
- The build reports `/api/account/export` at 102 kB shared server route load, `/film/[slug]` at 134 kB, `/watchlist` at 122 kB, and owner Films/Diary at 119 kB first load.
- Availability filtering is deliberately request-bounded and is only resolved when selected. A provider outage remains unknown and is described as such.

## Known limitations and deferrals

- IMDb import is deferred; only the adapter foundation is included.
- Provider availability is volatile and region-specific. It is not exported as permanent personal history.
- Countries and provider-usage statistics remain deferred because the required reliable source data does not exist.
- Export creation is immediate and streamed; no background-job history or long-lived download link is added.
- The inherited Next/Drizzle audit findings require a separate compatibility-tested upgrade, not an unreviewed transitive patch inside this release.

## Claude review and promotion procedure

1. Compare `75c955d8884fc0a7c44d55e18820d24ab0cd711c..6619d2f08b46f64cc7f1801adfa79660a6012fdc`.
2. Reconcile later `main` drift only for 1.7; do not combine any 2.0 Network migration or flags.
3. From a clean isolated database, apply migrations through `0009`, then run `npm run test:integration`, `npm run verify`, and `git diff --check`.
4. Review and apply only `0009_permanent_film_library.sql` to the confirmed production database.
5. Merge 1.7 into GitHub `main`, push, and wait for the existing Vercel production deployment.
6. Verify GitHub, Vercel, and canonical-domain commit parity before functional QA.
7. Download a small and large private export. Inspect the manifest, JSON/CSV/Letterboxd files, memory profile, owner scoping, response headers, and interrupted-download behavior.
8. Verify that password/session data, discussions, and another member’s private data are absent.
9. Verify multi-copy create/update/delete on all formats and ownership context on Film, Watchlist, Explore, Tonight, Films, and Movie Ideas.
10. Verify quick logging is unchanged, viewing context is optional/editable, and every Films/Diary filter works alone and in combination.
11. Offer a successful export before testing deletion in a disposable account.
12. Stop before 2.0 if migration, privacy, archive integrity, memory, filtering, canonical-domain, or rollback gates fail.

## Rollback

- Redeploy the 1.6 application commit. The nullable column and new ownership table are additive and may remain during incident response.
- If export is the incident source, disable access to `/api/account/export` at the application layer while retaining ownership data; do not delete user archives or ownership rows as an emergency shortcut.
- Remove 1.7 data only with a later reviewed retention-aware cleanup migration.

The 1.7 code is complete. Claude should review and promote it, not recreate Your Permanent Film Library from the roadmap.
