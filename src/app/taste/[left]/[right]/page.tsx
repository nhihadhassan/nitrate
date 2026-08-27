import { and, inArray, isNull } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { Poster, PosterGrid } from '@/components/film/poster';
import { ShareStory } from '@/components/share/share-story';
import { getCurrentUser } from '@/server/auth/session';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { resolveProfileAccess } from '@/server/privacy';
import { getTasteComparison } from '@/server/services/stats';

export const dynamic = 'force-dynamic';

export default async function TastePage({ params }: { params: Promise<{ left: string; right: string }> }) {
  const { left: leftId, right: rightId } = await params;
  const profiles = await db.select().from(users).where(and(inArray(users.id, [leftId, rightId]), isNull(users.deletedAt)));
  const left = profiles.find((profile) => profile.id === leftId);
  const right = profiles.find((profile) => profile.id === rightId);
  if (!left || !right) notFound();
  const current = await getCurrentUser();
  const viewer = current ? { id: current.id, role: current.role } : null;
  const [leftAccess, rightAccess] = await Promise.all([resolveProfileAccess(left, viewer), resolveProfileAccess(right, viewer)]);
  if (!leftAccess.canView || !rightAccess.canView) notFound();
  const comparison = await getTasteComparison(leftId, rightId);
  const canShare = current?.id === leftId && left.profileVisibility === 'public' && right.profileVisibility === 'public';

  return (
    <article className="mx-auto max-w-5xl space-y-12">
      <header className="border-b border-line pb-8"><p className="eyebrow text-jade">Taste, compared honestly</p><h1 className="mt-3 text-5xl sm:text-7xl">{comparison.left.displayName}<br />& {comparison.right.displayName}</h1><p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">{comparison.confidenceLabel}. Confidence comes from overlap, not a pseudo-scientific match percentage.</p></header>
      <section><h2 className="eyebrow mb-4">Shared favourites</h2>{comparison.sharedFavourites.length ? <PosterGrid>{comparison.sharedFavourites.map((film) => <Poster key={film.movieId} film={film} size="md" />)}</PosterGrid> : <p className="text-sm text-dim">No shared favourite films yet.</p>}</section>
      <ComparisonSection title="The easy agreements" films={comparison.agreements} />
      <ComparisonSection title="The interesting disagreements" films={comparison.disagreements} />
      <section className="grid gap-10 border-t border-line pt-9 sm:grid-cols-2"><Recommendations title={`For ${comparison.left.displayName}`} films={comparison.recommendationsForLeft} /><Recommendations title={`For ${comparison.right.displayName}`} films={comparison.recommendationsForRight} /></section>
      {canShare ? <ShareStory createInput={{ kind: 'taste_comparison', otherUserId: rightId }} imageUrl={`/api/cards/taste/${rightId}`} /> : null}
    </article>
  );
}

function ComparisonSection({ title, films }: { title: string; films: Array<{ movieId: string; slug: string; title: string; year: number | null; posterPath: string | null; leftRating: number; rightRating: number }> }) { return films.length ? <section><h2 className="eyebrow mb-4">{title}</h2><ul className="grid gap-3 sm:grid-cols-2">{films.map((film) => <li key={film.movieId} className="flex items-center justify-between gap-3 rounded-md border border-line p-3"><span className="font-medium">{film.title}</span><span className="text-xs text-dim tabular">{(film.leftRating / 2).toFixed(1)} · {(film.rightRating / 2).toFixed(1)}</span></li>)}</ul></section> : null; }
function Recommendations({ title, films }: { title: string; films: Array<{ movieId: string; slug: string; title: string; year: number | null; posterPath: string | null }> }) { return <div><h2 className="eyebrow mb-3">{title}</h2>{films.length ? <PosterGrid>{films.slice(0, 4).map((film) => <Poster key={film.movieId} film={film} size="sm" />)}</PosterGrid> : <p className="text-sm text-dim">Nothing confident to suggest yet.</p>}</div>; }
