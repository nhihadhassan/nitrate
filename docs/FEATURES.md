# Features

Source-backed capability inventory reviewed **27 October 2026**. These workflows
are implemented; live availability depends on database migrations, credentials,
permissions, feature gates and data. See [STATUS](STATUS.md) for verification
coverage and known defects. Synthetic `/dev` fixtures are demonstrations, not
live user data.

---

## Accounts

- Email + password signup with unique, case-insensitive usernames and a reserved-name list
- scrypt password hashing (~64 MB memory cost); login timing equalised so a
  missing account cannot be detected by response time
- Session cookies: httpOnly, SameSite=Lax, secure in production, SHA-256 hashed
  in the database, 30-day sliding expiry refreshed at most once a day
- Sign out everywhere; account deletion that scrubs identifying data but keeps
  club history and moderation records intact
- Rate limiting on signup, login, logging, comments, reports, invites, uploads,
  imports and club posts

## Onboarding

Six skippable steps that leave a non-empty profile: welcome → photo and bio →
four favourite films → rate a wall of recognisable films → follow people →
start or join a club. Every step writes real data. An invite code carried
through signup drops the new member straight into that club.

## Films

- TMDB behind a provider interface, with a local-catalogue fallback and a
  circuit breaker for outages
- Canonical films stored locally on first interaction — never treated as
  throwaway API responses
- Film pages: backdrop, poster, title, year, runtime, director, tagline,
  synopsis, genres, cast rail, grouped crew, community rating with distribution
  histogram, **people you follow who watched it and what they gave it**, reviews,
  lists containing it, and related films
- Person pages with photo, biography and known-for filmography

## Logging

- One global log sheet reachable from anywhere, including the centre of the
  mobile nav
- Fields: film, date, half-star rating, like, review, tags, spoiler flag, visibility
- **Watched vs logged** kept distinct — "Seen it, no date" marks a film watched
  without inventing a date
- Unlimited rewatches; each viewing keeps its own date, rating, review and tags,
  and older entries are never rewritten
- A film's community average counts each person's *current* rating once, not
  once per viewing
- Logging removes the film from your watchlist and offers an undo
- Editing an entry retains its date, review, tags, visibility and viewing context

## Diary, reviews, lists, watchlist

- Diary grouped by month, newest first, with rewatch and spoiler markers
- Reviews with likes, threaded comments, sharing, reporting, edit and delete
- Spoiler protection that does not render the text until you ask — it cannot be
  read by selecting or inspecting the page
- Ranked and unranked lists with per-item notes, version-safe reordering,
  collaboration invitations, likes and comments
- Watchlist with sorting plus decade and genre filters, private notes, and
  automatic removal on log
- Shared era/genre filter controls: a compact sheet on phones and visible
  filter rows on larger screens, preserving sort/filter parameters

## Profiles

Avatar, display name, username, bio, location, link, pronouns, four favourite
films front and centre, follower/following/film/club counts, a compact recent
diary strip, recent writing, and tabs for Films, Diary, Reviews, Lists, Likes
and Clubs. Stats: films, this year, rewatches, diary entries, hours watched,
average rating, rating distribution, most-watched genres and most-watched
director. The overview includes three recent diary entries with spoiler-aware
review snippets.

## Social

- Asymmetric following
- Blocking enforced in SQL in both directions — feeds, search and profiles
- Reporting on users, reviews, comments, lists, clubs and club messages, with a
  content snapshot taken at report time so deleting the post does not hide it
- Chronological home feed over one append-only `activity_events` table, with
  Following/Everyone scopes and per-card like, comment and watchlist actions

## Explore

Trending, in cinemas, top rated, coming soon, popular with people you follow,
browse by decade and genre, popular reviews, popular lists, and a people
directory.

## Movie Clubs

- Create with name, description, image, privacy, timezone and interests
- Roles: owner, admin, member — every permission checked server-side
- Invites by standing club code or expiring single-use link; new users deep-link
  into the club after signup
- Movie Ideas showing who saved each film, how many members want it
  watchlisted, how many have seen it, and whether the club already watched it
- **Selection rounds as a real state machine** —
  `draft → nominations_open → voting_open → winner_selected → screening_scheduled → completed`,
  with cancellation paths. Illegal transitions are rejected by the server.
- Two ways to decide:
  - **Blind vote** — one vote per member, totals never sent to the client while
    open, winner reveal on close, ties broken by earliest nomination
  - **Spin the wheel** — members submit their configured number of picks, the server picks with
    `crypto.randomInt`, commits the winner behind a row lock, and the client
    animates to a result it did not choose. Spinning again replays the same
    outcome. Authorized managers can explicitly replace the pool with 2–20 films
    or select/correct a result before completion. Overrides are attributed and
    manual results are presented as manual, rather than a random spin.
- Optional curated or custom themes on a round, with suggestion cards and
  matching-film inspiration; a theme guides choices without restricting picks
- Explicit pick confirmation, changing a pick and participation controls
- Reveal replay, skipping, reduced motion and visibility/time-budget recovery;
  the chosen result offers a direct handoff into movie-night scheduling
- Screenings with date, timezone, location, watch link, invite link, notes and
  RSVP (going / maybe / can't)
- **A booked night stays editable.** Date, location, links and details can all
  change after the night is booked, for anyone holding `edit_movie_night` —
  moving a night no longer means cancelling and rebuilding it
- **A night that has passed stops asking who is coming.** A screening row stays
  `scheduled` until someone confirms it, so the RSVP is retired six hours after
  the start time and the club is asked whether it happened instead
- Add to calendar as a Google Calendar event or a downloadable `.ics`
- Post-screening flow: confirm attendance, log to your own diary without
  creating a duplicate, rate and review
- **Blind club ratings** — before you submit you see only how many people have
  rated; the screening average and individual spread appear after you commit.
  **Known gap:** `getClubStats().averageRating` still aggregates unrevealed
  screenings. The intended blind contract is not fully met across dashboard
  aggregates; see [STATUS](STATUS.md).
- Private per-screening discussion after the night is marked watched: review
  posts, replies, editing, deletion, emoji reactions and spoiler gates
- Optional Tenor GIF search and attachments; search needs `TENOR_API_KEY`
- Post-screening diary entry editing keeps the existing entry instead of
  inventing another viewing; linked logging checks membership and the film
- Completed movie nights reject manager result corrections
- Club polling refreshes shared state while the page is active
- Permanent club history with attendees, ratings, group rating and discussion
- Club intelligence: "on everyone's radar", "nobody has seen", "from your queue"
- Optional weekly cycle that opens submissions automatically and emails the club

## Email

- Transport abstraction with a Resend driver and a console driver
- Durable outbox: mail is written in the same transaction as the thing that
  caused it, so a rolled-back action sends nothing and a provider outage delays
  rather than loses
- Workers claim each row before any network call, so concurrent runs cannot
  double-send; up to four attempts with retryable/permanent error handling
- Templates for the wheel winner and submissions-open, both HTML and plain text,
  with HTML escaping
- Respects per-club notification mutes and skips deleted or suspended accounts
- Admin outbox with per-status counts and a manual flush

## Letterboxd import

Upload → parse → match → preview → resolve → confirm → import → summary.

- Dependency-free RFC 4180 CSV reader that survives quoted reviews containing
  commas, quotes and newlines
- Handles diary, reviews, ratings, watched, watchlist and list exports
- Matching runs in client-driven slices so a large export cannot hit a timeout
- Ambiguous matches are surfaced with candidate posters for you to pick
- **Nothing unmatched is ever silently dropped**
- Idempotent: every diary entry carries a deterministic `externalKey`, so
  re-running an import is a no-op

## Notifications

In-app notifications for new followers, review and list likes, comments and
replies, club invitations, members joining, nominations opening, voting opening
and closing, winner selected, screening scheduled and completed, and discussion
replies. Deduped, mute-aware, and deliberately restrained about club noise.

## Moderation and admin

Report queue with categories and status workflow, user search with suspension
and role changes, club inspection, film metadata repair, a permanent audit log
of every moderation action, and product metrics including the club-vs-not
retention split the PRD asks for.

## Privacy

Public / followers / private on profiles, diary entries, reviews and lists;
private and public clubs. Enforced by composing SQL predicates into the `WHERE`
clause, so private rows never leave Postgres. Asserted in tests from the
perspective of a stranger, a follower and a blocked user.

## Design and accessibility

Original dark-first identity — near-black paper, ember accent, iris for club
surfaces, Instrument Serif display against Inter, a subtle grain plate. Light
mode supported; themes swap CSS variables so components carry no `dark:`
variants. Mobile-first with a bottom nav and a centre Log action; desktop gets
wider grids and expanded navigation.

Keyboard navigation throughout, a real slider behind the star rating rather than
ten buttons, focus trapping and restoration in the modal sheet, visible focus
rings, semantic controls, state never signalled by colour alone, and a global
`prefers-reduced-motion` override that also short-circuits the wheel animation.
Mobile controls use at least 44px touch targets, native scrollbars remain
available, and muted text plus accent-button foregrounds retain readable
contrast in both themes.


## Movie-night coordination and PWA

- Multi-option availability polls, member responses and confirmation into a night
- Private watchlist notes and region-aware provider availability
- Reminder preferences and daily reminder dispatch
- Install metadata, production service worker and an offline fallback page;
  this is not a complete offline data-editing system and push is not implemented

## History, taste and sharing

- Personal statistics, yearly recaps and club Yearbooks
- Confidence-aware taste comparison based on shared ratings
- Revocable snapshot sharing with stored privacy boundaries and generated cards
- Settings for managing shared snapshots

## Recommendations and personal discovery

- People/film recommendation reasons and reversible feedback
- Tonight suggestions using time, genre, availability and watchlist scope
- A taste circle of up to five people, with optional circle feed filtering
- Follow filmmakers and browse their known upcoming work; no speculative
  release-date notifications

## Curation, ownership and export

- Collaborative list invitations, roles, stale-version protection and attribution
- Save, pin and clone lists; transfer selected films into Movie Ideas
- Ownership copies with format/edition and private details
- Streamed account ZIP export via `/api/account/export`, including schema metadata
  and cursor-based batches rather than buffering the whole archive

## Network

- Network hub, people, community lists, public clubs and community trends
- Invite-only, request-to-join and open public-club policies with approval controls
- Admin `auto` / `forced_on` / `forced_off` modes; auto unlock needs seven
  eligible daily observations and stays unlocked unless disabled
- People: 25 eligible public profiles with at least 15 ratings each; a displayed
  match needs 10 shared ratings
- Lists: 40 public lists of 10+ films from 10+ creators
- Clubs: 8 public clubs with 3+ active members and 2 recent completed screenings
- Trends: 50 monthly active users and 500 public logs/ratings from 25 contributors
  within 90 days
- Synthetic evidence does not count toward live eligibility. The evaluator
  endpoint exists, but daily scheduling is still an operational gap

## Operations

- GitHub `main` deploys to Vercel production automatically, with the CLI kept as
  a manual fallback.
- The daily Movie Club cron opens due rounds, sends reminders, retries queued
  email, and prunes expired sessions and rate-limit counters.
- The serverless runtime owns idle database connection teardown, avoiding
  misleading timer warnings after frozen instances resume.

- Local storage reporting and guarded cleanup for main and nested worktree caches;
  optional duplicate dependency cleanup preserves source, secrets and Git state.
