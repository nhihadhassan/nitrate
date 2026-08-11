# Handoff

Everything you need to run, operate and hand off **Nhach Bule Dick Movie Club**.
Written to be read by someone who has never seen the project.

---

## 1. Where everything lives

| Thing | Where |
| --- | --- |
| Source | GitHub — `nhihadhassan/nitrate` (private) |
| Hosting | Vercel project `nitrate`, team `nhihadhassan-2432s-projects` |
| Live URL | `https://nitrate-nhihadhassan-2432s-projects.vercel.app` |
| Database | Supabase project `rachel-tracker` (`zgafubhzhxikuknihmnu`), ca-central-1 |
| Film data | TMDB API |
| Email | Resend, sending as `movienight@nhihadhassan.ca` |

> **The repo, Vercel project and URL are still called `nitrate`.** That was the
> product's original name. Renaming the Vercel project changes the live URL and
> needs account-level permissions the current deploy token does not have. It is
> cosmetic — nothing breaks — but see §6 if you want it changed.

---

## 2. The database is a guest in a shared project

`rachel-tracker` already hosts ~48 tables for other apps (expenses, concerts,
job applications, courses). This app does **not** touch them.

- All 43 tables live in a dedicated `nitrate` Postgres schema.
- The app connects as `nitrate_app`, a role explicitly revoked from `public`.
  Verified: it gets `permission denied` on `public.clients`,
  `public.exp_transactions`, `public.job_applications`, `public.profiles`,
  `public.concerts`.
- Connect through the Supavisor pooler at **`aws-1-ca-central-1`**.
  `aws-0-…` does not resolve this tenant — this will waste an hour if you forget.
  - App runtime: port **6543** (transaction mode, `prepare: false`)
  - Migrations: port **5432** (session mode, supports DDL)

**No Supabase Auth is used.** Sessions are this app's own (`nitrate.sessions`,
scrypt password hashes, httpOnly cookie). There are no redirect URLs or Site URL
settings to configure in Supabase, and the `nitrate` schema is not exposed via
PostgREST.

### Moving to a dedicated Supabase project later

1. Create the project, then create the schema and role (see
   `docs/DECISIONS.md` §"Database isolation" for the exact SQL).
2. Point `DIRECT_DATABASE_URL` at it and run `npm run db:migrate`.
3. Update `DATABASE_URL` and `DIRECT_DATABASE_URL` in Vercel and redeploy.

Data does not move automatically. There is currently one test account
(`ninaverity`) and one club, so starting clean is the easy path.

---

## 3. Environment variables

Set in Vercel for **production and preview**, and in `.env.local` for dev.
`.env.local` is gitignored; `.env.example` documents every key.

| Variable | Status | Notes |
| --- | --- | --- |
| `DATABASE_URL` | ✅ set | Pooled, port 6543 |
| `DIRECT_DATABASE_URL` | ✅ set | Session mode, port 5432, migrations only |
| `SESSION_SECRET` | ✅ set | 32 random bytes. Rotating it signs everyone out |
| `TMDB_API_KEY` | ✅ set | v4 read token |
| `MOVIE_PROVIDER` | ✅ set | `tmdb`. Set `offline` to force the local catalogue |
| `CRON_SECRET` | ✅ set | Bearer token the weekly job must present |
| `RESEND_API_KEY` | ✅ set | Verified working — a live send returned a provider message id |
| `EMAIL_FROM` | ✅ set | `movienight@nhihadhassan.ca`, on a Resend-verified domain |
| `NEXT_PUBLIC_SITE_URL` | ✅ set | **Every link in outgoing email is built from this.** Set explicitly in production rather than relying on Vercel's own variable, because mail rendered anywhere else silently emits `localhost` links |

---

## 4. Access and email — both live

**The site is public.** Vercel Deployment Protection is off; `/`, `/explore`,
`/clubs`, `/login` and `/signup` all return 200 with no authentication. Friends
can sign up from any device, phone included.

**Email sends for real.** `nhihadhassan.ca` is verified in Resend with sending
enabled, so mail goes out as `movienight@nhihadhassan.ca` and can reach any
address. Verified by pushing a message through the real queue and getting a
provider message id back.

The one remaining caveat: accounts created with fake addresses (the original
test account used `@nitrate.test`) will never receive anything. Real signups
need deliverable addresses.

## 5. Running it locally

```bash
npm install
cp .env.example .env.local     # fill in the values from §3
npm run db:migrate
npm run dev
```

```bash
npm run verify                 # typecheck → lint → 43 tests → production build
```

The Vitest suite includes `src/server/integration.test.ts`, which runs against
the **real** `DATABASE_URL` when one is present. It namespaces everything it
creates and cleans up after itself, but it does write to the live database — use
a branch or a scratch project if that makes you nervous.

### Deploying

Deploys are manual, via the Vercel CLI with a deploy-scoped token:

```bash
npx vercel deploy --prod --token "$VERCEL_TOKEN" --yes
```

There is no GitHub → Vercel auto-deploy hookup. Connecting the repo in the
Vercel dashboard would give you push-to-deploy and is worth doing.

---

## 6. Known limits and gotchas

**Not real-time.** Pages are dynamically server-rendered, so any load or
navigation shows current data, and your own actions refresh your view. But if
someone else spins the wheel while you are watching the club page, your screen
does not move until you refresh. There are no websockets. Adding live updates
(polling or SSE) is a real piece of work — see `docs/ROADMAP.md`.

**Cron runs daily, not hourly.** Vercel Hobby rejects sub-daily schedules, so
`vercel.json` runs `/api/cron/weekly-picks` once a day at 17:00 UTC. Because of
that, weekly rounds trigger on the club's local **weekday** only — the stored
`weeklyPickHour` is not used, and its picker is hidden. Upgrading to Pro would
let you restore hourly precision.

**Email links come from `NEXT_PUBLIC_SITE_URL`, not from the request.** Mail is
rendered by a background worker with no incoming request to infer a host from,
so `env.siteUrl` is the only source. If you send from a local machine or a
script, the links will point at whatever that environment has — during setup
this produced a real test email with unclickable `localhost:3000` links.

**Next.js is pinned to the 15.5.x line.** Vercel refuses to build versions with
open advisories; 15.1.6 was rejected outright. Do not downgrade.

**Internal identifiers still say `nitrate`.** The Postgres schema, the
`nitrate_app` role, the `nitrate_session` cookie, `nitrate-theme` localStorage
key and the `nitrate-*` CSS animation names. This is deliberate: renaming them
buys nothing a user can see and would mean a data migration plus signing
everyone out. All *user-facing* naming comes from `src/lib/brand.ts`.

**Avatars and club images live in Postgres** as `bytea`, served from
`/media/[id]` with immutable caching. Fine at this scale; move to object storage
if the table gets large.

**The deploy token cannot change project settings.** It returns 403 on anything
under Vercel project configuration. Deploys, env vars and logs all work.

---

## 7. Operating it

| Task | Where |
| --- | --- |
| Moderation queue | `/admin/reports` |
| Suspend a user / change roles | `/admin/users` |
| Inspect clubs | `/admin/clubs` |
| Fix bad film metadata | `/admin/movies` |
| Email outbox + manual flush | `/admin/email` |
| Audit log of every mod action | `/admin/audit` |
| Product metrics, club-vs-not retention | `/admin` |

Admin is gated on `users.role` being `admin` or `moderator`. To make yourself an
admin the first time, run against the database:

```sql
update nitrate.users set role = 'admin' where username = 'your_username';
```

---

## 8. If something breaks

1. **Check runtime errors first** — Vercel dashboard → project → Logs, or the
   Vercel MCP `get_runtime_errors`. Two production bugs were found this way and
   both were invisible to typecheck, lint and unit tests.
2. **TMDB down?** The app degrades on purpose: a circuit breaker falls back to
   the local catalogue and the UI says so. Nothing 500s.
3. **Database unreachable?** Check the Supabase project is not paused, and that
   you are using `aws-1-ca-central-1`.
4. **Email not arriving?** `/admin/email` shows status, attempt count and the
   provider error per message.
