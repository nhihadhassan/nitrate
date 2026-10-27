# Roadmap

Reviewed 27 October 2026. Implemented capabilities belong in [FEATURES](FEATURES.md);
measured checks and unresolved defects belong in [STATUS](STATUS.md).

## Highest priority

- **Finish blind-rating aggregate privacy.** `getClubStats().averageRating`
  includes unrevealed screenings. Apply viewer visibility to every aggregate,
  then test dashboard, history, screening and Yearbook responses with multiple
  members before claiming the blind contract is complete.
- **Run isolated database and signed-in regression coverage.** Verify migrations
  through `0017`, themed rounds, manager overrides, concurrent picks, polls,
  logging/editing, discussion and privacy. A unit/build pass is not this gate.
- **Wire Network's daily evaluator.** The authenticated route exists;
  `vercel.json` schedules only the Movie Club job. Keep evidence gates meaningful.
- **Verify provider configuration.** Check real TMDB data, email delivery and
  optional Tenor behavior using configured environments; never rely on old
  example-domain or provider-status claims.

## Product and operations

- Restore hourly weekly-pick precision only when the hosting plan and reviewed
  scheduler support it. Today the daily job uses the local weekday.
- Validate install/offline fallback, touch flows, assistive technology and
  reduced motion on physical devices. Push subscriptions/delivery remain unbuilt.
- Audit test data and admin ownership before any account cleanup. Preserve live
  club history; do not assume the database still has a single test account.
- Review a compatibility-tested dependency upgrade and migrate deprecated
  `next lint` to the ESLint CLI before moving to Next 16. Take a fresh advisory
  inventory as part of that work rather than carrying an old count forward.
- Add actionable runtime error monitoring and alerts if required for operation.
- Monitor PostgreSQL media volume before moving uploads to object storage.

## Later

Advanced ownership/viewing-context statistics, two-way external calendar sync,
a close-friends privacy tier, and richer Tonight inputs need their own product
and data design. IMDb import, smart lists, folders and unreliable provider or
country statistics remain deferred. Native apps, DMs, gamification, monetization
and speculative release notifications are outside the current scope.

## Local maintenance

Use the implemented [storage tools](STORAGE.md) periodically. They clear generated
files and optional duplicate dependencies without removing checkouts. Worktree
retirement is separate: confirm unique commits and dirty/untracked files, save
needed ignored files and retain a recovery reference before removal.
