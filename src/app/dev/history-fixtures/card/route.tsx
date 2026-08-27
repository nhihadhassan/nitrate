import { NextResponse } from 'next/server';

import { storyCard } from '@/server/story-card';
import { syntheticHistorySnapshot } from '@/test-fixtures/history';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (process.env.ALLOW_SYNTHETIC_FIXTURES !== 'true') return new NextResponse(null, { status: 404 });
  const snapshot = syntheticHistorySnapshot(new URL(request.url).searchParams.get('state') ?? 'recap-normal');
  if (!snapshot) return new NextResponse(null, { status: 404 });
  if (snapshot.kind === 'personal_recap') {
    return storyCard({ eyebrow: snapshot.payload.title, title: `${snapshot.payload.stats.uniqueFilms} films shaped the year.`, subtitle: snapshot.payload.closingLine, metrics: [{ label: 'viewings', value: String(snapshot.payload.stats.viewingCount) }, { label: 'hours', value: String(Math.round(snapshot.payload.stats.runtimeMinutes / 60)) }], posters: snapshot.payload.collage });
  }
  if (snapshot.kind === 'club_yearbook') {
    return storyCard({ eyebrow: 'Club Yearbook', title: snapshot.payload.title, subtitle: 'A year of movie nights, without a member leaderboard.', metrics: [{ label: 'movie nights', value: String(snapshot.payload.screenings.length) }, { label: 'hours', value: String(Math.round(snapshot.payload.totalRuntimeMinutes / 60)) }], posters: snapshot.payload.collage });
  }
  return storyCard({ eyebrow: 'Taste comparison', title: `${snapshot.payload.left.displayName} & ${snapshot.payload.right.displayName}`, subtitle: snapshot.payload.confidenceLabel, metrics: [{ label: 'shared ratings', value: String(snapshot.payload.sharedRatingCount) }, { label: 'agreements', value: String(snapshot.payload.agreements.length) }], posters: [...snapshot.payload.sharedFavourites, ...snapshot.payload.agreements] });
}
