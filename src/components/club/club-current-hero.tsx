import Link from 'next/link';

import { Poster } from '@/components/film/poster';
import { Button } from '@/components/ui/button';
import { AvatarStack, type AvatarUser } from '@/components/user/avatar';
import type { ClubDashboardView } from '@/lib/club';

export function ClubCurrentHero({
  view,
  movie,
  actionHref,
  dateLabel,
  location,
  going = [],
}: {
  view: ClubDashboardView;
  movie?: { slug: string; title: string; year: number | null; posterPath: string | null } | null;
  actionHref?: string | null;
  dateLabel?: string | null;
  location?: string | null;
  going?: AvatarUser[];
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-iris/30 bg-[linear-gradient(145deg,rgba(97,80,180,0.16),rgba(20,18,24,0.82)_62%)] shadow-pop motion-safe:animate-[nitrate-rise_220ms_cubic-bezier(0.22,1,0.36,1)_both]">
      <div className="flex min-h-[15rem] gap-4 p-5 sm:min-h-[18rem] sm:gap-7 sm:p-7">
        {movie ? (
          <div className="w-28 shrink-0 self-end sm:w-40">
            <Poster film={movie} size="lg" linked={false} />
          </div>
        ) : (
          <div className="hidden w-28 shrink-0 self-stretch items-end sm:flex">
            <span className="font-display text-7xl text-iris/25" aria-hidden>01</span>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-end">
          <p className="eyebrow text-iris">{view.eyebrow}</p>
          <h2 className="mt-1 text-3xl leading-[1.05] sm:text-5xl">{view.title}</h2>
          {dateLabel ? <p className="mt-3 text-base font-medium tabular text-text">{dateLabel}</p> : null}
          {location ? <p className="mt-0.5 text-sm text-muted">{location}</p> : null}
          {!dateLabel && view.detail ? <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{view.detail}</p> : null}
          {going.length ? <div className="mt-3"><AvatarStack users={going} max={6} /><span className="ml-3 text-xs text-dim">{going.length} going</span></div> : null}
          {view.actionLabel && actionHref ? (
            <div className="mt-5">
              <Button asChild variant="iris" size="lg"><Link href={actionHref}>{view.actionLabel}</Link></Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
