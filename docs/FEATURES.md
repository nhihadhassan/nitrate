# Features

What is actually built and working, as of 11 August 2026. Everything listed here
is wired end to end — no mock buttons, no placeholder data.

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

## Diary, reviews, lists, watchlist

- Diary grouped by month, newest first, with rewatch and spoiler markers
- Reviews with likes, threaded comments, sharing, reporting, edit and delete
- Spoiler protection that does not render the text until you ask — it cannot be
  read by selecting or inspecting the page
- Ranked and unranked lists with per-item notes, reordering, likes and comments;
  the schema already supports collaborators
- Watchlist with sorting and decade filtering, and automatic removal on log

## Profiles

Avatar, display name, username, bio, location, link, pronouns, four favourite
films front and centre, follower/following/film/club counts, and tabs for
Films, Diary, Reviews, Lists, Likes and Clubs. Stats: films, this year,
rewatches, diary entries, hours watched, average rating, rating distribution,
most-watched genres and most-watched director.

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
  - **Spin the wheel** — everyone submits one film, the server picks with
    `crypto.randomInt`, commits the winner behind a row lock, and the client
    animates to a result it did not choose. Spinning again replays the same
    outcome; there are no re-rolls.
- Screenings with date, timezone, location, watch link, notes and RSVP
  (going / maybe / can't)
- Post-screening flow: confirm attendance, log to your own diary without
  creating a duplicate, rate and review
- **Blind club ratings** — before you submit you see only how many people have
  rated; the average and the individual spread appear the moment you commit
- Private per-screening discussion with replies, spoiler marking, deletion, and
  a spoiler gate for anyone who has not logged the film
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
