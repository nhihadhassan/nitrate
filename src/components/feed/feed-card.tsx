'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Poster } from '@/components/film/poster';
import { LikeMark, Stars } from '@/components/film/stars';
import { ReviewBody } from '@/components/review/review-body';
import { BookmarkIcon, CommentIcon } from '@/components/ui/icons';
import { Badge } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { Avatar } from '@/components/user/avatar';
import { formatDateOnly, relativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { updateFilmStateAction } from '@/server/actions/films';
import { toggleReviewLikeAction } from '@/server/actions/social';

export type FeedCardData = {
  id: string;
  type: string;
  createdAt: string;
  actor: { id: string; username: string; displayName: string; avatarAssetId: string | null };
  movie: { id: string; slug: string; title: string; year: number | null; posterPath: string | null } | null;
  entry: {
    id: string;
    rating: number | null;
    liked: boolean;
    reviewText: string | null;
    containsSpoilers: boolean;
    watchedDate: string;
    isRewatch: boolean;
    likeCount: number;
    commentCount: number;
    likedByViewer: boolean;
  } | null;
  list: { id: string; title: string; slug: string; itemCount: number } | null;
  club: { id: string; name: string; slug: string } | null;
};

function verbFor(item: FeedCardData): string {
  switch (item.type) {
    case 'film_rated':
      return 'rated';
    case 'film_liked':
      return 'liked';
    case 'review_created':
      return 'reviewed';
    case 'list_created':
      return 'made a list';
    case 'club_movie_selected':
      return 'picked the next club film';
    case 'club_screening_completed':
      return 'watched with';
    default:
      return item.entry?.isRewatch ? 'rewatched' : 'watched';
  }
}

export function FeedCard({ item, signedIn }: { item: FeedCardData; signedIn: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [liked, setLiked] = useState(item.entry?.likedByViewer ?? false);
  const [likeCount, setLikeCount] = useState(item.entry?.likeCount ?? 0);
  const [saved, setSaved] = useState(false);

  function requireAuth(): boolean {
    if (signedIn) return true;
    router.push('/login');
    return false;
  }

  return (
    <article className="flex gap-3 py-5">
      {item.movie ? (
        <div className="w-16 shrink-0 sm:w-[4.5rem]">
          <Poster film={item.movie} size="sm" />
        </div>
      ) : (
        <div className="w-16 shrink-0 sm:w-[4.5rem]">
          <Avatar user={item.actor} size="lg" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
          <Link
            href={`/@${item.actor.username}`}
            className="font-medium hover:text-ember"
          >
            {item.actor.displayName}
          </Link>
          <span className="text-dim">{verbFor(item)}</span>
          {item.movie ? (
            <Link href={`/film/${item.movie.slug}`} className="font-medium hover:text-ember">
              {item.movie.title}
            </Link>
          ) : null}
          {item.movie?.year ? <span className="text-dim tabular">{item.movie.year}</span> : null}
          {item.list ? (
            <Link href={`/list/${item.list.id}`} className="font-medium hover:text-ember">
              {item.list.title}
            </Link>
          ) : null}
          {item.club ? (
            <Link href={`/club/${item.club.slug}`} className="font-medium text-iris hover:underline">
              {item.club.name}
            </Link>
          ) : null}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {item.entry?.rating ? <Stars value={item.entry.rating} size="sm" /> : null}
          {item.entry?.liked ? <LikeMark className="text-sm text-rose" /> : null}
          {item.entry?.isRewatch ? <Badge tone="iris">Rewatch</Badge> : null}
          {item.list ? <span className="text-xs text-dim">{item.list.itemCount} films</span> : null}
          <span className="text-xs text-dim">
            {item.entry ? formatDateOnly(item.entry.watchedDate, { day: 'numeric', month: 'short' }) : relativeTime(item.createdAt)}
          </span>
        </div>

        {item.entry?.reviewText ? (
          <Link href={`/review/${item.entry.id}`} className="mt-2.5 block">
            <ReviewBody
              text={item.entry.reviewText}
              containsSpoilers={item.entry.containsSpoilers}
              clamp={3}
            />
          </Link>
        ) : null}

        <div className="mt-2.5 flex items-center gap-1">
          {item.entry ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!requireAuth()) return;
                  const next = !liked;
                  setLiked(next);
                  setLikeCount((c) => c + (next ? 1 : -1));
                  startTransition(async () => {
                    const result = await toggleReviewLikeAction(item.entry!.id);
                    if (!result.ok) {
                      setLiked(!next);
                      setLikeCount((c) => c + (next ? -1 : 1));
                      toast({ message: result.error, tone: 'error' });
                      return;
                    }
                    setLiked(result.data.liked);
                    setLikeCount(result.data.likeCount);
                  });
                }}
                aria-pressed={liked}
                aria-label={liked ? 'Unlike this entry' : 'Like this entry'}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
                  liked ? 'text-rose' : 'text-dim hover:bg-surface-hover hover:text-muted',
                )}
              >
                <LikeMark filled={liked} className={cn('text-sm', liked && 'animate-pop')} />
                {likeCount > 0 ? <span className="tabular">{likeCount}</span> : null}
              </button>

              <Link
                href={`/review/${item.entry.id}`}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-dim transition-colors hover:bg-surface-hover hover:text-muted"
              >
                <CommentIcon className="h-3.5 w-3.5" />
                {item.entry.commentCount > 0 ? (
                  <span className="tabular">{item.entry.commentCount}</span>
                ) : (
                  'Comment'
                )}
              </Link>
            </>
          ) : null}

          {item.movie ? (
            <button
              type="button"
              disabled={pending || saved}
              onClick={() => {
                if (!requireAuth()) return;
                setSaved(true);
                startTransition(async () => {
                  const result = await updateFilmStateAction({
                    movieId: item.movie!.id,
                    inWatchlist: true,
                  });
                  if (!result.ok) {
                    setSaved(false);
                    toast({ message: result.error, tone: 'error' });
                    return;
                  }
                  toast({
                    message: `${item.movie!.title} added to your watchlist`,
                    action: {
                      label: 'Undo',
                      onClick: () => {
                        setSaved(false);
                        void updateFilmStateAction({ movieId: item.movie!.id, inWatchlist: false });
                      },
                    },
                  });
                });
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
                saved ? 'text-ember' : 'text-dim hover:bg-surface-hover hover:text-muted',
              )}
            >
              <BookmarkIcon className="h-3.5 w-3.5" />
              {saved ? 'Saved' : 'Watchlist'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
