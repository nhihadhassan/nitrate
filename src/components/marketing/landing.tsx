import Image from 'next/image';
import Link from 'next/link';

import { ClubLoopPreview } from '@/components/club/club-loop-preview';
import { Wheel, type WheelSegment } from '@/components/club/wheel';
import { Poster } from '@/components/film/poster';
import { PosterRail } from '@/components/film/poster-rail';
import { Stars } from '@/components/film/stars';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/primitives';
import { BRAND } from '@/lib/brand';
import { backdropUrl } from '@/lib/images';
import { moviesByIds } from '@/server/movies/catalog';
import { getEditorialRails } from '@/server/services/explore';

/**
 * The signed-out front door. Real film artwork does the persuading — a
 * backdrop and a poster rail pulled from the same catalogue every signed-in
 * page uses, not a screenshot or a mock. The one illustrated section (the
 * wheel) uses real film titles but is explicitly labelled an example: no
 * invented usernames, ratings or club activity.
 */
export async function LandingPage() {
  const rails = await getEditorialRails();
  const heroFilms = rails.trending.slice(0, 10);
  const theirFilms = (rails.canon.length ? rails.canon : rails.trending).slice(0, 6);
  const exampleFilm = rails.canon[0] ?? rails.trending[0] ?? null;
  const wheelFilms = (rails.trending.length >= 4 ? rails.trending : rails.canon).slice(0, 5);

  const backdropCandidateIds = heroFilms.slice(0, 4).map((film) => film.id);
  const backdropMovies = await moviesByIds(backdropCandidateIds);
  const backdropPath = backdropCandidateIds
    .map((id) => backdropMovies.get(id)?.backdropPath)
    .find((path): path is string => Boolean(path));
  const heroBackdrop = backdropPath ? backdropUrl(backdropPath, 'lg') : null;

  const wheelSegments: WheelSegment[] = wheelFilms.map((film) => ({
    nominationId: film.id,
    movieTitle: film.title,
  }));

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        {heroBackdrop ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] overflow-hidden opacity-[0.32] sm:h-[36rem]"
          >
            <Image
              src={heroBackdrop}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-canvas/20 via-canvas/80 to-canvas" />
          </div>
        ) : null}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-[36rem] opacity-[0.18]"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 40%, var(--ember) 0%, transparent 70%)',
          }}
        />
        <Container className="relative py-16 text-center sm:py-24">
          <p className="eyebrow">{BRAND.tagline}</p>
          <h1 className="mx-auto mt-4 max-w-2xl text-balance text-4xl leading-[1.06] sm:text-6xl lg:text-7xl">
            Track films. Discover through people. Choose together.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted sm:text-lg">
            Keep the diary you&apos;ll actually reread. Find your next film through friends whose taste
            you trust. Then stop arguing about it — everyone puts one film in, and the wheel decides.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="primary" size="lg">
              <Link href="/signup">Start your diary</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/explore">Look around first</Link>
            </Button>
          </div>
          <Link
            href="/import"
            className="mt-6 inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm text-muted transition-colors hover:border-line-strong hover:text-text"
          >
            Already on Letterboxd? Bring your history with you
          </Link>
        </Container>

        {heroFilms.length ? (
          <div className="relative pb-14 sm:pb-20">
            <Container>
              <PosterRail label="What people are watching right now" films={heroFilms} />
            </Container>
          </div>
        ) : null}
      </section>

      <Container className="py-16 sm:py-24">
        <div className="grid gap-14 md:grid-cols-3 md:gap-10">
          <section className="min-w-0">
            <p className="font-display text-3xl text-ember/70 tabular">01</p>
            <p className="eyebrow mt-3">Your films</p>
            <h2 className="mt-1.5 text-xl leading-snug">Keep the diary you actually reread</h2>
            <p className="mt-2.5 text-sm leading-relaxed text-muted">
              Log what you watch in seconds — half stars, a like, a few words if you have them.
              Rewatches keep their own date, their own rating and their own review.
            </p>
            {exampleFilm ? (
              <div className="mt-5 flex items-center gap-3 rounded-lg border border-line bg-surface/40 p-3">
                <div className="w-11 shrink-0">
                  <Poster film={exampleFilm} size="xs" linked={false} ariaHidden />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{exampleFilm.title}</p>
                  <Stars value={9} size="sm" />
                  <p className="text-[0.6875rem] text-dim">Example diary entry</p>
                </div>
              </div>
            ) : null}
          </section>

          <section className="min-w-0">
            <p className="font-display text-3xl text-ember/70 tabular">02</p>
            <p className="eyebrow mt-3">Their films</p>
            <h2 className="mt-1.5 text-xl leading-snug">Discover through people, not an algorithm</h2>
            <p className="mt-2.5 text-sm leading-relaxed text-muted">
              Follow the friends and strangers whose taste you trust. Their films, reviews and
              lists are the feed — no engagement-optimised sorting in between.
            </p>
            {theirFilms.length ? (
              <div className="mt-5">
                <PosterRail label="Highly regarded films" films={theirFilms} size="sm" itemClassName="w-16 xs:w-20 sm:w-20" />
              </div>
            ) : null}
          </section>

          <section className="min-w-0">
            <p className="font-display text-3xl text-ember/70 tabular">03</p>
            <p className="eyebrow mt-3">Our films</p>
            <h2 className="mt-1.5 text-xl leading-snug">Decide together, then remember it</h2>
            <p className="mt-2.5 text-sm leading-relaxed text-muted">
              A Movie Club saves ideas, makes everyone&apos;s next pick clear, plans the night and keeps
              a permanent record. Everyone picks one movie and the wheel settles it.
            </p>
            {wheelSegments.length >= 2 ? (
              <div className="mt-5">
                <Wheel segments={wheelSegments} winnerIndex={null} spinning={false} size={176} />
                <p className="mt-3 text-center text-[0.6875rem] text-dim">
                  An example round — real films, no winner picked
                </p>
              </div>
            ) : null}
          </section>
        </div>
      </Container>

      <section className="border-t border-line bg-canvas-raised">
        <Container className="py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl sm:text-4xl">The bit nobody else does properly</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
              This is what taste looks like. One place to choose, watch and remember films with the people who matter.
            </p>
            <div className="mt-7 text-left"><ClubLoopPreview compact /></div>
            <Button asChild variant="iris" size="lg" className="mt-8">
              <Link href="/signup">Start a club</Link>
            </Button>
          </div>
        </Container>
      </section>

      <Container className="py-16 text-center">
        <p className="text-xs text-dim">
          Film data and artwork from TMDB. {BRAND.name} is not endorsed or certified by TMDB.
        </p>
      </Container>
    </div>
  );
}
