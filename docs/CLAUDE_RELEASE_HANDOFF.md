# Nitrate 1.3–2.0 Claude Release Handoff

## Purpose and hard boundary

Codex completed the roadmap as a local, stacked release train. Claude owns review, production migration, GitHub publication, Vercel promotion, and live validation. Codex did not push a branch or tag, merge into `main`, apply a production migration, change Vercel configuration, or mutate the live website.

The code is complete. Claude should review and promote each release in order, not reimplement it from the roadmap.

## Exact branch train

```text
885ae7ea6cd57794ebbbbb35af61b4fbf57b2973  original main checkpoint
└── feat/movie-night-utility
    payload deaaa3aa8232e631302c045cf14091a1ac9abebd
    final   d9d752f3af4cdd17a901d9ab2fe68d547a5ca554
    └── codex/nitrate-1-4-history
        payload 3d94239e706a11a0f3e36d6c0e58f573434ac6ea
        final   40bb31b95d3325706d2e0e09cc58e79ecfcaebbc
        └── codex/nitrate-1-5-discovery
            payload 712fadb525546c711159b3a8419a9d1833f6ef12
            final   0011c3f1242aee3f38aa0ae8c591cef44ada244f
            └── codex/nitrate-1-6-curation
                payload 5aeff72277aa4f06df761804f988b9462394d727
                final   75c955d8884fc0a7c44d55e18820d24ab0cd711c
                └── codex/nitrate-1-7-library
                    payload 6619d2f08b46f64cc7f1801adfa79660a6012fdc
                    final   301b8ee96a19d25b9a4a1f339db6cb29a2e5ae49
                    └── codex/nitrate-2-0-network
                        payload 3887ef46f80c2eafce19da142d023f8015b4b96d
                        final   1080453f197aacfdb7043074a27234b1761e9ecd
                        └── codex/nitrate-roadmap-integration
                            verified payload 78deedbdf3ba625d2bec5fb77bf8181278f19288
```

Every listed release branch is local, clean, and has no upstream tracking branch. The integration documentation commit follows its verified payload and changes documentation only.

## Release dossiers

- [1.3 Movie Night Utility](./releases/NITRATE_1_3_CLAUDE_DOSSIER.md)
- [1.4 Your Taste & Our History](./releases/NITRATE_1_4_CLAUDE_DOSSIER.md)
- [1.5 Smarter Social Discovery](./releases/NITRATE_1_5_CLAUDE_DOSSIER.md)
- [1.6 Shared Curation](./releases/NITRATE_1_6_CLAUDE_DOSSIER.md)
- [1.7 Your Permanent Film Library](./releases/NITRATE_1_7_CLAUDE_DOSSIER.md)
- [2.0 Network](./releases/NITRATE_2_0_CLAUDE_DOSSIER.md)
- [Cross-release integration](./releases/NITRATE_ROADMAP_INTEGRATION.md)

## Complete migration inventory and order

A clean database must apply every file in this exact order:

1. `drizzle/0000_init.sql` — baseline schema
2. `drizzle/0001_wheel_picks_and_email.sql` — baseline Movie Club/email additions
3. `drizzle/0002_blind_ratings_setting.sql` — baseline blind-rating setting
4. `drizzle/0003_club_round_closure_and_activity.sql` — baseline round/activity additions
5. `drizzle/0004_club_rating_reveal_activity.sql` — baseline rating reveal activity
6. `drizzle/0005_movie_night_utility.sql` — Nitrate 1.3
7. `drizzle/0006_taste_history_shares.sql` — Nitrate 1.4
8. `drizzle/0007_smarter_social_discovery.sql` — Nitrate 1.5
9. `drizzle/0008_shared_curation.sql` — Nitrate 1.6
10. `drizzle/0009_permanent_film_library.sql` — Nitrate 1.7
11. `drizzle/0010_network.sql` — Nitrate 2.0

When promoting onto an already current production baseline, review and apply only the migration belonging to the release being promoted. Never use a broad schema push against an unverified target.

## Dependencies and environment

- 1.3–1.6 and 2.0 add no dependency.
- 1.7 adds `archiver@7.0.1` and `@types/archiver@6.0.3` for streamed ZIP creation.
- Required application values remain `DATABASE_URL` and `SESSION_SECRET`; `DIRECT_DATABASE_URL` is the preferred DDL connection.
- Existing optional integrations remain `TMDB_API_KEY`, `MOVIE_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, and `NEXT_PUBLIC_SITE_URL`.
- Verification requires an isolated `TEST_DATABASE_URL`; `TEST_DIRECT_DATABASE_URL` is optional. The guard rejects a connection identity matching any normal app database and never logs credentials.
- `ALLOW_SYNTHETIC_FIXTURES=true` is local verification only. Fixture routes return 404 otherwise.
- 2.0 reuses `CRON_SECRET` for the daily Network evaluator. Codex did not add or alter Vercel scheduling configuration; Claude must connect the route through the approved production scheduler after review.

## Network defaults and evidence gates

All four `product_flags` rows begin in `auto`. `forced_on` enables controlled validation; `forced_off` always disables the surface. Auto requires seven consecutive eligible days. Once automatically unlocked, a surface stays available unless an admin forces it off.

| Surface | Automatic eligibility |
| --- | --- |
| People | 25 eligible public profiles, each with at least 15 ratings; each displayed taste match still needs 10 shared ratings |
| Community lists | 40 public lists with at least 10 films across at least 10 creators |
| Public clubs | 8 public clubs, each with at least 3 active members and 2 screenings completed in the last 180 days |
| Community trends | 50 monthly active users and 500 public logs or public-profile ratings from at least 25 contributors within 90 days |

Synthetic fixtures exercise these decisions but never write evidence or satisfy a live gate. Keep Network in auto or forced off until live aggregate privacy and all thresholds are independently confirmed.

## Verification summary

The final integration payload was checked on 2026-08-27:

| Gate | Result |
| --- | --- |
| `npm run verify` | Pass: typecheck, lint with zero warnings, 12 unit files / 56 tests, production build |
| `git diff --check` | Pass |
| `npm run test:integration` | 27 prepared tests safely skipped because no isolated `TEST_DATABASE_URL` was supplied |
| `npm run db:migrate:test` | Missing-URL guard passed by refusing before connection and printing no credential |
| Cross-release browser matrix | Pass: 1.4 history, 1.5 discovery, 1.6 curation, 1.7 library, and 2.0 Network at 320/390/768/1440; 20/20 had exact viewport/document width and no console warning |
| Network state matrix | Pass: locked, day-six, unlocked, forced-on, forced-off, private-excluded, blocked-excluded, and evaluator-failure |
| Phone touch targets | Pass: no visible control below 44×44 at 320 or 390 pixels after the shared theme-control correction |
| Keyboard/screen-reader structure | Pass for semantic headings, named fixture navigation, status/alert output, form labels, lists, tables, and buttons |
| Reduced motion | Pass: global reduction removes animation/transition duration and new surfaces do not require motion |
| Share images | Pass: history and curation PNGs are valid 1200×630 images with no render warning |
| Export snapshot | Pass: valid ZIP with Nitrate schema 1.0, cursor batch 250, and both foreign-private-data exclusions false |

Release-specific results grow from 35 unit tests / 20 prepared integrations in 1.3 to 56 unit tests / 27 prepared integrations in 2.0. Each dossier records its exact tests, fixtures, privacy boundaries, accessibility checks, and measured route sizes.

Database integration and clean migration are deliberately not marked pass. Claude must supply a genuinely isolated database and run the guarded sequence before the first production promotion:

```bash
npm run db:migrate:test
npm run test:integration
npm run verify
git diff --check
```

## Fixture inventory

- 1.3: offline/provider degradation, region availability, poll creation/response/confirmation, reminders, private notes, PWA assets, mobile layout.
- 1.4: sparse/normal/imported/high-volume recaps, Yearbook, limited/established taste, public/private/blocked/failure shares, 1200×630 card images.
- 1.5: normal/limited overlap, five-person circle cap, private/blocked/failure recommendations, reversible feedback.
- 1.6: normal/pending/stale/imported/high-volume/private/blocked/failure collaboration, version conflicts, contribution attribution, 1200×630 list art.
- 1.7: sparse/normal/imported/high-volume/private/blocked/failure library and export states; the high-volume fixture represents 48,400 diary rows and 21,700 films.
- 2.0: every evidence mode and day threshold plus private, blocked, and failed evaluation paths with synthetic scale counts.

## Measured local performance

- Final shared first-load JavaScript: 102 kB.
- Largest representative route in the final build: `/club/[slug]` at 143 kB first load.
- 1.7: export API 102 kB server route load; Film 134 kB; Watchlist 122 kB; profile Films/Diary 119 kB.
- 2.0: Network 106 kB; Lists 106 kB; Clubs 115 kB; People 115 kB; Trends 119 kB; Admin Network 111 kB.
- Exports query stable 250-row cursor pages and stream the archive instead of buffering it.
- Network aggregation is one bounded daily job. Network discovery responses cap at 40–48 rows and trend results at 24 films.

## Known limitations and deliberate deferrals

- The isolated migration/integration gate remains for Claude because this workspace had no `TEST_DATABASE_URL`.
- Network daily scheduling is not wired in Vercel configuration; the authenticated route and evaluator are complete.
- The inherited Next/Drizzle production advisories documented in 1.7 require a separate compatibility-tested upgrade.
- IMDb import, smart lists, folders, countries, and provider-usage statistics remain deferred pending reliable data/fixtures.
- TV/other media, DMs, engagement feeds, follower leaderboards, generic AI, gamification, native apps, paid infrastructure, monetization, and release notifications for uncertain filmmaker work remain out of scope.

## Drift checklist

Before promoting each branch:

- Fetch current `main` without modifying the release branch.
- Compare current `main` with the dossier’s recorded parent and payload range.
- Classify overlapping schema, service, action, route, component, dependency, and documentation changes.
- Resolve drift only inside the release being promoted; do not combine later releases.
- Preserve Movie Ideas terminology, sealed picks, blind club ratings, source privacy, chronological Home, and private export boundaries.
- Recreate a clean isolated database and apply migrations in order after every conflict resolution.
- Re-run unit, integration, build, privacy, accessibility, responsive, image/export, and failure-state gates.
- Record the resolved production commit before touching the next release.

## Promotion procedure and stop rule

For each dossier, in order:

1. Compare the branch payload with its recorded parent.
2. Resolve later `main` drift without including the next release.
3. Re-run the guarded isolated migration and complete verification.
4. Review and apply only that release’s production migration to the confirmed project.
5. Merge that release into GitHub `main` and push.
6. Wait for the existing Vercel production deployment.
7. Confirm local/GitHub/Vercel commit parity, the canonical domain, privacy boundaries, and representative user flows.
8. Stop before the next release if any migration, privacy, data, deployment, domain, or rollback gate fails.
9. For 2.0, keep Network gated until live eligibility and the seven-day evidence history are confirmed.

## Rollback map

| Release | First response | Application rollback | Data handling |
| --- | --- | --- | --- |
| 1.3 | Disable reminder/provider-sensitive paths if isolated | Redeploy pre-1.3 | Leave additive poll/settings/note columns; clean up only with reviewed migration |
| 1.4 | Revoke affected share snapshots | Redeploy 1.3 | Preserve hashed share/recap evidence; later cleanup only |
| 1.5 | Hide recommendation surfaces | Redeploy 1.4 | Preserve feedback/circle/follow records for recovery |
| 1.6 | Disable collaboration mutations | Redeploy 1.5 | Preserve invitations/activity/version history |
| 1.7 | Disable export route or ownership writes | Redeploy 1.6 | Preserve private ownership/library data; never delete archives as an emergency shortcut |
| 2.0 | Force affected/all Network flags off and stop evaluator | Redeploy 1.7 | Preserve aggregate evidence, requests, mentions, moderation, and audit records |

Each release dossier contains the detailed rollback and validation steps. Do not reverse an additive migration destructively during incident response.
