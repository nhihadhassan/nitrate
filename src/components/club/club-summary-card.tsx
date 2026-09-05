import Link from 'next/link';

import { ClubCover } from '@/components/club/club-cover';
import { Poster } from '@/components/film/poster';
import { Badge } from '@/components/ui/primitives';
import { AvatarStack } from '@/components/user/avatar';
import type { ClubSummary } from '@/server/services/clubs';
import { cn } from '@/lib/utils';

/**
 * A club, as it appears in a grid.
 *
 * The club's own picture is the card — a cropped banner across the top, scrimmed
 * into the body — because a club is a group of people, and a photograph of them
 * identifies it faster than any amount of typeset metadata. Everything below the
 * banner answers one question: *is there something for me to do here?* The whole
 * card is the target; there are no competing buttons inside it.
 */
export function ClubSummaryCard({ summary, compact = false }: { summary: ClubSummary; compact?: boolean }) {
  const { club, role, members, nextScreening, attention, stateLabel, stateDetail, cadenceLine } = summary;

  return (
    <Link
      href={attention?.href ?? `/club/${club.slug}`}
      className={cn(
        'interactive-card group relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-canvas-raised transition-[border-color,transform] hover:border-iris/45 active:scale-[0.985]',
        compact ? 'w-[17rem] shrink-0' : '',
      )}
      data-pointer-light
    >
      <ClubCover
        name={club.name}
        imageAssetId={club.imageAssetId}
        posterPath={nextScreening?.movie.posterPath ?? null}
        className={compact ? 'h-24' : 'h-32 sm:h-36'}
        sizes={compact ? '272px' : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'}
      >
        {/* The badge sits on a photograph, so it carries its own ground rather
            than trusting whatever happens to be behind it in either theme. */}
        {role !== 'member' ? (
          <span className="absolute right-2.5 top-2.5 rounded-md bg-canvas-raised/85 p-[3px] backdrop-blur-sm">
            <Badge tone="iris">{role}</Badge>
          </span>
        ) : null}

        {/* The next movie's poster is the one piece of artwork a member is
            actually waiting on. It sits inside the banner rather than straddling
            its edge, so the picture keeps one clean seam into the card body. */}
        {nextScreening ? (
          <span className={cn('absolute bottom-2.5 left-3.5 block', compact ? 'w-9' : 'w-11')}>
            <Poster
              film={nextScreening.movie}
              size="sm"
              linked={false}
              ariaHidden
              className="shadow-pop ring-1 ring-white/12"
            />
          </span>
        ) : null}
      </ClubCover>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <h2 className={cn('font-display leading-tight', compact ? 'text-lg' : 'text-xl')}>{club.name}</h2>
        <div className="mt-2">
          <AvatarStack users={members} max={compact ? 4 : 5} size="sm" />
        </div>

        <div className="mt-auto pt-4">
          <p className="eyebrow text-iris">{cadenceLine}</p>
          <p className="mt-1.5 text-sm font-medium text-text">{stateLabel}</p>
          {stateDetail ? <p className="mt-0.5 line-clamp-1 text-xs text-dim">{stateDetail}</p> : null}
        </div>
      </div>
    </Link>
  );
}
