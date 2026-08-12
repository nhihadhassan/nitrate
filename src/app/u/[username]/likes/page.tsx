import Link from 'next/link';

import { PosterCard, PosterGrid } from '@/components/film/poster';
import { Stars } from '@/components/film/stars';
import { ReviewBody } from '@/components/review/review-body';
import { EmptyState, SectionHeading } from '@/components/ui/primitives';
import { UserChip } from '@/components/user/avatar';
import { filmHref } from '@/lib/links';
import { loadProfileContext } from '@/server/services/profile-context';
import { getLikedFilms, getLikedReviews } from '@/server/services/profile';

export const dynamic = 'force-dynamic';

export default async function ProfileLikesPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const { profile, viewer, access } = await loadProfileContext(username);

  const [films, reviews] = await Promise.all([
    getLikedFilms(profile.id, 36),
    getLikedReviews(profile.id, viewer, 10),
  ]);

  if (!films.length && !reviews.length) {
    return (
      <EmptyState
        title="No likes yet"
        description={
          access.isSelf
            ? 'A like is separate from a rating — it is for the films you would defend, not just score.'
            : `${profile.displayName} has not liked anything publicly.`
        }
      />
    );
  }

  return (
    <div className="space-y-12">
      {films.length ? (
        <section>
          <SectionHeading title="Liked films" />
          <PosterGrid>
            {films.map((movie) => (
              <PosterCard
                key={movie.id}
                film={{
                  slug: movie.slug,
                  title: movie.title,
                  year: movie.year,
                  posterPath: movie.posterPath,
                }}
              />
            ))}
          </PosterGrid>
        </section>
      ) : null}

      {reviews.length ? (
        <section>
          <SectionHeading title="Liked reviews" />
          <ul className="divide-y divide-line">
            {reviews.map(({ entry, movie, author }) => (
              <li key={entry.id} className="py-5">
                <div className="flex items-center justify-between gap-3">
                  <UserChip user={author} size="sm" />
                  {entry.rating ? <Stars value={entry.rating} size="sm" /> : null}
                </div>
                <Link
                  href={filmHref(movie)}
                  className="mt-1.5 inline-block text-sm font-medium hover:text-ember"
                >
                  {movie.title}
                  {movie.year ? <span className="ml-1.5 text-xs text-dim tabular">{movie.year}</span> : null}
                </Link>
                <Link href={`/review/${entry.id}`} className="mt-2 block">
                  <ReviewBody
                    text={entry.reviewText ?? ''}
                    containsSpoilers={entry.containsSpoilers}
                    clamp={3}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
