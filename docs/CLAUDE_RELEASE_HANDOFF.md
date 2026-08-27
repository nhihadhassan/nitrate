# Nitrate 1.3–2.0 Claude Release Handoff

## Purpose and boundary

Codex is building the roadmap as a local, stacked release train. Claude owns review, production migration, GitHub publication, Vercel promotion, and live validation. Codex must not push, merge to `main`, apply a production migration, change Vercel configuration, or mutate the live website.

The code on each completed release branch is intended to be reviewed and promoted in order, not reimplemented from the roadmap.

## Branch dependency graph

```text
885ae7e main checkpoint
└── feat/movie-night-utility              1.3 payload deaaa3a
    └── codex/nitrate-1-4-history         1.4 payload 3d94239
        └── codex/nitrate-1-5-discovery   1.5 payload 712fadb
            └── codex/nitrate-1-6-curation 1.6 payload 5aeff72
                └── codex/nitrate-1-7-library 1.7 payload 6619d2f
                    └── codex/nitrate-2-0-network 2.0 payload 3887ef4
                        └── codex/nitrate-roadmap-integration pending
```

All listed release branches are local and unpushed. Exact hashes for later releases will replace `pending` after their verification checkpoints exist.

## Release dossiers

- [1.3 Movie Night Utility](./releases/NITRATE_1_3_CLAUDE_DOSSIER.md)
- [1.4 Your Taste & Our History](./releases/NITRATE_1_4_CLAUDE_DOSSIER.md)
- [1.5 Smarter Social Discovery](./releases/NITRATE_1_5_CLAUDE_DOSSIER.md)
- [1.6 Shared Curation](./releases/NITRATE_1_6_CLAUDE_DOSSIER.md)
- [1.7 Your Permanent Film Library](./releases/NITRATE_1_7_CLAUDE_DOSSIER.md)
- [2.0 Network](./releases/NITRATE_2_0_CLAUDE_DOSSIER.md)

## Migration order

1. `drizzle/0005_movie_night_utility.sql` — Nitrate 1.3
2. `drizzle/0006_taste_history_shares.sql` — Nitrate 1.4
3. `drizzle/0007_smarter_social_discovery.sql` — Nitrate 1.5
4. `drizzle/0008_shared_curation.sql` — Nitrate 1.6
5. `drizzle/0009_permanent_film_library.sql` — Nitrate 1.7
6. `drizzle/0010_network.sql` — Nitrate 2.0

Apply these additive migrations in strict branch order. Never use a broad migration push against an unverified target.

## Shared safety gate

Every release must pass the guarded test sequence against an isolated database:

```bash
npm run db:migrate:test
npm run test:integration
npm run verify
git diff --check
```

`db:migrate:test` requires `TEST_DATABASE_URL`, rejects a normal application database identity, and never prints credentials.

## Drift checklist

Before promoting each branch:

- Fetch current `main` without modifying the release branch.
- Compare current `main` with the dossier’s recorded parent.
- Classify overlapping schema, service, action, route, component, and documentation changes.
- Resolve drift only inside the release being promoted.
- Do not squash later-release behavior into an earlier release.
- Re-run migrations from a clean isolated database after resolution.
- Re-run unit, integration, build, privacy, accessibility, responsive, and failure-state gates.
- Record the resolved production commit before touching the next release.

## Promotion stop rule

Promote one release at a time. If its migration, privacy boundary, rollback readiness, GitHub/Vercel commit parity, canonical-domain behavior, or representative user flow fails, stop. Do not begin the next production release until the current one is healthy.

## Network hold

Even after 2.0 code is promoted, Network surfaces remain behind their forced-off/auto/forced-on controls. Automatic public availability requires the documented live eligibility thresholds and seven consecutive eligible days. Synthetic fixtures prove code paths; they do not satisfy live evidence gates.
