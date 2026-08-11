'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { LikeMark } from '@/components/film/stars';
import { ReportDialog } from '@/components/moderation/report-dialog';
import { ShareIcon, TrashIcon } from '@/components/ui/icons';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { deleteEntryAction } from '@/server/actions/films';
import { toggleReviewLikeAction } from '@/server/actions/social';

export function ReviewActions({
  entryId,
  initialLiked,
  initialLikeCount,
  isAuthor,
  signedIn,
  authorUsername,
}: {
  entryId: string;
  initialLiked: boolean;
  initialLikeCount: number;
  isAuthor: boolean;
  signedIn: boolean;
  authorUsername: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialLikeCount);
  const [pending, startTransition] = useTransition();
  const [reporting, setReporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function share() {
    const url = `${window.location.origin}/review/${entryId}`;
    if (navigator.share) {
      try {
        await navigator.share({ url, title: 'A review on Nitrate' });
        return;
      } catch {
        // User dismissed the sheet; fall through to copying.
      }
    }
    await navigator.clipboard.writeText(url);
    toast({ message: 'Link copied', tone: 'success' });
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!signedIn) {
            router.push('/login');
            return;
          }
          const next = !liked;
          setLiked(next);
          setCount((c) => c + (next ? 1 : -1));
          startTransition(async () => {
            const result = await toggleReviewLikeAction(entryId);
            if (!result.ok) {
              setLiked(!next);
              setCount((c) => c + (next ? -1 : 1));
              toast({ message: result.error, tone: 'error' });
              return;
            }
            setLiked(result.data.liked);
            setCount(result.data.likeCount);
          });
        }}
        aria-pressed={liked}
        className={cn(
          'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors',
          liked ? 'border-rose/40 bg-rose/12 text-rose' : 'border-line text-muted hover:text-text',
        )}
      >
        <LikeMark filled={liked} className={cn(liked && 'animate-pop')} />
        {count > 0 ? <span className="tabular">{count}</span> : 'Like'}
      </button>

      <button
        type="button"
        onClick={share}
        className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:text-text"
      >
        <ShareIcon className="h-4 w-4" />
        Share
      </button>

      {isAuthor ? (
        confirmDelete ? (
          <span className="flex items-center gap-1.5 text-sm">
            <span className="text-muted">Delete this entry?</span>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteEntryAction(entryId);
                  if (!result.ok) {
                    toast({ message: result.error, tone: 'error' });
                    return;
                  }
                  toast({ message: 'Entry deleted' });
                  router.push(`/@${authorUsername}/diary`);
                })
              }
              className="rounded-md border border-rose/40 bg-rose/12 px-2.5 py-1 text-rose"
            >
              Yes, delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1 text-muted hover:text-text"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-rose/40 hover:text-rose"
          >
            <TrashIcon className="h-4 w-4" />
            Delete
          </button>
        )
      ) : signedIn ? (
        <button
          type="button"
          onClick={() => setReporting(true)}
          className="rounded-md px-3 py-1.5 text-sm text-dim transition-colors hover:text-text"
        >
          Report
        </button>
      ) : null}

      {reporting ? (
        <ReportDialog
          subjectType="review"
          subjectId={entryId}
          subjectLabel="this review"
          onClose={() => setReporting(false)}
        />
      ) : null}
    </div>
  );
}
