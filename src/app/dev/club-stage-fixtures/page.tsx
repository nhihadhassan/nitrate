import { notFound } from 'next/navigation';
import { desc, isNotNull } from 'drizzle-orm';

import { ClubStageCardView } from '@/components/club/mobile/club-stage-card';
import { MovieNightCard } from '@/components/club/mobile/movie-night-card';
import { Container } from '@/components/ui/primitives';
import { deriveClubDashboardView, type ClubState } from '@/lib/club';
import { resolveClubStageCard } from '@/lib/club-stage';
import { db } from '@/server/db';
import { movies } from '@/server/db/schema';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Club stage fixtures', robots: { index: false, follow: false } };

/**
 * Every state the club stage card can be in, at once, at a phone width.
 *
 * Read-only and synthetic: it borrows real artwork from the catalogue so
 * layout is judged against real poster proportions, but the club, the members
 * and the round are invented here and no club row is ever read or written.
 */
const state = (stage: ClubState['stage'], youNeedTo: string | null = null): ClubState => ({
  stage,
  youNeedTo,
  headline: '',
  next: '',
});

const MEMBER_NAMES = ['Maya', 'Jack', 'Rachel', 'Diyanah', 'Marcus', 'Lena', 'Jamie', 'Chris'];

const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export default async function ClubStageFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (process.env.ALLOW_SYNTHETIC_FIXTURES !== 'true') notFound();
  // `?state=` shows one stage on its own, matching the other fixture pages.
  const only = (await searchParams).state;

  const rows = await db
    .select({
      slug: movies.slug,
      title: movies.title,
      year: movies.year,
      posterPath: movies.posterPath,
      backdropPath: movies.backdropPath,
    })
    .from(movies)
    .where(isNotNull(movies.posterPath))
    .orderBy(desc(movies.providerPopularity))
    .limit(8);

  const members = MEMBER_NAMES.map((name, index) => ({
    id: `member-${index}`,
    username: name.toLowerCase(),
    displayName: name,
    avatarAssetId: null,
    ready: index < 5,
  }));

  const base = {
    isMember: true,
    isAdmin: true,
    roundStatus: null,
    roundMode: null,
    picksReady: false,
    picksRemaining: 0,
    readyMembers: 5,
    memberCount: 8,
    state: state('queue'),
  } as const;

  const shared = {
    clubSlug: 'velvet-frame',
    inviteCode: 'demo',
    selectionLabel: 'September selection',
    selectionMovieLabel: 'September’s film',
    roundId: 'round-1',
    screeningId: 'screening-1',
    ratingScreeningId: 'screening-0',
    movieTitle: rows[0]?.title ?? 'A film',
    pickCount: rows.length,
    readyMembers: 5,
    participatingMembers: 8,
    viewerHasPicked: false,
    canSpin: true,
    dateLabel: 'Sat, Sep 27 · 7:00 PM',
    location: 'Maya’s House',
    rsvp: null as 'going' | 'maybe' | 'cant' | null,
    nextSelectionLabel: 'Next movie selection in 12 days',
    screeningPast: false,
  };

  const cases = [
    {
      name: 'Choose next movie',
      card: resolveClubStageCard({
        ...shared,
        view: deriveClubDashboardView({ ...base }),
      }),
      picks: [],
      members: members.slice(0, 5),
      film: null,
    },
    {
      name: 'Picks open',
      card: resolveClubStageCard({
        ...shared,
        view: deriveClubDashboardView({ ...base, roundStatus: 'nominations_open', roundMode: 'wheel', picksRemaining: 1 }),
      }),
      picks: rows.slice(0, 5),
      members,
      film: null,
    },
    {
      name: 'Your pick is in',
      card: resolveClubStageCard({
        ...shared,
        view: deriveClubDashboardView({ ...base, roundStatus: 'nominations_open', roundMode: 'wheel' }),
      }),
      picks: rows.slice(0, 5),
      members,
      film: null,
    },
    {
      name: 'Ready to spin',
      card: resolveClubStageCard({
        ...shared,
        view: deriveClubDashboardView({ ...base, roundStatus: 'nominations_open', roundMode: 'wheel', picksReady: true }),
      }),
      picks: rows,
      members: [],
      film: null,
    },
    {
      name: 'Spun, not yet revealed',
      card: resolveClubStageCard({
        ...shared,
        view: deriveClubDashboardView({
          ...base,
          roundStatus: 'winner_selected',
          roundMode: 'wheel',
          wheelSpun: true,
          wheelRevealed: false,
        }),
      }),
      picks: [],
      members: [],
      film: null,
    },
    {
      name: 'Winner, needs a date',
      card: resolveClubStageCard({
        ...shared,
        view: deriveClubDashboardView({
          ...base,
          roundStatus: 'winner_selected',
          roundMode: 'wheel',
          wheelSpun: true,
          wheelRevealed: true,
          winnerTitle: rows[0]?.title,
        }),
      }),
      picks: [],
      members: [],
      film: rows[0] ?? null,
    },
    {
      name: 'Movie night scheduled',
      card: resolveClubStageCard({
        ...shared,
        view: deriveClubDashboardView({ ...base, upcomingTitle: rows[0]?.title }),
      }),
      picks: [],
      members: [],
      film: rows[0] ?? null,
    },
    {
      // The night is booked, the date has gone by, and nobody has confirmed
      // it — the state the club sits in between watching and rating.
      name: 'Movie night has passed',
      card: resolveClubStageCard({
        ...shared,
        screeningPast: true,
        rsvp: 'going',
        dateLabel: 'Sat Sept 5, 8:00 PM',
        view: deriveClubDashboardView({ ...base, upcomingTitle: rows[0]?.title, screeningPast: true }),
      }),
      picks: [],
      members: [],
      film: rows[0] ?? null,
    },
    {
      name: 'Movie night has passed (not an admin)',
      card: resolveClubStageCard({
        ...shared,
        screeningPast: true,
        rsvp: 'going',
        dateLabel: 'Sat Sept 5, 8:00 PM',
        view: deriveClubDashboardView({
          ...base,
          isAdmin: false,
          upcomingTitle: rows[0]?.title,
          screeningPast: true,
        }),
      }),
      picks: [],
      members: [],
      film: rows[0] ?? null,
    },
    {
      name: 'Rate it',
      card: resolveClubStageCard({
        ...shared,
        view: deriveClubDashboardView({ ...base, state: state('rate', 'Rate it') }),
      }),
      picks: [],
      members: [],
      film: rows[0] ?? null,
    },
  ];

  const shown = only ? cases.filter((item) => slugify(item.name) === only) : cases;

  const nightProps = {
    href: '/club/velvet-frame/screening/screening-1',
    title: rows[0]?.title ?? 'A film',
    posterPath: rows[0]?.posterPath ?? null,
    backdropPath: rows[0]?.backdropPath ?? null,
    dateLabel: 'Sat Sept 5, 8:00 PM',
    location: 'Maya’s House',
    attendees: members.slice(0, 5),
    goingCount: 5,
    maybeCount: 1,
    extraAttendees: 3,
    screeningId: 'screening-1',
    clubSlug: 'velvet-frame',
    calendarHref: '/club/velvet-frame/screening/screening-1/calendar',
  };

  return (
    <Container size="narrow" className="space-y-8 py-8">
      {!only || only === 'movie-night-card' ? (
        <>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-dim">Movie night card</p>
            <MovieNightCard {...nightProps} viewerRsvp="going" hasPassed={false} passedAction={null} />
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-dim">Movie night card · passed</p>
            <MovieNightCard
              {...nightProps}
              viewerRsvp="going"
              hasPassed
              passedAction={{ label: 'Mark it watched', href: '/club/velvet-frame/screening/screening-1' }}
            />
          </div>
        </>
      ) : null}

      {shown.map((item) => (
        <div key={item.name}>
          <p className="mb-2 text-xs uppercase tracking-wide text-dim">{item.name}</p>
          <ClubStageCardView
            card={item.card}
            picks={item.picks}
            members={item.members}
            film={item.film}
            backdropPath={item.film?.backdropPath ?? null}
          />
        </div>
      ))}
    </Container>
  );
}
