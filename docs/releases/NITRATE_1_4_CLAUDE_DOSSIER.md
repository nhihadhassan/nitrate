# Nitrate 1.4 — Your Taste & Our History

## Release identity

- Local branch: `codex/nitrate-1-4-history`
- Recorded parent: `d9d752f3af4cdd17a901d9ab2fe68d547a5ca554`
- Final verified code payload: `3d94239e706a11a0f3e36d6c0e58f573434ac6ea`
- Version: `1.4.0`
- Publication state: local only and unpushed; no production migration or deployment was performed

The dossier commit follows the verified payload and changes documentation only.

## Complete implementation

- Privacy-aware Stats supports current month, year, selected year, and all time.
- Personal statistics include dated viewings, unique films, all-time library total, runtime, rating coverage and average, rewatches, new-to-you films, genres, directors, actors, decades, languages, runtime bands, weekday/month activity, community-opinion outliers, and evidence-limited taste changes.
- Stats values link to the relevant Films or Diary surface where a corresponding filter exists. The broader progressive filter system arrives in 1.7.
- Owner-only yearly recaps support sparse years, normal years, imported history, high-volume history, current-year “Year so far,” opening film, favourite films, club contributions, and a closing collage.
- Yearly and all-time Club Yearbooks show the programme, runtime, genres, member contribution stories, and collage without competitive ranking.
- Blind club ratings remain withheld unless the live viewer is entitled to them. Public Yearbook snapshots serialize no blind group score.
- Taste comparison provides shared favourites, close agreements, meaningful disagreements, reciprocal recommendations, and limited/emerging/established confidence based on overlap. It never emits a match percentage.
- Owner-only diary anniversaries appear quietly on Home and do not create notifications.
- Recaps, Yearbooks, and taste comparisons generate 1200×630 PNG cards for download and device sharing.
- Public snapshots use a versioned `ShareSnapshot` union. A cryptographically random 32-byte bearer token is returned once; only its SHA-256 digest is stored.
- Public payloads replace internal user, club, screening, and movie identifiers with public slugs/usernames before storage.
- Public links are `noindex`, revocable from Settings → Sharing, and automatically denied/revoked if a source club becomes private, a source account is deleted/suspended, or either taste profile becomes private or blocked.
- Personal recaps may be explicitly shared even when the owner’s normal profile is private. Taste links require both profiles public. Public Yearbook links require a public club and active admin.

## Migration

Apply after 1.3 and only after review:

1. `drizzle/0006_taste_history_shares.sql`

It adds only `nitrate.share_snapshots`, foreign keys, checks, and indexes. No existing data is rewritten. The token digest is a `bytea` unique key; bearer tokens are never persisted.

## Dependencies and environment

- Added dependencies: none.
- New production environment variables: none.
- Verification-only: existing `TEST_DATABASE_URL` / optional `TEST_DIRECT_DATABASE_URL`.
- Local visual fixtures require `ALLOW_SYNTHETIC_FIXTURES=true`; the fixture route returns 404 otherwise and is not a production feature.

## Verification record

Recorded on 2026-08-27:

| Gate | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass, zero warnings |
| `npm test` | Pass, 7 files and 40 tests |
| `npm run build` | Pass |
| `git diff --check` | Pass |
| `npm run test:integration` | Safely skipped 21 prepared tests because no `TEST_DATABASE_URL` exists |
| `db:migrate:test` missing-URL guard | Pass; refused before connecting |
| 320/390/768/1440 synthetic browser pass | Pass, zero overflow, no error overlay, no unnamed visible controls |
| Sparse/normal/imported/high-volume recap fixtures | Pass |
| Limited/established taste fixtures | Pass |
| Public/private/blocked/failure fixtures | Pass; denial states reveal the same generic unavailable story |
| PNG snapshot checks | Pass for recap normal/sparse, Yearbook, and taste; all 1200×630 |
| Console | No errors or warnings during fixture pass |

The integration test now proves digest-only token storage, public retrieval, owner revocation, and denial after revocation, in addition to the previous 1.3 coverage. Claude must run it on an isolated migrated database before promotion.

## Accessibility and interaction

- All period and fixture navigation is keyboard reachable with 44-pixel mobile targets.
- Headings remain sequential and story pages use a single main landmark from the app shell.
- Public denial copy does not disclose whether privacy, blocking, revocation, or absence caused the failure.
- Cards do not depend on animation. Existing reduced-motion rules remain unchanged.
- Story surfaces use the established dark/light tokens; no fixed light text is introduced into app pages.

## Known limitations and deferrals

- Imported entries participate through their dated diary records; provider credits missing from imported titles cannot contribute to genre/person statistics until normal metadata hydration completes.
- Community outliers require at least three community ratings and therefore stay absent on small data sets.
- The 1.4 links anticipate the expanded Filters system delivered in 1.7.
- A public bearer URL cannot be reconstructed from Settings because the raw token is intentionally never stored. Create a new link when needed.

## Claude review and promotion procedure

1. Compare `d9d752f3af4cdd17a901d9ab2fe68d547a5ca554..3d94239e706a11a0f3e36d6c0e58f573434ac6ea`.
2. Reconcile later `main` drift only for 1.4; do not combine 1.5 changes.
3. From a clean isolated database, apply migrations through `0006`, then run `npm run test:integration`, `npm run verify`, and `git diff --check`.
4. Review and apply only `0006_taste_history_shares.sql` to the confirmed production database.
5. Merge 1.4 into GitHub `main`, push, and wait for the existing Vercel deployment.
6. Verify GitHub/Vercel/canonical-domain commit parity before functional QA.
7. Test private/follower/public Stats access, sparse and normal recaps, current-year wording, Yearbook blind ratings, comparison confidence, anniversary privacy, PNG download/device sharing, public token access, noindex, revocation, later privacy changes, and a new block.
8. Confirm public snapshot responses contain no email, private entry text, internal UUID, private club data, or blind rating.
9. Stop before 1.5 if any migration, privacy, share, image, canonical-domain, or rollback gate fails.

## Rollback

- Redeploy the 1.3 application commit. The additive share table is harmless to 1.3 and should remain in place during incident response.
- Revoke affected snapshots by setting `revoked_at`; do not rotate or expose token hashes.
- Remove the table only in a later reviewed cleanup migration after retention review.

The 1.4 code is complete. Claude should review and promote it, not recreate Stats or sharing from the roadmap.
