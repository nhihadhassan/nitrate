'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import {
  restoreRecommendationAction,
  setPersonFollowAction,
  setTasteCircleFeedAction,
  setTasteCircleMemberAction,
} from '@/server/actions/discovery';

type CirclePerson = { id: string; username: string; displayName: string };
type HiddenItem = {
  id: string;
  label: string;
  targetType: string;
  kind: 'hide' | 'already_know' | 'less_like_this';
  expiresAt: string | null;
};
type Filmmaker = { providerId: string; name: string };

export function DiscoverySettings({
  following,
  circle,
  feedEnabled,
  hidden,
  filmmakers,
}: {
  following: CirclePerson[];
  circle: CirclePerson[];
  feedEnabled: boolean;
  hidden: HiddenItem[];
  filmmakers: Filmmaker[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [circleIds, setCircleIds] = useState(() => new Set(circle.map((person) => person.id)));
  const [enabled, setEnabled] = useState(feedEnabled);
  const [pending, startTransition] = useTransition();

  const updateCircle = (person: CirclePerson, included: boolean) => {
    const previous = new Set(circleIds);
    setCircleIds((current) => {
      const next = new Set(current);
      if (included) next.add(person.id); else next.delete(person.id);
      return next;
    });
    startTransition(async () => {
      const result = await setTasteCircleMemberAction(person.id, included);
      if (!result.ok) {
        setCircleIds(previous);
        return toast({ message: result.error, tone: 'error' });
      }
      toast({ message: included ? 'Added to your Taste circle' : 'Removed from your Taste circle', tone: 'success' });
      router.refresh();
    });
  };

  return (
    <div className="max-w-2xl space-y-10">
      <section>
        <h2 className="text-2xl">Taste circle</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Choose up to five people you follow. Your circle is private and never appears on their profile.
        </p>
        <label className="mt-5 flex min-h-14 cursor-pointer items-start gap-3 rounded-md border border-line px-3 py-3">
          <input
            type="checkbox"
            checked={enabled}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.checked;
              setEnabled(next);
              startTransition(async () => {
                const result = await setTasteCircleFeedAction(next);
                if (!result.ok) {
                  setEnabled(!next);
                  return toast({ message: result.error, tone: 'error' });
                }
                toast({ message: next ? 'Taste circle feed enabled' : 'Taste circle feed disabled', tone: 'success' });
              });
            }}
            className="mt-0.5 h-5 w-5 accent-[var(--ember)]"
          />
          <span>
            <span className="block text-sm font-medium">Show the optional Taste circle feed</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-dim">A separate chronological view. It never changes the order of Home.</span>
          </span>
        </label>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {following.map((person) => {
            const included = circleIds.has(person.id);
            return (
              <li key={person.id} className="flex min-h-14 items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{person.displayName}</p>
                  <p className="truncate text-xs text-dim">@{person.username}</p>
                </div>
                <Button
                  size="sm"
                  variant={included ? 'secondary' : 'outline'}
                  disabled={pending || (!included && circleIds.size >= 5)}
                  onClick={() => updateCircle(person, !included)}
                >
                  {included ? 'In circle' : 'Add'}
                </Button>
              </li>
            );
          })}
        </ul>
        {!following.length ? <p className="mt-4 text-sm text-dim">Follow someone first, then return here to add them.</p> : null}
      </section>

      <section>
        <h2 className="text-2xl">Hidden recommendations</h2>
        <p className="mt-1.5 text-sm text-muted">Every choice is reversible. Expiring choices restore themselves automatically.</p>
        {hidden.length ? (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {hidden.map((item) => (
              <li key={item.id} className="flex min-h-14 items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-0.5 text-xs text-dim">{feedbackDescription(item)}</p>
                </div>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => {
                  const result = await restoreRecommendationAction(item.id);
                  if (!result.ok) return toast({ message: result.error, tone: 'error' });
                  toast({ message: 'Recommendation restored', tone: 'success' });
                  router.refresh();
                })}>Restore</Button>
              </li>
            ))}
          </ul>
        ) : <p className="mt-4 rounded-md border border-line p-4 text-sm text-dim">No active recommendation controls.</p>}
      </section>

      <section>
        <h2 className="text-2xl">Followed filmmakers</h2>
        <p className="mt-1.5 text-sm text-muted">Known upcoming work appears below. Nitrate does not promise release notifications.</p>
        {filmmakers.length ? <ul className="mt-4 divide-y divide-line border-y border-line">{filmmakers.map((person) => (
          <li key={person.providerId} className="flex min-h-14 items-center justify-between gap-3 py-3">
            <a className="text-sm font-medium hover:text-ember" href={`/person/${person.providerId}`}>{person.name}</a>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(async () => {
              const result = await setPersonFollowAction(person.providerId, false);
              if (!result.ok) return toast({ message: result.error, tone: 'error' });
              router.refresh();
            })}>Unfollow</Button>
          </li>
        ))}</ul> : <p className="mt-4 text-sm text-dim">You are not following any filmmakers yet.</p>}
      </section>
    </div>
  );
}

function feedbackDescription(item: HiddenItem): string {
  if (item.kind === 'already_know') return 'Already know · hidden until restored';
  const until = item.expiresAt ? new Date(item.expiresAt).toLocaleDateString('en-CA') : 'restored';
  return item.kind === 'hide' ? `Hidden until ${until}` : `Less like this until ${until}`;
}
