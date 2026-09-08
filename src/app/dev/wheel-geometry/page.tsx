import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, isNotNull } from 'drizzle-orm';

import { WheelGeometryPreview } from '@/components/club/wheel/geometry-preview';
import { Container } from '@/components/ui/primitives';
import { db } from '@/server/db';
import { movies } from '@/server/db/schema';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Wheel geometry', robots: { index: false, follow: false } };

const COUNTS = [3, 5, 8, 12];

/**
 * A side-by-side of the two wheel presentations, so the geometry can be judged
 * at a real phone width with real artwork before either is wired into a round.
 *
 * Read-only: it borrows poster paths from the catalogue and never touches a
 * club, a round or a nomination.
 */
export default async function WheelGeometryPage({
  searchParams,
}: {
  searchParams: Promise<{ count?: string }>;
}) {
  if (process.env.ALLOW_SYNTHETIC_FIXTURES !== 'true') notFound();

  const requested = Number((await searchParams).count);
  const count = COUNTS.includes(requested) ? requested : 8;

  const rows = await db
    .select({
      id: movies.id,
      slug: movies.slug,
      title: movies.title,
      year: movies.year,
      posterPath: movies.posterPath,
    })
    .from(movies)
    .where(isNotNull(movies.posterPath))
    .orderBy(desc(movies.providerPopularity))
    .limit(count);

  const items = rows.map((row) => ({
    nominationId: row.id,
    movie: { slug: row.slug, title: row.title, year: row.year, posterPath: row.posterPath },
  }));

  return (
    <Container size="narrow" className="py-8">
      <nav aria-label="Pick count" className="mb-6 flex gap-2 text-xs">
        {COUNTS.map((option) => (
          <Link
            key={option}
            href={`/dev/wheel-geometry?count=${option}`}
            aria-current={option === count ? 'page' : undefined}
            className="flex min-h-11 items-center rounded-md border border-line px-3 aria-[current=page]:border-iris aria-[current=page]:text-iris"
          >
            {option} picks
          </Link>
        ))}
      </nav>
      <WheelGeometryPreview items={items} />
    </Container>
  );
}
