import { NextResponse } from 'next/server';

import { env } from '@/env';
import { serialiseCalendarEvent } from '@/lib/calendar';
import { screeningHref } from '@/lib/links';
import { slugify } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { getMovieById } from '@/server/movies/catalog';
import { getClubBySlug, getMembership, getScreeningById } from '@/server/services/clubs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A plain, downloadable .ics for one confirmed movie night — not a
 * subscribable feed. Auth mirrors the screening page and the pulse route:
 * membership-gated, same as every other club surface.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; screeningId: string }> },
) {
  const { slug, screeningId } = await params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const club = await getClubBySlug(slug);
  if (!club) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const membership = await getMembership(club.id, user.id);
  if (!membership || membership.status !== 'active') {
    return NextResponse.json({ error: 'Not a member of this club.' }, { status: 403 });
  }

  const screening = await getScreeningById(screeningId).catch(() => null);
  if (!screening || screening.clubId !== club.id) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const movie = await getMovieById(screening.movieId).catch(() => null);
  const title = movie ? `${movie.title} — ${club.name}` : `Movie night — ${club.name}`;

  const runtimeMinutes = movie?.runtime && movie.runtime > 0 ? movie.runtime : 120;
  const start = screening.scheduledAt;
  const end = new Date(start.getTime() + runtimeMinutes * 60 * 1000);
  const pageUrl = `${env.siteUrl}${screeningHref(club, screening)}`;

  const descriptionLines = [`${club.name} on Nitrate.`];
  if (screening.watchLink) descriptionLines.push(`Watch link: ${screening.watchLink}`);
  descriptionLines.push(`Open in Nitrate: ${pageUrl}`);

  const ics = serialiseCalendarEvent({
    uid: `screening-${screening.id}@nitrate`,
    title,
    start,
    end,
    description: descriptionLines.join('\n'),
    location: screening.location ?? undefined,
    url: pageUrl,
  });

  const filename = `${slugify(movie?.title ?? 'movie-night', 40) || 'movie-night'}.ics`;

  return new NextResponse(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8; method=PUBLISH',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'private, no-store',
    },
  });
}
