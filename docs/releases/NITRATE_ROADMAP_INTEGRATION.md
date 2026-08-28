# Nitrate Roadmap Integration — 1.3 Through 2.0

## Identity and boundary

- Local branch: `codex/nitrate-roadmap-integration`
- Recorded parent: `1080453f197aacfdb7043074a27234b1761e9ecd`
- Final verified code payload: `78deedbdf3ba625d2bec5fb77bf8181278f19288`
- Publication state: local only and unpushed

The documentation commit follows the verified payload. No production database, GitHub branch/tag, Vercel configuration/deployment, or live mutation was touched.

## Integration work

- Re-ran the complete 2.0 verification after stacking every release.
- Exercised representative synthetic History, Discovery, Curation, Library, and Network surfaces at 320, 390, 768, and 1440 pixels.
- Corrected the shared mobile theme target to 44×44 while narrowing only the tablet search trigger enough to keep the 768-pixel document exact.
- Removed an invalid image-render style path and retained a nonoverlapping 650-pixel editorial copy column. Both history and list cards render at 1200×630 without warnings.
- Revalidated the streamed high-volume ZIP manifest and privacy exclusions.

## Final verification

| Gate | Result |
| --- | --- |
| `npm run verify` | Pass: 56 tests, lint/typecheck, production build |
| `npm run test:integration` | 27 prepared tests safely skipped without `TEST_DATABASE_URL` |
| `npm run db:migrate:test` | Guarded refusal before connection because `TEST_DATABASE_URL` is absent |
| `git diff --check` | Pass |
| Browser matrix | 20/20 responsive combinations; no horizontal overflow or browser console warning |
| Network modes | All eight synthetic gate/privacy/failure states passed |
| Phone targets | No visible button, select, input, or button role below 44×44 at 320/390 |
| Image snapshots | Two valid 1200×630 PNGs; no server render warning |
| Export snapshot | Valid ZIP, schema 1.0, cursor batch 250, no foreign private data or club discussions |

## Claude integration review

Use this branch only as a final regression reference after promoting the six release branches independently. Do not merge it ahead of those releases: its parent already contains the entire train, and its three code changes are cross-release polish that should be reconciled after 2.0 is healthy.

Before declaring the train complete, Claude must run migrations `0000` through `0010` and all 27 integration tests against a clean isolated database, then repeat the browser/image/export gates. The application code is complete; the outstanding work is environment-backed review and ordered promotion, not roadmap reimplementation.
