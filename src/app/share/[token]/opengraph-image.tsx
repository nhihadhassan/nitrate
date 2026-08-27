import { notFound } from 'next/navigation';

import { getPublicShareSnapshot } from '@/server/services/shares';
import { storyCard } from '@/server/story-card';

export const runtime = 'nodejs';
export const alt = 'A shared Nitrate film story';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const snapshot = await getPublicShareSnapshot((await params).token).catch(() => null);
  if (!snapshot) notFound();
  if (snapshot.kind === 'personal_recap') {
    return storyCard({ eyebrow: snapshot.payload.title, title: `${snapshot.payload.stats.uniqueFilms} films shaped the year.`, subtitle: snapshot.payload.closingLine, metrics: [{ label: 'viewings', value: String(snapshot.payload.stats.viewingCount) }, { label: 'hours', value: String(Math.round(snapshot.payload.stats.runtimeMinutes / 60)) }], posters: snapshot.payload.collage });
  }
  if (snapshot.kind === 'club_yearbook') {
    return storyCard({ eyebrow: 'Club Yearbook', title: snapshot.payload.title, subtitle: `${snapshot.payload.screenings.length} movie nights, watched together.`, metrics: [{ label: 'films', value: String(snapshot.payload.uniqueFilms) }, { label: 'hours', value: String(Math.round(snapshot.payload.totalRuntimeMinutes / 60)) }], posters: snapshot.payload.collage });
  }
  return storyCard({ eyebrow: 'Taste comparison', title: `${snapshot.payload.left.displayName} & ${snapshot.payload.right.displayName}`, subtitle: snapshot.payload.confidenceLabel, metrics: [{ label: 'shared ratings', value: String(snapshot.payload.sharedRatingCount) }], posters: [...snapshot.payload.sharedFavourites, ...snapshot.payload.agreements] });
}
