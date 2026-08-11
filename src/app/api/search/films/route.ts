import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/server/auth/session';
import { consumeRateLimit } from '@/server/rate-limit';
import { withProvider } from '@/server/movies/provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Autocomplete endpoint for every film picker in the product (log flow, list
 * builder, club queue, nominations). Returns provider ids — nothing is written
 * to our catalogue until the user actually picks something.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() ?? '';

  if (query.length < 2) {
    return NextResponse.json({ results: [], degraded: false });
  }

  const user = await getCurrentUser();
  try {
    await consumeRateLimit('search', user?.id ?? 'anon');
  } catch {
    return NextResponse.json({ results: [], degraded: false, rateLimited: true }, { status: 429 });
  }

  const { data, degraded } = await withProvider((provider) => provider.searchMovies(query, 1));

  const results = data.results
    .filter((movie) => !movie.adult)
    .slice(0, 12)
    .map((movie) => ({
      providerId: movie.providerId,
      title: movie.title,
      year: movie.year,
      posterPath: movie.posterPath,
      overview: movie.overview ? movie.overview.slice(0, 140) : null,
    }));

  return NextResponse.json(
    { results, degraded },
    { headers: { 'cache-control': 'private, max-age=30' } },
  );
}
