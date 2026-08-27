'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { ListCard, type ListCardData } from '@/components/list/list-card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { setListPinnedAction } from '@/server/actions/lists';

export function ListLibraryCard({
  list,
  author,
  initialPinned,
  pinKind,
}: {
  list: ListCardData;
  author: { username: string; displayName: string };
  initialPinned: boolean;
  pinKind: 'owned' | 'saved' | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pinned, setPinned] = useState(initialPinned);
  const [pending, startTransition] = useTransition();
  return (
    <article className="relative">
      <ListCard list={list} author={author} />
      {pinKind ? <Button
        size="sm"
        variant={pinned ? 'secondary' : 'ghost'}
        disabled={pending}
        aria-pressed={pinned}
        className="absolute right-2 top-2 z-10 bg-canvas-raised/90"
        onClick={() => {
          const next = !pinned;
          setPinned(next);
          startTransition(async () => {
            const result = await setListPinnedAction({ listId: list.id, pinned: next, kind: pinKind });
            if (!result.ok) {
              setPinned(!next);
              return toast({ message: result.error, tone: 'error' });
            }
            router.refresh();
          });
        }}
      >{pinned ? 'Pinned' : 'Pin'}</Button> : null}
    </article>
  );
}
