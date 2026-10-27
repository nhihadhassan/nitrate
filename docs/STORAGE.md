# Local storage and safe cleanup

The project folder was approximately **2.9 GiB** before the 27 October 2026
maintenance pass. Approximate allocations: `.claude` worktrees 1.7 GiB, main
`.next` 683 MiB, main `node_modules` 401 MiB, reference images 25 MiB and Git
history 31 MiB. These are dated measurements; builds and installs grow again.

## Routine commands

From the project folder:

```bash
npm run storage:report
npm run storage:report -- --worktree-dependencies
npm run storage:clean -- --worktree-dependencies
```

The report makes no deletions. The clean command removes only `.next`,
`coverage` and `tsconfig.tsbuildinfo` in this checkout and registered Git
worktrees physically inside `.claude/worktrees/`. `--worktree-dependencies`
also removes their duplicate `node_modules` directories. The main dependency
install stays available for development.

For the smallest resting folder:

```bash
npm run storage:report -- --dependencies
npm run storage:clean -- --dependencies
```

`--dependencies` includes dependencies in the main checkout as well as the
nested ones. Restore the main install with `npm ci` before running the app.
The report and cleanup themselves use built-in Node modules, so they still
work when dependencies have been removed. They require Git, `du`, and, for
cleanup, `ps` and `lsof` (available on macOS).

## Safeguards

- Fixed cleanup targets; arbitrary paths are not accepted.
- Only this project and registered nested Claude worktrees are included.
  Other projects and external Codex worktrees are excluded.
- Symlink targets are preserved; cleanup does not follow a linked dependency
  directory into another checkout.
- Any target containing Git-tracked files is refused before cleanup begins.
- Active project Next.js servers, builds, installs, Vitest, TypeScript or
  Drizzle processes cause cleanup to stop before deleting anything.
- Source, dirty/untracked work, `.env` files, `.vercel`, `.git`, design references,
  migration history and worktree checkouts are preserved.
- No account, database, global npm cache, simulator or macOS system cleanup.

Stop development and verification before cleaning. Do not start a server or
change checkouts while cleanup runs; a process check is a snapshot. Keep needed
runtime logs elsewhere before removing a build directory. A failed filesystem
operation can leave some earlier cache removals complete; restore with the
commands below. Reported savings are allocated file sizes, so APFS snapshots
and shared blocks can make the increase in available disk space differ.

## Recovery

```bash
npm ci            # dependencies, if removed
npm run dev       # regenerates a development .next directory
npm run build     # regenerates production output before npm start
```

Run `npm ci` inside an older worktree to restore that worktree's own locked
versions. Do not share a dependency directory between worktrees with different
lockfiles. A fresh build after cleanup is expected to be slower.

## Why worktrees stay

The three nested Claude checkouts contain earlier design/feature revisions.
Their generated artifacts are the bulk of the storage, so removing those
recovers space without risking unfinished work. Retiring a checkout itself
requires checking tracked, untracked, ignored and unpushed content and retaining
its unique commits under a recovery reference. Never use `git clean -fdx` or
recursive deletion of `.claude` as routine cleanup.

Reference PNG mockups are preserved in `docs/design-reference/`, outside the
publicly served app directory. `.gitignore` excludes agent checkouts, and
TypeScript excludes `.claude` so old nested sources are not part of app checking.

Safety tests run in temporary Git repositories with `npm run test:storage`.
See [STATUS](STATUS.md) for the latest cleanup measurement and verification.


## 27 October 2026 cleanup result

After GitHub backup and successful verification, the cleanup removed **2,565.5
MiB (2.51 GiB)** of build output and duplicate worktree dependencies. All **1,684
preserved files** matched their pre-cleanup content fingerprints, including
source, environment files, design references and worktree files. No checkout
was removed. Main dependencies remain installed.

Measured folder size immediately before cleanup: **3162.6 MiB**;
after: **597.1 MiB**, a **81.1%** reduction.
The pre-cleanup figure includes the fresh verification build and saved Git
checkpoint, which is why it exceeds the initial survey.
