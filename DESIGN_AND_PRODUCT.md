# Design & Product — Nitrate

**Your films. Their films. Our films.**

A social film diary, and the Movie Club that runs itself. This document is the
single reference for *what Nitrate is for* and *how it should look and feel*. It
sits above the code: [FEATURES](docs/FEATURES.md) says what is built,
[DECISIONS](docs/DECISIONS.md) says why the code looks like it does, and this
file says what we are trying to make people feel.

> The product name lives in [`src/lib/brand.ts`](src/lib/brand.ts) and nowhere
> else. A *club* has its own name, which must never become the application's.

---

## 1. Product

### 1.1 What it is

Nitrate is a film diary that gets better with people in it. It does everything a
film-tracking network has to do — log what you watch, keep a diary worth
re-reading, rate and review, build lists and watchlists, follow people whose
taste you trust — and then adds the part nobody else does properly: **Movie
Clubs**, where everyone submits one film, the wheel picks at random or the group
votes blind, and an email tells everyone what they're watching.

### 1.2 Who it's for

| Audience | What they do here |
| --- | --- |
| **Film lovers** | Track viewing, keep a personal diary, rate and review, build lists, follow taste they trust |
| **Friend groups** | Run a recurring movie night without one person carrying the admin — pick together, schedule, remember what you watched |
| **New arrivals from Letterboxd** | Import diary, reviews, ratings, watched, watchlist and lists without losing anything |

They are usually doing one of three things: browsing artwork, making a quick
state change (rating, liking, saving a film), or coordinating a shared decision
with friends.

### 1.3 Purpose

Bring personal film tracking and social movie-night planning into one coherent
product. Make everyday discovery and logging *fast*; make the communal moments —
voting, spinning the wheel, revealing ratings, choosing the next film — feel
*memorable*.

### 1.4 The three layers

1. **Your films** — diary, ratings, reviews, lists, watchlist, stats, recaps.
2. **Their films** — following, feeds, explore, reviews and lists from people you
   trust, a people directory, taste comparison.
3. **Our films** — Movie Clubs: Movie Ideas for later, a selection round for
   now, a scheduled movie night, and permanent shared history.

### 1.5 Product principles

- **Watched ≠ logged.** You can mark a film seen without inventing a date.
- **History is never rewritten.** Every rewatch keeps its own date, rating and
  review; a film's average counts each person once, not once per viewing.
- **One write path per concept.** Everything that changes your relationship with
  a film goes through one service, so aggregates and activity never drift.
- **Authorisation is in the query.** Private diary entries, lists and clubs never
  leave the database — privacy is a `WHERE` clause, not a UI check.
- **The club round is a real state machine.** `draft → nominations_open →
  voting_open → winner_selected → screening_scheduled → completed`. Every
  transition is checked server-side; a stale tab cannot reopen a closed vote.
- **Blind means blind.** While a vote or club rating is open, the server does not
  send totals to the client at all. The reveal is a real reveal.
- **Nothing is silently dropped.** The Letterboxd importer surfaces every
  ambiguous or unmatched row for a human decision.

### 1.6 Surface map

| Area | Routes | Purpose |
| --- | --- | --- |
| Diary & profile | `/u/[username]`, `/diary`, `/watchlist`, `/u/[username]/stats`, `/u/[username]/recap/[year]` | Your record of what you've watched |
| Films & people | `/film/[slug]`, `/person/[id]`, `/films` | Canonical film and person pages |
| Discovery | `/explore`, `/explore/people`, `/search`, `/tonight` | Find the next thing to watch |
| Network | `/network`, `/network/people`, `/network/lists`, `/network/trends`, `/taste-circle` | What the people you follow are doing |
| Lists | `/lists`, `/list/[id]`, `/lists/new` | Ranked and unranked collections |
| Movie Clubs | `/clubs`, `/club/[slug]` and its `queue`, `calendar`, `history`, `members`, `settings`, `reveal/[roundId]`, `screening/[screeningId]`, `yearbook` | The club that runs itself |
| Onboarding | `/onboarding`, `/join/[code]` | Six skippable steps that leave a non-empty profile |
| Import | `/import` | Letterboxd CSV pipeline |
| Admin | `/admin/*` | Reports, users, clubs, movies, email outbox, audit log, metrics |

### 1.7 Club vocabulary

Member-facing copy uses plain language; database fields keep their names. See
[CLUB_TERMINOLOGY](docs/CLUB_TERMINOLOGY.md).

| Say | Not |
| --- | --- |
| Movie Ideas | Shared Queue, queue suggestion |
| Choose the next movie | Start a round |
| Pick your movie / Your pick | Nominate, submit, your nomination |
| Movies picked | Nominations, submissions |
| Vote · Wheel | Decide phase · selection mechanism |
| Next movie | Winner |
| Movie night | Screening |

**Movie Ideas are for later. Your pick is for this round.**

---

## 2. Design

### 2.1 Brand personality

Cinematic, tactile, refined. Warm, editorial, responsive, quietly premium — with
**film artwork carrying most of the visual drama**. The chrome stays quiet so a
wall of posters never has to compete with the interface.

### 2.2 Anti-references

Do **not** resemble: a gaming dashboard, a neon sci-fi interface, an animation
showcase, or a generic glassmorphic SaaS product.

Avoid: exaggerated 3D rotation, huge zoom effects, childish celebration effects,
decorative cursor glows everywhere, long loading choreography, and any motion
that competes with readable film information.

### 2.3 Design principles

1. **Film artwork is the protagonist.** Depth and motion frame posters and
   backdrops; they never overpower them.
2. **State changes feel immediate.** Ratings, likes, watchlist actions, votes and
   navigation respond at once. Motion only clarifies *what changed*.
3. **Earn expressive moments.** Everyday controls stay restrained so the club
   wheel, the winner reveal and the blind-rating reveal can feel distinctive.
4. **Preserve familiar workflows.** Improve the existing architecture and
   component vocabulary rather than inventing new ways to do standard tasks.
5. **Quality is perceived through consistency.** Shared depth, timing, easing,
   focus, loading and image behaviour make every surface feel designed by the
   same hand.

### 2.4 Identity

Dark-first. Near-black paper, a warm ember accent, iris reserved for club
surfaces, an editorial serif for display against a neutral grotesk, and a single
fixed grain plate so flat black never looks dead. Light mode is fully supported;
themes swap CSS variables on `:root`, so components carry **no `dark:` variants**.

**Typography**
- Display / headings: **Instrument Serif** (`--font-display`), weight 400,
  letter-spacing `-0.015em`, line-height `1.08`.
- Body / UI: **Inter** (`--font-sans`), with `cv05` and `ss03` enabled.
- Eyebrow: 11px, 600, uppercase, `0.11em` tracking, dim colour — used across
  Explore, profiles and club dashboards.

**Colour tokens** (source: [`src/app/globals.css`](src/app/globals.css))

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--canvas` | `#08090b` | `#fbfaf8` | Page ground |
| `--canvas-raised` | `#0e1013` | `#ffffff` | Raised ground |
| `--surface` | `#14171b` | `#ffffff` | Cards |
| `--surface-hover` / `--surface-strong` | `#1b1f24` / `#22262d` | `#f3f2ef` / `#e9e7e2` | Card states |
| `--line` / `--line-strong` | `#24282f` / `#333942` | `#e2e0da` / `#cbc8c0` | Borders |
| `--text` / `--text-muted` / `--text-dim` | `#f4f4f5` / `#a1a7b0` / `#6d7480` | `#14151a` / `#5c6069` / `#8b8f98` | Text hierarchy |
| `--ember` / `--ember-soft` / `--ember-dim` | `#ff5b2e` / `#ff7a54` / `#7a2a15` | `#d93c11` / `#ef5a2c` / `#fbd9cd` | Primary accent, focus, selection |
| `--iris` / `--iris-dim` | `#8b7bff` / `#362f6b` | `#5b48d6` / `#e3dffa` | **Club surfaces only** |
| `--jade` / `--rose` / `--amber` | `#34d399` / `#fb7185` / `#f5b13d` | `#0f855c` / `#d94a63` / `#b57a0a` | Success / alert / caution |

Never signal state with colour alone.

**Radius:** `2 / 3 / 5 / 8 / 12px` (`--radius-xs`…`--radius-xl`). Posters use
`--radius-sm`; cards use `--radius-lg`.

**Elevation:** five shadow tokens — `card`, `pop`, `raised`, `floating`,
`overlay` — retuned per theme (dark leans on deep spread; light uses a soft cast
plus an inset highlight). Depth is a shared scale, not a per-component choice.

### 2.5 Motion

| Token | Value |
| --- | --- |
| `--duration-fast` | `140ms` — hover, press, colour |
| `--duration-base` | `220ms` — borders, shadows, transforms |
| `--duration-slow` | `420ms` — deliberate reveals |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--ease-wheel` | `cubic-bezier(0.08, 0.72, 0.12, 1)` — the club wheel only |

- **Tactile surfaces** (`.tactile-button`, `.action-tile`, `.interactive-card`,
  `.search-result`) lift `1–2px` on hover, press to `scale(0.975)` in `80ms`.
- Hover transforms are gated behind `(hover: hover) and (pointer: fine)`. Touch
  users get a real pressed state and never depend on hover for information.
- Pressed action icons nudge up and scale to `1.08`.

### 2.6 Layout & imagery

- **Mobile-first.** Bottom nav with a centre **Log** action reachable from
  anywhere; desktop gets wider grids and expanded navigation.
- **Poster frame:** fixed `2 / 3` aspect ratio, `--radius-sm`, gradient
  placeholder with an inset hairline — so grids never reflow as images load.
- **Scroll rails:** horizontal, snap-proximity, edge mask, hidden scrollbars.
- `next/image` for posters; avatars and club art served immutably from Postgres.

### 2.7 Signature moments (spend the budget here)

| Moment | What it does |
| --- | --- |
| **Spin the wheel** | Server picks with `crypto.randomInt` and commits behind a row lock; the client animates on `--ease-wheel` to a result it did not choose. Spinning again replays the same outcome — no re-rolls. |
| **Winner reveal** | On a blind vote closing, totals arrive for the first time and the next movie is announced. |
| **Blind club rating** | Before you commit you see only *how many* have rated; the average and the spread appear the instant you submit. |
| **Spoiler reveal** | Text is not in the DOM until you ask — it cannot be read by selecting or inspecting the page. |

Everything else stays quiet so these land.

### 2.8 Accessibility & inclusion

- Every core workflow is keyboard- and screen-reader-usable, with visible
  `:focus-visible` rings (2px ember, 2px offset).
- The star rating is a **real slider**, not ten buttons.
- The modal sheet traps and restores focus.
- Semantic controls throughout; state never signalled by colour alone.
- `prefers-reduced-motion: reduce` collapses all transition/animation durations,
  forces revealed content visible, removes pointer tilt, parallax and staggered
  travel — and **short-circuits the wheel animation** to its result. Opacity and
  state feedback are preserved.

---

## 3. Working agreement

- Changing the product name: follow [RENAMING](docs/RENAMING.md) — one constant,
  a handful of exceptions.
- New colour, radius or shadow? Add a token, don't hard-code a value.
- New expressive animation? It has to clear principle 3 — is this a signature
  moment, or everyday chrome that should stay restrained?
- New surface? It should feel like it was designed by the same hand as the rest:
  reuse the depth scale, the motion tokens and the component vocabulary.
