import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/primitives';
import { BRAND } from '@/lib/brand';

/** The three layers the whole product is built on, in the order you meet them. */
const LOOPS = [
  {
    label: 'Your films',
    title: 'Keep the diary you actually reread',
    body: 'Log what you watch in seconds — half stars, a like, a few words if you have them. Rewatches keep their own date, their own rating and their own review, so your history stays honest instead of being overwritten.',
  },
  {
    label: 'Their films',
    title: 'Discover through people, not an algorithm',
    body: 'Follow the friends and strangers whose taste you trust. Their films, reviews and lists are the feed. On any film page you see what the people you follow thought before you see the crowd.',
  },
  {
    label: 'Our films',
    title: 'Decide together, then remember it',
    body: 'A Movie Club saves future ideas, makes everyone’s next pick clear, plans the night and keeps a permanent record. Everyone picks one movie and the wheel settles it.',
  },
];

export function LandingPage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-[36rem] opacity-[0.18]"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 40%, var(--ember) 0%, transparent 70%)',
          }}
        />
        <Container className="relative py-20 text-center sm:py-28">
          <p className="eyebrow">{BRAND.tagline}</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-balance text-5xl leading-[1.02] sm:text-6xl lg:text-7xl">
            {BRAND.name}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted sm:text-lg">
            Track everything you watch. Find your next film through people whose taste you trust.
            Then stop arguing about it — everyone puts one film in, and the wheel decides.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="primary" size="lg">
              <Link href="/signup">Start your diary</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/explore">Look around first</Link>
            </Button>
          </div>
          <p className="mt-5 text-xs text-dim">
            Free. Already on Letterboxd?{' '}
            <Link href="/import" className="underline underline-offset-2 hover:text-muted">
              Bring your history with you
            </Link>
            .
          </p>
        </Container>
      </section>

      <Container className="py-16 sm:py-24">
        <div className="grid gap-12 md:grid-cols-3 md:gap-10">
          {LOOPS.map((loop, index) => (
            <section key={loop.title}>
              <p className="font-display text-3xl text-ember/70 tabular">
                {String(index + 1).padStart(2, '0')}
              </p>
              <p className="eyebrow mt-3">{loop.label}</p>
              <h2 className="mt-1.5 text-xl leading-snug">{loop.title}</h2>
              <p className="mt-2.5 text-sm leading-relaxed text-muted">{loop.body}</p>
            </section>
          ))}
        </div>
      </Container>

      <section className="border-t border-line bg-canvas-raised">
        <Container className="py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl sm:text-4xl">The bit nobody else does properly</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
              A Movie Club is a real place, not a tab. Save future ideas and see who
              already wants to see them and who has already seen them. Every week everyone picks one
              movie, then <span className="text-text">spin the wheel</span>. It chooses at
              random, emails the group, and nobody gets blamed. Or put it to a blind vote if you
              prefer. Schedule the night, RSVP, watch, then rate it blind before the reveal. Every
              screening becomes a permanent entry in your club&apos;s shared history: attendees,
              ratings, discussion and all.
            </p>
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
