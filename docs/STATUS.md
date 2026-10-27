# Current status and verification

Reviewed **27 October 2026**. This file distinguishes implemented source from
checks actually run. [FEATURES](FEATURES.md) is the capability inventory;
[HANDOFF](HANDOFF.md) is the operating guide.

## Repository reconciliation

The starting local `main` was `b69d620`, five commits behind GitHub `a0b099d`,
with unpublished source, migrations and design PNGs. Checkpoint `8dfffc5` retains
that local state. Merge `b608755` combines it with upstream, preserving themes,
the newer wheel/discussion flow and scheduling handoff. The canonical upstream
migration order through `0017` replaces duplicate local numbering.

This maintenance pass updates living documentation, labels release dossiers as
historical, adds safe storage commands and tests, excludes nested agent sources
from TypeScript, moves mockups outside public assets, and preserves spoiler
labels on the profile's recent-diary snippets. It does not add a new SQL migration.

## Verification

| Check | Evidence / coverage |
| --- | --- |
| Source inventory | Routes, services, actions, schema (63 tables), configuration and migration journal reviewed |
| Application checks | Passed: TypeScript, lint, 25 unit files / 134 tests, and production build |
| Storage safeguards | Five temporary-repository tests passed: report-only, dirty-work preservation, dependency opt-in/symlinks, tracked-file refusal and active-server refusal |
| Database schema | Read-only inspection confirmed all ten theme, override and discussion columns; no production SQL changes |
| Database integrations | 29 integration cases skipped because no isolated test URL was supplied; missing-URL migration guard refused before connection |
| Signed-in journeys | Not browser-tested in this pass |
| Providers | Real email delivery and Tenor search not exercised |
| Physical devices / assistive technology | Not verified in this pass |

A successful build is not proof of database behavior, email delivery, Network
eligibility, offline editing, VoiceOver or physical-device correctness.

## Known gaps

- **Blind-rating aggregate visibility:** `getClubStats().averageRating` sums
  all completed screenings even if their ratings are unrevealed to the viewer.
  `topRated` and `mostDivisive` use revealed-screening filtering, but the overall
  average does not. This is source-confirmed here, not a fresh signed-in live
  reproduction. Fix and regression-test all aggregate surfaces before claiming
  full blind-rating privacy.
- **Network scheduler:** `/api/cron/network-eligibility` exists, but is not
  scheduled in `vercel.json`. Auto gates require daily eligible evidence.
- **Weekly timing:** the daily 17:00 UTC cron selects due rounds by local
  weekday; the stored hour does not provide hourly timing.
- **Conditional GIF/email:** Tenor needs its key; real email needs a configured
  provider and verified sender. Console logging is not delivery.
- **PWA scope:** install/service-worker/offline fallback exist; full offline
  data editing and push notifications do not.
- `next lint` and the Vite CJS API emit deprecation notices; dependency advisory
  counts were not refreshed as part of this documentation/storage task.

## Publication and cleanup record

The pre-maintenance canonical deployment was Vercel `READY` at `a0b099d`.
The verified maintenance source and documentation are saved on
`codex/project-sync-2026-10-27` before local cleanup. Final main/deployment and
disk measurements follow after that cleanup.
