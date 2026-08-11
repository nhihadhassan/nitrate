'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { LikeMark } from '@/components/film/stars';
import { ReportDialog } from '@/components/moderation/report-dialog';
import { Button } from '@/components/ui/button';
import { ShareIcon } from '@/components/ui/icons';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { deleteListAction } from '@/server/actions/lists';
import { toggleListLikeAction } from '@/server/actions/social';

export function ListActions({
  listId,
  initialLiked,
  initialLikeCount,
  canEdit,
  signedIn,
  ownerUsername,
}: {
  listId: string;
  initialLiked: boolean;
  initialLikeCount: number;
  canEdit: boolean;
  signedIn: boolean;
  ownerUsername: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialLikeCount);
  const [pending, startTransition] = useTransition();
  const [reporting, setReporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
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
            const result = await toggleListLikeAction(listId);
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
        onClick={async () => {
          const url = `${window.location.origin}/list/${listId}`;
          if (navigator.share) {
            try {
              await navigator.share({ url, title: 'A list on Nitrate' });
              return;
            } catch {
              /* dismissed */
            }
          }
          await navigator.clipboard.writeText(url);
          toast({ message: 'Link copied', tone: 'success' });
        }}
        className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:text-text"
      >
        <ShareIcon className="h-4 w-4" />
        Share
      </button>

      {canEdit ? (
        confirmDelete ? (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-muted">Delete this list?</span>
            <Button
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteListAction(listId);
                  if (!result.ok) {
                    toast({ message: result.error, tone: 'error' });
                    return;
                  }
                  router.push(`/@${ownerUsername}/lists`);
                })
              }
            >
              Yes, delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </span>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        )
      ) : signedIn ? (
        <Button variant="ghost" size="sm" onClick={() => setReporting(true)}>
          Report
        </Button>
      ) : null}

      {reporting ? (
        <ReportDialog
          subjectType="list"
          subjectId={listId}
          subjectLabel="this list"
          onClose={() => setReporting(false)}
        />
      ) : null}
    </div>
  );
}
