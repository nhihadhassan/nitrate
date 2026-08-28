# Nitrate 1.6 — Shared Curation

## Release identity

- Local branch: `codex/nitrate-1-6-curation`
- Recorded parent: `0011c3f1242aee3f38aa0ae8c591cef44ada244f`
- Final verified code payload: `5aeff72277aa4f06df761804f988b9462394d727`
- Version: `1.6.0`
- Publication state: local only and unpushed; no production migration or deployment was performed

The dossier commit follows the verified payload and changes documentation only.

## Complete implementation

- Existing `list_collaborators`, `added_by_user_id`, and list fields are reused. Collaboration adds invitations and activity instead of replacing the established list model.
- Only owner and editor roles exist. A centralized server-side authorization function gates every list metadata, item, note, reorder, invitation, collaborator, pin, save, clone, and transfer mutation.
- Owners invite editors by username. Invitations accept, decline, revoke, expire after seven days, create an in-app notification, reject self-invites and duplicate active invites, and refuse either direction of a block.
- Editors can add/remove films, edit notes, and reorder when collaboration is enabled. Only owners can change settings, manage editors/invitations, pin an owned list, or delete it.
- Add, remove, and note changes execute atomically with list counters/version and append-only activity attribution in the same transaction.
- Reordering requires the exact current list version and a complete duplicate-free item set. A stale tab receives a conflict and its partial updates roll back.
- List activity records item changes, notes, reorder, editor changes, clones, settings, and Movie Ideas transfers. List items show subtle “Added by” attribution when a collaborator contributed them.
- `/lists` provides searchable/sortable Your Lists, private Saved Lists, and public Likes views. Owned and saved lists can be privately pinned.
- Save is private. Likes are allowed only on public lists and remain publicly counted.
- Clone creates a private independent copy with source attribution. Later edits do not mutate the source.
- Selected bulk transfer sends at most 25 list films to one active club’s Movie Ideas. Existing entries are skipped and reported; nothing duplicates.
- Public list pages alone expose device sharing and a downloadable 1200×630 PNG. Follower/private lists expose neither public sharing control nor public art.
- Folders and smart-rule lists remain intentionally deferred.

## Migration

Apply after 1.5 and only after review:

1. `drizzle/0008_shared_curation.sql`

The migration is additive. It:

- adds list version, owner pin, and clone-source fields
- adds `list_collaboration_invitations` with checked editor-only role/status, expiry, and a partial unique pending-invite key
- adds append-only `list_activity`
- adds private `saved_lists` with per-save pin state
- adds `list_collaboration_invite` to the notification enum
- adds only foreign keys and supporting indexes; no existing row is rewritten or deleted

## Dependencies and environment

- Added dependencies: none.
- New production environment variables: none.
- Verification-only: existing `TEST_DATABASE_URL` / optional `TEST_DIRECT_DATABASE_URL`.
- Local synthetic route: `ALLOW_SYNTHETIC_FIXTURES=true`; it returns 404 otherwise.

## Verification record

Recorded on 2026-08-27:

| Gate | Result |
| --- | --- |
| `npm run verify` | Pass: typecheck, lint with zero warnings, 9 unit files / 47 tests, production build |
| `git diff --check` | Pass |
| `npm run test:integration` | Safely skipped 25 prepared tests because no `TEST_DATABASE_URL` exists |
| `db:migrate:test` missing-URL guard | Pass; refused before connecting and printed no credentials |
| 320/390/768/1440 synthetic browser pass | Pass, document width matched viewport at every size |
| Normal/pending/stale/imported/high-volume fixtures | Pass |
| Private/blocked fixtures | Pass; shared list contents and contributors are absent |
| Failure fixture | Pass; it states no partial mutation was applied |
| Touch targets | Pass for new controls; 44 pixels at phone widths |
| Reduced motion | Pass; new controls require no animation and existing global reduction rules remain present |
| List art snapshot | Pass, PNG measured 1200×630 |
| Console | No errors or warnings during fixture-state pass |

The prepared database integration case verifies invitation acceptance, editor authorization, note/add activity attribution, current-version reorder, stale-version rollback, private Saved Lists, private cloning with source attribution, collaborator removal, and loss of edit authority. Claude must run it against an isolated migrated database before promotion.

## Privacy and authorization review

- A private list remains viewable to its accepted editor, but a later block denies both view and edit.
- Disabling collaboration immediately removes editor mutation authority without deleting the editor row.
- Saved Lists are never exposed through a public profile and are rechecked against current source visibility and blocks on every library read.
- A clone defaults to private even when its source was public.
- Source attribution is shown only when the source remains public or the viewer owns it.
- Public list likes reject follower/private lists at the server even if a forged action bypasses the UI.
- Public art resolves through anonymous list visibility and returns 404 for non-public or deleted lists.
- Movie Ideas transfer validates active club membership and verifies every selected film is still on the source list.

## Measured local performance

- Production build succeeded with `/list/[id]` at 134 kB first load, `/lists` at 122 kB, and `/lists/collaboration` at 116 kB.
- Activity is capped at 40 recent entries per list page.
- Library reads are capped at 80 lists and poster cover hydration is one bounded query.
- Transfer selection is capped at 25. Initial list creation remains capped at 500 and now deduplicates IDs before insertion.

## Known limitations and deferrals

- Accepted editors are intentionally flat peers; there is no viewer collaborator role, granular per-film permission, ownership transfer, or nested team.
- List activity is append-only and intentionally concise; it is not a chat or audit export.
- Public list art uses the current list contents rather than creating a separate revocable snapshot. The public list URL is the source-of-truth share link.
- Saved Lists and Likes are separate by design: saving is private organization, liking is public appreciation.

## Claude review and promotion procedure

1. Compare `0011c3f1242aee3f38aa0ae8c591cef44ada244f..5aeff72277aa4f06df761804f988b9462394d727`.
2. Reconcile later `main` drift only for 1.6; do not combine 1.7 ownership/export changes.
3. From a clean isolated database, apply migrations through `0008`, then run `npm run test:integration`, `npm run verify`, and `git diff --check`.
4. Review and apply only `0008_shared_curation.sql` to the confirmed production database.
5. Merge 1.6 into GitHub `main`, push, and wait for the existing Vercel production deployment.
6. Verify GitHub/Vercel/canonical-domain commit parity before functional QA.
7. Verify invite/accept/decline/revoke/expiry, duplicate invite, block in both directions, owner/editor boundaries, collaboration disable, and editor removal.
8. Verify atomic add/remove/note, contribution attribution, exact version increments, full reorder, and a two-tab stale reorder conflict.
9. Verify list library search/sort, private save/pin, public Like, clone/source behavior, and later source privacy/block changes.
10. Verify Movie Ideas transfer at 1 and 25 items, 26-item rejection, duplicate skipping, and non-member rejection.
11. Verify public-only list sharing and 1200×630 art; confirm follower/private routes return no public asset.
12. Stop before 1.7 if any migration, privacy, authorization, concurrency, canonical-domain, or rollback gate fails.

## Rollback

- Redeploy the 1.5 application commit. The additive 1.6 columns/tables and notification enum value are harmless to 1.5 and should remain during incident response.
- If collaborative mutation must stop without a deployment rollback, disable `allow_collaborators` on affected lists; do not delete editors, invitations, or activity during incident response.
- Remove the new data only through a later reviewed cleanup migration after retention review.

The 1.6 code is complete. Claude should review and promote it, not recreate Shared Curation from the roadmap.
