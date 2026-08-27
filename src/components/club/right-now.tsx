import Link from 'next/link';

import { Poster } from '@/components/film/poster';
import { Badge } from '@/components/ui/primitives';
import type { ClubAttentionItem, ClubAttentionKind } from '@/server/services/clubs';

const TONE: Record<ClubAttentionKind, 'ember' | 'iris'> = {
  tonight: 'ember',
  rate: 'ember',
  vote: 'iris',
  spin: 'iris',
  pick: 'iris',
  schedule: 'iris',
  rsvp: 'iris',
};

const LABEL: Record<ClubAttentionKind, string> = {
  tonight: 'Tonight',
  rate: 'Rate',
  vote: 'Vote',
  spin: 'Spin',
  pick: 'Pick',
  schedule: 'Schedule',
  rsvp: 'RSVP',
};

/**
 * The things a member needs to do, right now, across every club they belong
 * to — as opposed to everything they could browse. Appears only when
 * something is actually due; an empty list renders nothing, not an empty
 * dashboard.
 */
export function RightNow({ items }: { items: ClubAttentionItem[] }) {
  if (!items.length) return null;

  const shown = items.slice(0, 3);

  return (
    <section className="mb-8" aria-label="Right now">
      <p className="eyebrow mb-2.5">Right now</p>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((item, index) => (
          <Link
            key={`${item.clubId}-${item.kind}-${index}`}
            href={item.href}
            className="action-tile flex items-center gap-3 rounded-lg border border-iris/25 bg-iris/[0.06] p-3"
          >
            {item.movie ? (
              <div className="w-11 shrink-0">
                <Poster film={item.movie} size="xs" linked={false} ariaHidden />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <Badge tone={TONE[item.kind]} className="mb-1">
                {LABEL[item.kind]}
              </Badge>
              <p className="truncate text-sm font-medium leading-tight">{item.title}</p>
              {item.subtitle ? (
                <p className="truncate text-xs text-dim">{item.subtitle}</p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
