# Handoff

Operational reference reviewed 27 October 2026. For the checks actually performed
and their limits, read [STATUS](STATUS.md). Historical release records describe
past observations; they are not proof of current provider configuration.

## Project map

| Concern | Location |
| --- | --- |
| Product | Nitrate; local folder retains the LetterCube name |
| Repository | [nhihadhassan/nitrate](https://github.com/nhihadhassan/nitrate) |
| Production | [nitrate-iota.vercel.app](https://nitrate-iota.vercel.app) |
| Hosting | Vercel project `nitrate`, team `nhihadhassan-2432s-projects` |
| Data | PostgreSQL, dedicated `nitrate` schema, 63 application tables |
| Auth | Custom sessions and scrypt; no Supabase Auth |
| Catalogue | TMDB provider plus local fallback |
| Email | Resend or console transport with a durable outbox |
| GIF search | Optional Tenor v2 |

Source routes live under `src/app`, business rules in `src/server/services`,
validated entry points in `src/server/actions`, and SQL in `drizzle`.
Profiles are implemented at `/u/[username]`; `/@username` URLs are rewrites.

## Local setup

Use Node 20+ and the committed npm lockfile.

```bash
npm ci
cp .env.example .env.local
# Fill in values and confirm the target development database.
npm run db:migrate
npm run dev
```

`.env.local`, `.vercel` and all real secrets stay untracked. `.env.example` is
intentionally tracked. A provider-free build and unit suite can use the offline
catalogue; real personal and club workflows require a database.

## Environment

| Variable | Purpose / requirement |
| --- | --- |
| `DATABASE_URL` | Application PostgreSQL connection; required for data workflows |
| `DIRECT_DATABASE_URL` | Preferred migration connection; falls back to `DATABASE_URL` |
| `SESSION_SECRET` | Required session configuration; use a random 32+ byte secret |
| `TMDB_API_KEY` | TMDB v4 read token or v3 key; optional for offline operation |
| `MOVIE_PROVIDER` | `tmdb` or `offline`; otherwise inferred from the TMDB key |
| `TENOR_API_KEY` | Optional GIF search; absent key produces an unconfigured state |
| `RESEND_API_KEY` | Optional real email transport; without it mail is logged by console transport |
| `EMAIL_FROM` | Sender name/address; verify the domain with the email provider |
| `CRON_SECRET` | Bearer secret; production cron fails closed when missing |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for invites, metadata and outgoing links; set explicitly |
| `TEST_DATABASE_URL` | Distinct disposable database for opt-in integration tests |
| `TEST_DIRECT_DATABASE_URL` | Optional direct/session connection for test migrations |
| `ALLOW_SYNTHETIC_FIXTURES` | `true` enables dev fixture routes; keep unset in production |

`env.siteUrl` falls back to `VERCEL_PROJECT_PRODUCTION_URL`, then localhost.
Console transport does not prove real delivery. Never infer live email, Tenor
or TMDB credentials from an example, an old handoff, or a successful build.

## Database isolation and migrations

The recorded infrastructure uses Supabase project `rachel-tracker`
(`zgafubhzhxikuknihmnu`, ca-central-1), shared with other apps. Treat the actual
connection as authoritative and verify it before changing anything. Only the
`nitrate` schema belongs to this application. The recorded app role is
`nitrate_app`; application access isolation must be rechecked after role changes.
For that project, the recorded pooler is `aws-1-ca-central-1`, transaction port
6543 for app traffic and session port 5432 for DDL (`prepare: false`).

`npm run db:migrate` reads `.env.local` when variables are absent and uses the
`nitrate_migrations` journal. Never run a broad schema push on the shared project.
The ordered migration journal currently includes:

| Range | Changes |
| --- | --- |
| `0000`–`0004` | Baseline app, wheel/email, blind settings, round/activity and reveal activity |
| `0005`–`0010` | Movie-night utility, history/shares, discovery, curation, library and Network |
| `0011`–`0014` | Club ritual, cadence, live nomination uniqueness and invite links |
| `0015_round_theme` | Optional per-round theme metadata |
| `0016_club_wheel_overrides` | Manager pool/result attribution and result mode |
| `0017_club_discussion_experience` | Review posts and GIF URLs |

Use the repository's canonical names and `drizzle/meta/_journal.json`. Older
local files named `0015_club_wheel_overrides` and
`0016_club_discussion_experience` were reconciled with upstream; do not reapply
them as extra migrations. Existing databases need journal/schema inspection,
not an assumption that a successful deployment applied SQL. No migration runs
as part of `next build` or Vercel startup.

For tests, set an isolated `TEST_DATABASE_URL`, run `npm run db:migrate:test`,
then `npm run test:integration`. The migration guard checks normalized host,
port and database identities against app URLs; the integration setup additionally
rejects a test URL identical to `DATABASE_URL`. These guards do not establish
ownership of a database or detect every alias to the same target.

## Verification and release

```bash
npm run verify
npm run test:storage
git diff --check
```

The default suite does not run the writing database integration tests. Test
counts belong in [STATUS](STATUS.md), where the date and coverage are explicit.
CI uses Node 20 and runs `npm ci` plus `npm run verify` on pull requests and main.

GitHub `main` is connected to Vercel production. Before publishing runtime
changes, inspect the database migration state, run appropriate verification,
and preserve unrelated local work. After publishing, verify the GitHub SHA,
Vercel `READY` state and matching SHA, then check the canonical site. A successful
build cannot validate signed-in journeys, email delivery or schema state.

For manual deployment, use the configured Vercel account/CLI. Do not paste
credentials into commands, documentation, screenshots or reports. Deploy-scoped
tokens may lack project-setting permissions.

## Schedulers and updates

`vercel.json` schedules `/api/cron/weekly-picks` at **17:00 UTC daily**. It opens
due rounds by the club's local weekday, dispatches screening reminders, flushes
queued email and prunes expired sessions/rate limits. The stored weekly hour
is reserved; it does not create an hourly scheduler.

`/api/cron/network-eligibility` exists but has no schedule in `vercel.json`.
Network auto-unlock requires daily evidence over seven eligible days. Wire a
reviewed scheduler before relying on automatic unlocks.

Club pages use `ClubPulse`, not websockets: poll every 5 seconds, slow to 20
seconds after two idle minutes, stop after ten, pause when hidden and resume on
visibility/focus. Other pages generally reflect changes on refresh/navigation.

## Administration and troubleshooting

| Route | Operation |
| --- | --- |
| `/admin` | Product metrics |
| `/admin/reports` | Moderation queue |
| `/admin/users` | Suspension and roles |
| `/admin/clubs` | Club inspection |
| `/admin/movies` | Catalogue repair |
| `/admin/email` | Outbox status and manual flush |
| `/admin/audit` | Moderation audit log |
| `/admin/network` | Eligibility evidence and feature controls |

Admin/moderator access is enforced by the server. Bootstrap an administrator
only for an explicitly identified account in the confirmed database. Never
infer admin rights from a test username.

For failures, inspect Vercel runtime logs first. Check database reachability,
provider availability and outbox attempts. Media uploads are stored as PostgreSQL
`bytea` and served through `/media/[id]` with immutable caching; a future move
to object storage needs a deliberate migration. Avoid deleting test accounts
or live club data as routine housekeeping.

For a large local folder, use [STORAGE](STORAGE.md). Source, secrets and Git
history are not cleanup targets.
