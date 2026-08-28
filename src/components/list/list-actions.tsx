'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { LikeMark } from '@/components/film/stars';
import { ReportDialog } from '@/components/moderation/report-dialog';
import { Button } from '@/components/ui/button';
import { ShareIcon } from '@/components/ui/icons';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { cloneListAction, deleteListAction, toggleSavedListAction } from '@/server/actions/lists';
import { toggleListLikeAction } from '@/server/actions/social';
import { BRAND } from '@/lib/brand';

export function ListActions({
  listId,
  initialLiked,
  initialLikeCount,
  initialSaved,
  canEdit,
  isOwner,
  signedIn,
  ownerUsername,
  visibility,
}: {
  listId: string;
  initialLiked: boolean;
  initialLikeCount: number;
  initialSaved: boolean;
  canEdit: boolean;
  isOwner: boolean;
  signedIn: boolean;
  ownerUsername: string;
  visibility: 'public' | 'followers' | 'private';
}) {
  const router = useRouter();
  const toast = useToast();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialLikeCount);
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();
  const [reporting, setReporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visibility === 'public' ? <><button
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
          'flex min-h-11 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors sm:min-h-0',
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
              await navigator.share({ url, title: `A list on ${BRAND.short}` });
              return;
            } catch {
              /* dismissed */
            }
          }
          await navigator.clipboard.writeText(url);
          toast({ message: 'Link copied', tone: 'success' });
        }}
        className="flex min-h-11 items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:text-text sm:min-h-0"
      >
        <ShareIcon className="h-4 w-4" />
        Share
      </button></> : null}

      {visibility === 'public' ? (
        <a
          href={`/api/cards/list/${listId}`}
          download
          className="flex min-h-11 items-center rounded-md border border-line px-3 text-sm text-muted transition-colors hover:text-text sm:min-h-0 sm:py-1.5"
        >
          Download art
        </a>
      ) : null}

      {signedIn && !isOwner ? (
        <Button variant={saved ? 'secondary' : 'outline'} size="sm" disabled={pending} onClick={() => {
          const previous = saved;
          setSaved(!saved);
          startTransition(async () => {
            const result = await toggleSavedListAction(listId);
            if (!result.ok) {
              setSaved(previous);
              return toast({ message: result.error, tone: 'error' });
            }
            setSaved(result.data.saved);
            toast({ message: result.data.saved ? 'Saved privately' : 'Removed from Saved Lists', tone: 'success' });
          });
        }}>{saved ? 'Saved' : 'Save privately'}</Button>
      ) : null}

      {signedIn && !isOwner ? (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(async () => {
          const result = await cloneListAction(listId);
          if (!result.ok) return toast({ message: result.error, tone: 'error' });
          router.push(`/list/${result.data.id}`);
        })}>Clone</Button>
      ) : null}

      {isOwner ? (
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
      ) : signedIn && !canEdit ? (
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
