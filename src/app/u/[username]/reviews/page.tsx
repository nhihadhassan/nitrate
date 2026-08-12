import Link from 'next/link';

import { Poster } from '@/components/film/poster';
import { LikeMark, Stars } from '@/components/film/stars';
import { ReviewBody } from '@/components/review/review-body';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { filmHref } from '@/lib/links';
import { formatDateOnly, pluralize } from '@/lib/utils';
import { loadProfileContext } from '@/server/services/profile-context';
import { getUserReviews } from '@/server/services/profile';

export const dynamic = 'force-dynamic';

export default async function ProfileReviewsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const { profile, viewer, access } = await loadProfileContext(username);
  const reviews = await getUserReviews(profile.id, viewer, { limit: 40 });

  if (!reviews.length) {
    return (
      <EmptyState
        title={access.isSelf ? 'No reviews yet' : 'No reviews'}
        description={
          access.isSelf
            ? 'Add some words when you log a film and they will collect here.'
            : `${profile.displayName} has not written any public reviews.`
        }
      />
    );
  }

  return (
    <ul className="divide-y divide-line">
      {reviews.map(({ entry, movie }) => (
        <li key={entry.id} className="flex gap-4 py-6">
          <div className="w-16 shrink-0 sm:w-20">
            <Poster
              film={{
                slug: movie.slug,
                title: movie.title,
                year: movie.year,
                posterPath: movie.posterPath,
              }}
              size="sm"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <Link href={filmHref(movie)} className="text-lg font-medium hover:text-ember">
                {movie.title}
              </Link>
              {movie.year ? <span className="text-sm text-dim tabular">{movie.year}</span> : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {entry.rating ? <Stars value={entry.rating} size="sm" /> : null}
              {entry.liked ? <LikeMark className="text-sm text-rose" /> : null}
              {entry.isRewatch ? <Badge tone="iris">Rewatch</Badge> : null}
              <span className="text-xs text-dim">
                Watched {formatDateOnly(entry.watchedDate)}
              </span>
            </div>
            <Link href={`/review/${entry.id}`} className="mt-2.5 block">
              <ReviewBody
                text={entry.reviewText ?? ''}
                containsSpoilers={entry.containsSpoilers}
                clamp={5}
              />
            </Link>
            <div className="mt-2 flex items-center gap-3 text-xs text-dim">
              {entry.likeCount > 0 ? <span>{pluralize(entry.likeCount, 'like')}</span> : null}
              {entry.commentCount > 0 ? <span>{pluralize(entry.commentCount, 'comment')}</span> : null}
              <Link href={`/review/${entry.id}`} className="hover:text-ember">
                Open
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
