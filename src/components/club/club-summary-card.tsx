import Link from 'next/link';

import { Poster } from '@/components/film/poster';
import { Badge } from '@/components/ui/primitives';
import { AvatarStack } from '@/components/user/avatar';
import type { ClubSummary } from '@/server/services/clubs';
import { cn } from '@/lib/utils';

export function ClubSummaryCard({ summary, compact = false }: { summary: ClubSummary; compact?: boolean }) {
  const { club, role, members, nextScreening, attention, stateLabel, stateDetail } = summary;
  return (
    <Link
      href={attention?.href ?? `/club/${club.slug}`}
      className={cn(
        'interactive-card group flex h-full min-w-0 overflow-hidden rounded-xl border border-line bg-canvas-raised transition-[border-color,transform] hover:border-iris/45 active:scale-[0.985]',
        compact ? 'w-[17rem] shrink-0' : 'min-h-44',
      )}
      data-pointer-light
    >
      {nextScreening ? (
        <div className={cn('shrink-0', compact ? 'w-[5.4rem]' : 'w-28')}>
          <Poster film={nextScreening.movie} size="md" linked={false} className="h-full rounded-none border-0" />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className={cn('font-display leading-tight', compact ? 'text-lg' : 'text-xl')}>{club.name}</h2>
          {role !== 'member' ? <Badge tone="iris">{role}</Badge> : null}
        </div>
        <div className="mt-3">
          <AvatarStack users={members} max={compact ? 4 : 5} size="sm" />
        </div>
        <div className="mt-auto pt-4">
          {attention ? <p className="eyebrow text-iris">{stateLabel}</p> : null}
          {!attention ? <p className="text-sm font-medium text-text">{stateLabel}</p> : null}
          {attention ? <p className="mt-1 text-sm font-medium">{attention.title.replace(` for ${club.name}`, '')}</p> : null}
          {stateDetail ? <p className="mt-0.5 line-clamp-1 text-xs text-dim">{stateDetail}</p> : null}
        </div>
      </div>
    </Link>
  );
}
