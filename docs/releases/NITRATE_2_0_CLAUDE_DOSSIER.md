# Nitrate 2.0 — Network

## Release identity

- Local branch: `codex/nitrate-2-0-network`
- Recorded parent: `301b8ee96a19d25b9a4a1f339db6cb29a2e5ae49`
- Final verified code payload: `3887ef46f80c2eafce19da142d023f8015b4b96d`
- Version: `2.0.0`
- Publication state: local only and unpushed; no production migration, Vercel change, or live mutation was performed

The dossier commit follows the verified payload and changes documentation only.

## Complete implementation

- Four independent Network surfaces—People, Community lists, Public clubs, and Community trends—have `auto`, `forced_on`, and `forced_off` controls. Automatic unlock needs seven consecutive eligible calendar days. An automatic unlock is sticky; an admin can still force the surface off.
- The daily evaluator persists sanitized aggregate metrics and decisions. People require 25 eligible public profiles with at least 15 ratings. Community lists require 40 public lists with at least 10 films across 10 creators. Public clubs require 8 public clubs with at least 3 active members and 2 screenings completed in the last 180 days. Trends require 50 monthly active users plus 500 public logs or ratings from at least 25 public contributors in 90 days.
- Similar-taste discovery remains behind the People gate. Every candidate is public, followable, unsuspended, unblocked, outside active feedback exclusions, and backed by at least one explainable reason. Taste confidence is absent below 10 shared ratings and uses `emerging`, `useful`, or `strong` evidence labels rather than match percentages.
- Community list discovery includes substantial public lists only. Public-club discovery includes demonstrably active clubs only. Community trends use public diary activity in a disclosed 90-day window and require three distinct public contributors per film; no engagement score or private event is used.
- Public clubs support invite-only, request, and open policies. Requests and joins are rate-limited, suspension-aware, block-aware, capped, server-authorized, audited, and owner/admin controlled. Decisions produce explicit approved or declined notifications.
- Profile owners can pin up to six visible reviews and lists. Taste highlights are optional, bounded, and privacy-filtered with the profile.
- Movie Club discussions parse at most ten member mentions per post, rate-limit mention bursts, exclude suspended/deleted/nonmember/self targets, obey block and muted-club notification rules, and group repeated screening mentions into a counted notification.
- Reporting now snapshots public clubs and club posts as well as the existing subjects, rejects missing/self reports, and keeps moderation decisions in the existing audit path. Username impersonation variants, repeated-character abuse, and wildcard search enumeration are rejected or escaped.
- Admin product metrics report named outcomes—public club joins, join requests, profile pin changes, and recommended Network follows—without dwell time, engagement ranking, or a browsing trail.
- The Home feed remains chronological. DMs, engagement feeds, follower leaderboards, and generic AI features were not added.
- `/dev/network-fixtures` covers locked, day-six, unlocked, forced-on, forced-off, private-excluded, blocked-excluded, and evaluator-failure states with synthetic data only. The route is a 404 unless the fixture gate is explicitly enabled.

## Migration

Apply after 1.7 and only after review:

1. `drizzle/0010_network.sql`

The migration is additive. It adds Network notification values, club join policy, profile taste highlights, notification grouping, product flags, daily eligibility evidence, club join requests, profile pins, and discussion mentions. It seeds four flag rows in `auto` mode and rewrites or deletes no existing record. The new enum values are not consumed inside the migration transaction; application use begins only after the migration commits.

## Dependencies, environment, and scheduling

- New runtime or development dependencies: none.
- New production environment variables: none.
- Existing `CRON_SECRET` protects `/api/cron/network-eligibility` in production.
- Verification-only: existing `TEST_DATABASE_URL` / optional `TEST_DIRECT_DATABASE_URL`.
- Synthetic route gate: `ALLOW_SYNTHETIC_FIXTURES=true`; the route is a 404 otherwise.
- Codex deliberately did not edit Vercel configuration. Claude must connect the daily evaluator to the existing approved scheduler or deployment process after review. Until daily evaluation runs, automatic surfaces remain gated; forced-off remains available for incident control.
- The inherited production audit findings documented in 1.7 are unchanged. No unrelated framework or ORM upgrade was mixed into 2.0.

## Verification record

Recorded on 2026-08-27:

| Gate | Result |
| --- | --- |
| `npm run verify` | Pass: typecheck, lint with zero warnings, 12 unit files / 56 tests, production build |
| `git diff --check` | Pass |
| `npm run test:integration` | Safely skipped 27 prepared tests because no `TEST_DATABASE_URL` exists |
| `db:migrate:test` missing-URL guard | Pass; refused before connecting and printed no credentials |
| Network locked and enabled states | Pass via synthetic locked/day-six/unlocked/forced-on/forced-off states |
| Private, blocked, and evaluator-failure states | Pass; exclusions are explicit and failure closes the surfaces |
| 320/390/768/1440 browser pass | Pass; document width matched the viewport after the 768 navigation check |
| Keyboard/screen-reader semantics | Pass for new headings, status text, lists, tables, labels, buttons, and gate navigation |
| Contrast and touch targets | Pass on new surfaces; interactive controls retain the shared 44 px minimum |
| Reduced motion | Pass; Network adds no required motion |
| Console | No errors or warnings across synthetic fixture states |

The prepared isolated-database test exercises forced gating, rate-limited public-club request/approval, grouped member mentions, and privacy-valid profile pins. Claude must run it after applying migrations through `0010` to a clean isolated database.

## Privacy and performance review

- Eligibility stores aggregate counts only. Synthetic counts never write into product flags or daily evidence.
- Rating contributions count only public, unsuspended, nondeleted profiles; diary contributions additionally require public entries. Discovery queries apply visibility, deletion, suspension, block, and membership rules at the database boundary.
- Mentions resolve only active members and reuse the centralized notification block/mute checks. Their links resolve to the real club screening rather than a synthetic discussion route.
- The build reports `/network` at 106 kB, `/network/lists` at 106 kB, `/network/clubs` at 115 kB, `/network/people` at 115 kB, `/network/trends` at 119 kB, and `/admin/network` at 111 kB first load.
- Eligibility aggregation is one bounded daily job. Discovery responses are capped at 40–48 rows; trend results are capped at 24 films.

## Known limitations and deferrals

- Daily scheduling is intentionally not wired in `vercel.json` because the offline train forbids Vercel configuration changes. The authenticated route and evaluator are complete.
- Eligibility fixtures prove locked and unlocked logic but do not establish live community eligibility.
- Trends use public logs for the per-film presentation while the global evidence gate counts public logs and public-profile ratings, as documented in the UI and evaluator.
- DMs, engagement feeds, follower leaderboards, native apps, gamification, monetization, and generic AI remain out of scope.

## Claude review and promotion procedure

1. Compare `301b8ee96a19d25b9a4a1f339db6cb29a2e5ae49..3887ef46f80c2eafce19da142d023f8015b4b96d`.
2. Reconcile later `main` drift only for 2.0; do not fold a future release into this migration or flag set.
3. From a clean isolated database, apply migrations through `0010`, then run `npm run test:integration`, `npm run verify`, and `git diff --check`.
4. Review and apply only `0010_network.sql` to the confirmed production database.
5. Merge 2.0 into GitHub `main`, push, and wait for the existing Vercel production deployment.
6. Verify GitHub, Vercel, and canonical-domain commit parity before functional QA.
7. Keep all four surfaces forced off or in auto while validating the evaluator, aggregate privacy, joins/requests, mentions, pins, reports, and every disabled-state fallback.
8. Connect the daily evaluator through the approved production scheduler without exposing `CRON_SECRET`; verify unauthorized calls fail and one authorized call writes only aggregate evidence.
9. Confirm live counts independently. Do not treat synthetic fixture counts, a forced-on validation, or one eligible day as evidence for automatic availability.
10. Verify each surface at phone, tablet, and desktop widths, including keyboard, screen reader, reduced motion, private profile, mutual block, suspended member, join-rate limit, grouped mention, and report flows.
11. Verify named admin outcomes without adding general browsing surveillance.
12. Stop if migration, aggregate privacy, rate limits, audit records, eligibility persistence, canonical-domain parity, or rollback gates fail.

## Rollback

- Force the affected or all Network surfaces off first. This is the fastest reversible incident control and does not delete evidence or user data.
- Redeploy the 1.7 application commit. The additive 2.0 tables, columns, and enum values may remain during incident response.
- Disable the daily scheduler if evaluation is the incident source, while preserving accumulated aggregate evidence for review.
- Remove 2.0 data only through a later reviewed cleanup migration; do not delete join requests, mentions, audit evidence, or flags ad hoc.

The 2.0 code is complete. Claude should review and promote it, not recreate Network from the roadmap.
