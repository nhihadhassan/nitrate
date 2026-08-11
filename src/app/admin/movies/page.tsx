import { MovieMetadataTools } from '@/components/admin/movie-metadata-tools';
import { desc, sql } from 'drizzle-orm';

import { requireAdmin } from '@/server/auth/session';
import { db } from '@/server/db';
import { movies } from '@/server/db/schema';

export const dynamic = 'force-dynamic';

export default async function AdminMoviesPage() {
  await requireAdmin();

  // Films people are interacting with that we never fully hydrated, or that are
  // missing the artwork and runtime the UI depends on.
  const problems = await db
    .select({
      id: movies.id,
      providerId: movies.providerId,
      slug: movies.slug,
      title: movies.title,
      year: movies.year,
      posterPath: movies.posterPath,
      runtime: movies.runtime,
      detailsFetchedAt: movies.detailsFetchedAt,
      watchCount: movies.watchCount,
    })
    .from(movies)
    .where(
      sql`${movies.detailsFetchedAt} is null or ${movies.posterPath} is null or ${movies.runtime} is null`,
    )
    .orderBy(desc(movies.watchCount))
    .limit(50);

  return (
    <div>
      <h2 className="text-xl">Film metadata</h2>
      <p className="mt-1.5 max-w-2xl text-sm text-muted">
        Films with incomplete metadata, busiest first. Refreshing re-fetches details, credits and
        artwork from the provider and overwrites our cached copy.
      </p>
      <div className="mt-5">
        <MovieMetadataTools
          movies={problems.map((movie) => ({
            ...movie,
            detailsFetchedAt: movie.detailsFetchedAt?.toISOString() ?? null,
          }))}
        />
      </div>
    </div>
  );
}
