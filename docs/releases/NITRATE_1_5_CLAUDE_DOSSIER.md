# Nitrate 1.5 — Smarter Social Discovery

## Release identity

- Local branch: `codex/nitrate-1-5-discovery`
- Recorded parent: `40bb31b95d3325706d2e0e09cc58e79ecfcaebbc`
- Final verified code payload: `712fadb525546c711159b3a8419a9d1833f6ef12`
- Version: `1.5.0`
- Publication state: local only and unpushed; no production migration or deployment was performed

The dossier commit follows the verified payload and changes documentation only.

## Complete implementation

- People recommendations use a bounded pool of at most 100 eligible public accounts and return at most 40. Candidates are explained through shared ratings, shared favourite films, shared Movie Clubs, and social proximity.
- Nitrate does not make a taste-similarity claim below 10 shared ratings. Ordering uses a capped internal weight that is never displayed as a match score or percentage.
- Private, deleted, suspended, followed, blocked, and actively hidden accounts are removed before scoring.
- The private Taste circle accepts up to five people the owner already follows. Unfollowing removes the private anchor. Nobody else can inspect circle membership.
- The optional Taste circle feed is a separate chronological feed. Home remains chronological and receives no engagement ranking.
- A closed `RecommendationReason` union now powers context across Explore, Film, search, Watchlist, lists, Tonight, and Movie Ideas/club shortlists.
- Context remains compact and text-first: no avatar stacks, badge clouds, compatibility percentages, or unexplained ranking labels.
- Recommendation feedback is reversible: Hide expires after 90 days, Less like this after 30 days, and Already know remains until manual restoration. Settings → Discovery lists active controls and restores them immediately.
- Movie feedback is enforced on recommendation rails, related films, and Tonight. People feedback is enforced before people recommendation scoring. Watchlist and list pages display relevant context without treating user-owned content as removable recommendations.
- Tonight provides a bounded shortlist from the owner’s Watchlist and active clubs’ Movie Ideas. Known streaming/free availability for the selected region sorts first; unknown provider data is not described as unavailable.
- Filmmaker follows are private and available from person pages. Settings shows followed filmmakers and provider-listed upcoming work while explicitly avoiding unreliable release notifications.
- Product analytics uses named events for recommendation opens/hides/restores, recommended follows, Taste circle changes, and filmmaker follows. No generic browsing or dwell-time surveillance was added.
- Synthetic normal, limited-overlap, full-circle, private, blocked, and failure states are available only when `ALLOW_SYNTHETIC_FIXTURES=true`.

## Migration

Apply after 1.4 and only after review:

1. `drizzle/0007_smarter_social_discovery.sql`

The migration is additive. It adds:

- `users.taste_circle_feed_enabled`
- private `taste_circle_members` with a no-self check
- `recommendation_feedback` with checked target/kind vocabularies, expiry/restoration, and one active record per target/kind
- private `person_follows`
- supporting foreign keys and indexes

No existing row is rewritten or deleted.

## Dependencies and environment

- Added dependencies: none.
- New production environment variables: none.
- Verification-only: existing `TEST_DATABASE_URL` / optional `TEST_DIRECT_DATABASE_URL`.
- Local synthetic route: `ALLOW_SYNTHETIC_FIXTURES=true`; it returns 404 otherwise.

## Verification record

Recorded on 2026-08-27:

| Gate | Result |
| --- | --- |
| `npm run verify` | Pass: typecheck, lint with zero warnings, 8 unit files / 44 tests, production build |
| `git diff --check` | Pass |
| `npm run test:integration` | Safely skipped 24 prepared tests because no `TEST_DATABASE_URL` exists |
| `db:migrate:test` missing-URL guard | Pass; refused before connecting and printed no credentials |
| 320/390/768/1440 synthetic browser pass | Pass, document width matched viewport at every size |
| Normal and limited-overlap recommendations | Pass; 9 shared ratings emitted no taste claim, 18+ did |
| Full five-person circle | Pass; fixture exposes the cap and disabled-add state |
| Private and blocked fixtures | Pass; zero people cards and no leaked reason |
| Failure fixture | Pass; Home chronology is described as unaffected |
| Touch targets | Pass; synthetic interactive controls measured at 44 pixels high on phone widths |
| Reduced motion | Pass; existing global reduced-motion media rules remain present and the new surfaces do not require motion |
| Console | No errors or warnings during fixture-state pass |

The prepared integration cases verify follow-bound Taste circle membership, removal, expiring feedback, manual restoration, and shared structured film context. Claude must run them after applying migrations to an isolated database before production promotion.

## Privacy and safety review

- Taste circle membership and filmmaker follows have no public route, notification, activity event, or profile count.
- People suggestions apply relationship blocks before reading or returning signals.
- Friend context excludes private profiles and private diary entries.
- Movie Club context is scoped to active membership.
- Recommendation feedback is owner-scoped and every restore mutation checks the owner.
- No API returns the internal ordering score; the user sees evidence labels only.
- Home feed query semantics are unchanged except for accepting a bounded actor list when the separate Taste circle page calls it.

## Measured local performance

- Production build succeeded with `/explore/people` at 116 kB first load, `/settings/discovery` at 123 kB, `/taste-circle` at 127 kB, and `/tonight` at 122 kB.
- People candidate hydration is capped at 100 accounts and four bounded aggregate queries.
- Shared movie context accepts at most 120 movie IDs in one batch.
- Tonight resolves at most 24 availability candidates with concurrency four and uses the existing 12-hour availability cache.

## Known limitations and deferrals

- The provider supplies “known for” work rather than a contractual release calendar; upcoming work is reference-only and dates may move.
- Less like this currently suppresses the selected target for 30 days. It does not train a latent model or infer sensitive attributes from the reason.
- People suggestions require at least one explainable signal. Nitrate intentionally shows an empty state instead of filling the page with ungrounded accounts.
- Network-scale discovery, community lists/trends, and public-club discovery remain gated for 2.0.

## Claude review and promotion procedure

1. Compare `40bb31b95d3325706d2e0e09cc58e79ecfcaebbc..712fadb525546c711159b3a8419a9d1833f6ef12`.
2. Reconcile later `main` drift only for 1.5; do not combine 1.6 list collaboration changes.
3. From a clean isolated database, apply migrations through `0007`, then run `npm run test:integration`, `npm run verify`, and `git diff --check`.
4. Review and apply only `0007_smarter_social_discovery.sql` to the confirmed production database.
5. Merge 1.5 into GitHub `main`, push, and wait for the existing Vercel production deployment.
6. Verify GitHub/Vercel/canonical-domain commit parity before functional QA.
7. Verify people recommendation explanations at 9 and 10 shared ratings; private/deleted/suspended/blocked exclusions; Follow from recommendation; Hide, Already know, Less like this, expiry, and Restore.
8. Verify Taste circle follow requirement, five-person cap, privacy, feed opt-in, chronological order, and removal after unfollow.
9. Verify shared reasons on Explore, Film, search, Watchlist, lists, Tonight, and Movie Ideas; confirm Home remains chronological.
10. Verify filmmaker follow/unfollow and known upcoming work without any release-notification promise.
11. Stop before 1.6 if any migration, privacy, block, expiry, ordering, canonical-domain, or rollback gate fails.

## Rollback

- Redeploy the 1.4 application commit. The additive 1.5 tables and nullable/defaulted user column are harmless to 1.4 and should remain during incident response.
- To halt recommendations without deleting personal choices, remove the 1.5 routes from traffic by application rollback. Do not delete Taste circle, feedback, or filmmaker-follow rows during an incident.
- Remove the new tables/column only in a later reviewed cleanup migration after retention review.

The 1.5 code is complete. Claude should review and promote it, not recreate social discovery from the roadmap.
