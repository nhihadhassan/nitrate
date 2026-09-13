import { notFound } from 'next/navigation';
import { desc, isNotNull } from 'drizzle-orm';

import { MovieNightHero } from '@/components/club/mobile/movie-night-hero';
import { MovieNightMobileActions } from '@/components/club/mobile/movie-night-actions';
import { MovieNightPlanner } from '@/components/club/movie-night-planner';
import { Container } from '@/components/ui/primitives';
import { db } from '@/server/db';
import { movies } from '@/server/db/schema';

export const metadata = { title: 'Screening edit fixture', robots: { index: false, follow: false } };

export default async function ScreeningEditFixturePage() {
  if (process.env.ALLOW_SYNTHETIC_FIXTURES !== 'true') notFound();
  const [movie] = await db
    .select({ slug: movies.slug, title: movies.title, year: movies.year, posterPath: movies.posterPath, backdropPath: movies.backdropPath })
    .from(movies)
    .where(isNotNull(movies.backdropPath))
    .orderBy(desc(movies.providerPopularity))
    .limit(1);

  return (
    <Container size="narrow" className="py-8 pb-24">
      <MovieNightHero
        film={movie ?? { slug: 'sinners-2025', title: 'Sinners', year: 2025, posterPath: null }}
        clubName="Velvet Frame"
        backdropPath={movie?.backdropPath ?? null}
        dateLabel="Sat Sept 5, 8:00 PM"
        scheduledAt="2026-09-06T00:00:00.000Z"
        location={null}
        attendees={[]}
        goingCount={1}
        maybeCount={0}
        invitedCount={1}
        viewerRsvp="going"
        screeningId="fixture-screening"
        clubSlug="fixture-club"
        showRsvp={false}
        awaitingConfirmation
        calendarHref="#"
        googleCalendarHref="#"
        canEditDate
      />
      <MovieNightMobileActions
        screeningId="fixture-screening"
        clubSlug="fixture-club"
        title={movie?.title ?? 'Sinners'}
        dateLabel="Sat Sept 5, 8:00 PM"
        scheduledAt="2026-09-06T00:00:00.000Z"
        location="Sam's flat"
        inviteLink="https://partiful.com/e/example"
        watchLink="https://example.com/watch"
        notes="Bring snacks. Starting on time for once."
        canEdit
      />
      <MovieNightPlanner
        screeningId="fixture-screening"
        clubSlug="fixture-club"
        scheduledAt="2026-09-06T00:00:00.000Z"
        location={null}
        watchLink={null}
        inviteLink={null}
        notes={null}
        isPast
      />
    </Container>
  );
}
