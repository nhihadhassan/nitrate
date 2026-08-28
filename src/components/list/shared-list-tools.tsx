'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { FilmPicker } from '@/components/log/film-picker';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { VISIBILITY_LABELS, type Visibility } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  addListItemAction,
  inviteListCollaboratorAction,
  removeListCollaboratorAction,
  removeListItemAction,
  reorderListAction,
  revokeListInvitationAction,
  transferListToMovieIdeasAction,
  updateListAction,
  updateListItemNoteAction,
} from '@/server/actions/lists';

type EditableItem = {
  id: string;
  movieId: string;
  providerId: string;
  title: string;
  year: number | null;
  note: string | null;
};

export function ListEditor({
  listId,
  initialVersion,
  initialItems,
}: {
  listId: string;
  initialVersion: number;
  initialItems: EditableItem[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(initialItems);
  const [version, setVersion] = useState(initialVersion);
  const [pending, startTransition] = useTransition();

  const reorder = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length || pending) return;
    const previous = [...items];
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    startTransition(async () => {
      const result = await reorderListAction(listId, next.map((item) => item.id), version);
      if (!result.ok) {
        setItems(previous);
        toast({ message: result.error, tone: 'error' });
        router.refresh();
        return;
      }
      setVersion(result.data.version);
    });
  };

  return (
    <details className="rounded-lg border border-line bg-surface/20 p-4">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Edit films and notes</summary>
      <div className="mt-4 space-y-4">
        <FilmPicker
          placeholder="Add a film…"
          excludeProviderIds={items.map((item) => item.providerId)}
          onPick={(film) => startTransition(async () => {
            const result = await addListItemAction({ listId, movieId: film.movieId, providerId: film.providerId });
            if (!result.ok) return toast({ message: result.error, tone: 'error' });
            if (!result.data.added) return toast({ message: 'That film is already on the list', tone: 'error' });
            setVersion(result.data.version);
            router.refresh();
          })}
        />
        <ol className="divide-y divide-line border-y border-line">
          {items.map((item, index) => (
            <li key={item.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-xs text-dim">{item.year ?? 'Year unknown'}</p>
              </div>
              <input
                defaultValue={item.note ?? ''}
                maxLength={500}
                aria-label={`Note for ${item.title}`}
                placeholder="Add a contribution note"
                className={cn(inputClass, 'h-10 text-xs')}
                onBlur={(event) => {
                  const note = event.currentTarget.value.trim() || null;
                  if (note === item.note) return;
                  startTransition(async () => {
                    const result = await updateListItemNoteAction({ listId, itemId: item.id, note });
                    if (!result.ok) return toast({ message: result.error, tone: 'error' });
                    setVersion(result.data.version);
                    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, note } : entry));
                  });
                }}
              />
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={pending || index === 0} aria-label={`Move ${item.title} up`} onClick={() => reorder(index, -1)}>↑</Button>
                <Button size="icon" variant="ghost" disabled={pending || index === items.length - 1} aria-label={`Move ${item.title} down`} onClick={() => reorder(index, 1)}>↓</Button>
                <Button size="icon" variant="ghost" disabled={pending} aria-label={`Remove ${item.title}`} onClick={() => startTransition(async () => {
                  const result = await removeListItemAction(listId, item.id);
                  if (!result.ok) return toast({ message: result.error, tone: 'error' });
                  if (result.data.removed) {
                    setVersion(result.data.version);
                    setItems((current) => current.filter((entry) => entry.id !== item.id));
                  }
                })}>×</Button>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-xs text-dim">List version {version}. Reordering refuses stale changes from another tab.</p>
      </div>
    </details>
  );
}

export function ListOwnerSettings({ list }: {
  list: {
    id: string;
    title: string;
    description: string | null;
    visibility: Visibility;
    isRanked: boolean;
    allowCollaborators: boolean;
    isPinned: boolean;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(list);
  const [pending, startTransition] = useTransition();
  return (
    <details className="rounded-lg border border-line bg-surface/20 p-4">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">List settings</summary>
      <form className="mt-4 space-y-4" onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const { id, ...patch } = value;
          const result = await updateListAction({ listId: id, ...patch });
          if (!result.ok) return toast({ message: result.error, tone: 'error' });
          toast({ message: 'List settings saved', tone: 'success' });
          router.refresh();
        });
      }}>
        <Field label="Title" htmlFor="shared-list-title"><input id="shared-list-title" required maxLength={120} className={inputClass} value={value.title} onChange={(event) => setValue((current) => ({ ...current, title: event.target.value }))} /></Field>
        <Field label="Description" htmlFor="shared-list-description" optional><textarea id="shared-list-description" rows={3} maxLength={2000} className={inputClass} value={value.description ?? ''} onChange={(event) => setValue((current) => ({ ...current, description: event.target.value || null }))} /></Field>
        <fieldset><legend className="mb-2 text-sm font-medium">Visibility</legend><div className="flex flex-wrap gap-2">{(Object.keys(VISIBILITY_LABELS) as Visibility[]).map((visibility) => <Button key={visibility} size="sm" variant={value.visibility === visibility ? 'primary' : 'outline'} aria-pressed={value.visibility === visibility} onClick={() => setValue((current) => ({ ...current, visibility }))}>{VISIBILITY_LABELS[visibility]}</Button>)}</div></fieldset>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={value.isRanked} onChange={(event) => setValue((current) => ({ ...current, isRanked: event.target.checked }))} className="h-5 w-5 accent-[var(--ember)]" /> Show ranked numbers</label>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={value.allowCollaborators} onChange={(event) => setValue((current) => ({ ...current, allowCollaborators: event.target.checked }))} className="h-5 w-5 accent-[var(--ember)]" /> Allow accepted editors to contribute</label>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={value.isPinned} onChange={(event) => setValue((current) => ({ ...current, isPinned: event.target.checked }))} className="h-5 w-5 accent-[var(--ember)]" /> Pin in your list library</label>
        <Button type="submit" variant="primary" disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</Button>
      </form>
    </details>
  );
}

export function CollaboratorManager({
  listId,
  collaborators,
  invitations,
}: {
  listId: string;
  collaborators: Array<{ id: string; username: string; displayName: string }>;
  invitations: Array<{ id: string; username: string; displayName: string; status: string; expiresAt: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [pending, startTransition] = useTransition();
  return (
    <details className="rounded-lg border border-line bg-surface/20 p-4">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Editors and invitations</summary>
      <div className="mt-4 space-y-5">
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const result = await inviteListCollaboratorAction({ listId, username });
            if (!result.ok) return toast({ message: result.error, tone: 'error' });
            setUsername('');
            toast({ message: 'Editor invitation sent', tone: 'success' });
            router.refresh();
          });
        }}>
          <input value={username} onChange={(event) => setUsername(event.target.value)} className={inputClass} placeholder="Username" aria-label="Invite editor by username" required />
          <Button type="submit" variant="primary" disabled={pending || !username.trim()}>Invite editor</Button>
        </form>
        <ul className="divide-y divide-line border-y border-line">{collaborators.map((person) => <li key={person.id} className="flex min-h-14 items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">{person.displayName}</p><p className="text-xs text-dim">@{person.username} · Editor</p></div><Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(async () => { const result = await removeListCollaboratorAction(listId, person.id); if (!result.ok) return toast({ message: result.error, tone: 'error' }); router.refresh(); })}>Remove</Button></li>)}</ul>
        {invitations.length ? <div><p className="eyebrow mb-2">Invitation history</p><ul className="space-y-2">{invitations.map((invite) => <li key={invite.id} className="flex items-center justify-between gap-3 text-xs"><span>{invite.displayName} · {invite.status}</span>{invite.status === 'pending' ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(async () => { const result = await revokeListInvitationAction(invite.id); if (!result.ok) return toast({ message: result.error, tone: 'error' }); router.refresh(); })}>Revoke</Button> : null}</li>)}</ul></div> : null}
      </div>
    </details>
  );
}

export function MovieIdeasTransfer({
  listId,
  items,
  clubs,
}: {
  listId: string;
  items: Array<{ movieId: string; title: string }>;
  clubs: Array<{ id: string; name: string }>;
}) {
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clubId, setClubId] = useState(clubs[0]?.id ?? '');
  const [pending, startTransition] = useTransition();
  if (!clubs.length || !items.length) return null;
  return (
    <details className="rounded-lg border border-line bg-surface/20 p-4">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Transfer selected films to Movie Ideas</summary>
      <div className="mt-4 space-y-4">
        <select value={clubId} onChange={(event) => setClubId(event.target.value)} className={inputClass} aria-label="Destination Movie Club">{clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select>
        <ul className="grid gap-2 sm:grid-cols-2">{items.map((item) => { const checked = selected.has(item.movieId); return <li key={item.movieId}><label className="flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-sm"><input type="checkbox" checked={checked} disabled={!checked && selected.size >= 25} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(item.movieId); else next.delete(item.movieId); return next; })} className="h-5 w-5 accent-[var(--ember)]" /><span className="truncate">{item.title}</span></label></li>; })}</ul>
        <div className="flex items-center justify-between gap-3"><p className="text-xs text-dim">{selected.size}/25 selected. Existing Movie Ideas are skipped.</p><Button variant="iris" disabled={pending || !selected.size || !clubId} onClick={() => startTransition(async () => { const result = await transferListToMovieIdeasAction({ listId, clubId, movieIds: [...selected] }); if (!result.ok) return toast({ message: result.error, tone: 'error' }); toast({ message: `${result.data.added} added · ${result.data.skipped} skipped`, tone: 'success' }); setSelected(new Set()); })}>Transfer</Button></div>
      </div>
    </details>
  );
}
