'use client';

import Link from 'next/link';

import { Press } from '@/components/motion/primitives';
import { Poster, type PosterFilm } from '@/components/film/poster';
import { Avatar, type AvatarUser } from '@/components/user/avatar';
import { CheckIcon, ChevronRightIcon, FilmIcon } from '@/components/ui/icons';
import { backdropUrl } from '@/lib/images';
import type { ClubStageCard } from '@/lib/club-stage';
import { cn } from '@/lib/utils';

/**
 * The club's current stage, as the one thing worth looking at on a phone.
 *
 * There is exactly one of these on the club home, it always describes where
 * the club actually is, and it carries a single primary action. The words come
 * from `resolveClubStageCard`; this file only decides what the stage looks
 * like — picks as a row of posters, a chosen film as its own artwork.
 *
 * It renders only what it is given. A stage that must not reveal the winner is
 * simply not handed one.
 */
export function ClubStageCardView({
  card,
  picks = [],
  members = [],
  film,
  backdropPath,
  progress,
  secondaryAction,
}: {
  card: ClubStageCard;
  /** Submitted picks, for the stages where seeing them is the point. */
  picks?: PosterFilm[];
  /** Who has picked and who has not. */
  members?: (AvatarUser & { id: string; ready: boolean })[];
  /** The chosen film, once the viewer is allowed to see it. */
  film?: PosterFilm | null;
  backdropPath?: string | null;
  /** Ready/total, drawn as a bar so the count is readable at a glance. */
  progress?: { done: number; total: number } | null;
  /** An optional second, quieter way out of this stage. */
  secondaryAction?: { label: string; href: string } | null;
}) {
  const backdrop = backdropUrl(backdropPath, 'sm');

  if (card.kind === 'new' && card.action) {
    return (
      <Press>
        <Link
          href={card.action.href}
          className="group relative grid min-h-[6.25rem] grid-cols-[5.25rem_minmax(0,1fr)_2rem] items-center gap-3 overflow-hidden rounded-xl border border-iris/35 bg-canvas-raised p-2.5 pr-3 shadow-[0_18px_45px_rgb(0_0_0/0.24)] focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-offset-2"
          aria-labelledby="club-next-selection-headline"
        >
          <span
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_84%_125%,rgb(94_64_210/0.32),transparent_48%),radial-gradient(circle_at_18%_-25%,rgb(234_88_50/0.15),transparent_42%)] opacity-90 transition-opacity duration-200 group-hover:opacity-100"
          />
          <span className="relative flex aspect-[1.12] h-full min-h-[4.75rem] items-center justify-center overflow-hidden rounded-lg border border-line/70 bg-[radial-gradient(circle_at_42%_38%,rgb(234_88_50/0.28),transparent_28%),linear-gradient(145deg,rgb(35_42_55),rgb(12_17_22))] text-ember shadow-inner">
            <FilmIcon className="h-9 w-9 drop-shadow-[0_5px_14px_rgb(0_0_0/0.55)]" />
          </span>
          <span className="relative min-w-0">
            <span className="eyebrow block text-[0.625rem] tracking-[0.22em] text-dim">Next selection</span>
            <span
              id="club-next-selection-headline"
              className="mt-1 block font-display text-[1.35rem] leading-none text-text"
            >
              Choose next movie
            </span>
            <span className="mt-2 flex items-center gap-2">
              {members.length ? (
                <span className="flex -space-x-1.5" aria-hidden>
                  {members.slice(0, 5).map((member) => (
                    <Avatar key={member.id} user={member} size="xs" className="ring-2 ring-canvas-raised" />
                  ))}
                </span>
              ) : null}
              <span className="truncate text-xs text-muted">
                {members.length
                  ? `${members.length} ${members.length === 1 ? 'member' : 'members'}`
                  : card.headline}
              </span>
            </span>
          </span>
          <ChevronRightIcon className="relative h-5 w-5 text-muted transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-text" />
        </Link>
      </Press>
    );
  }

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-iris/25 bg-canvas-raised"
      style={{ boxShadow: 'var(--shadow-raised)' }}
      aria-labelledby="club-stage-headline"
    >
      {backdrop ? (
        <>
          <span
            aria-hidden
            className="absolute inset-0 bg-cover bg-center opacity-25"
            style={{ backgroundImage: `url(${backdrop})` }}
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-canvas-raised via-canvas-raised/85 to-canvas-raised/40"
          />
        </>
      ) : null}

      <div className="relative p-5">
        <p className="eyebrow text-iris">{card.label}</p>

        <div className={cn('mt-2 flex gap-4', film ? 'items-start' : 'items-baseline')}>
          {film ? (
            <div className="w-20 shrink-0">
              <Poster film={film} size="sm" linked={false} priority />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2
              id="club-stage-headline"
              className="font-display text-[1.75rem] leading-[1.1] text-text"
            >
              {card.headline}
            </h2>
            {card.meta ? <p className="mt-1.5 text-sm text-muted">{card.meta}</p> : null}
            {progress && progress.total > 0 ? (
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-strong"
                role="progressbar"
                aria-valuenow={progress.done}
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-label={`${progress.done} of ${progress.total} ready`}
              >
                <span
                  className="block h-full rounded-full bg-ember transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
            ) : null}
          </div>
        </div>

        {picks.length ? (
          <ul
            className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Movies picked so far"
          >
            {picks.map((pick, index) => (
              <li key={`${pick.slug}-${index}`} className="w-14 shrink-0">
                <Poster film={pick} size="xs" linked={false} priority={index === 0} />
              </li>
            ))}
          </ul>
        ) : null}

        {members.length ? (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Who has picked">
            {members.map((member) => (
              <li key={member.id} className="relative">
                <Avatar
                  user={member}
                  size="sm"
                  className={member.ready ? 'border-jade/60' : 'opacity-50'}
                />
                {member.ready ? (
                  <span
                    aria-hidden
                    className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-jade text-canvas ring-2 ring-canvas-raised"
                  >
                    <CheckIcon className="h-2.5 w-2.5" />
                  </span>
                ) : null}
                <span className="sr-only">
                  {member.displayName} {member.ready ? 'has picked' : 'has not picked yet'}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {card.action ? (
          <Press className="mt-5">
            <Link
              href={card.action.href}
              className="flex min-h-12 w-full items-center justify-center rounded-full bg-ember px-5 text-[0.9375rem] font-medium text-inverse focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-offset-2"
            >
              {card.action.label}
            </Link>
          </Press>
        ) : null}

        {secondaryAction ? (
          <Link
            href={secondaryAction.href}
            className="mt-2 flex min-h-11 w-full items-center justify-center rounded-full border border-line text-sm text-muted hover:border-line-strong hover:text-text"
          >
            {secondaryAction.label}
          </Link>
        ) : null}

        {card.waitingOn ? (
          <p className={cn('text-xs text-dim', card.action ? 'mt-3 text-center' : 'mt-5')}>
            {card.waitingOn}
          </p>
        ) : null}
      </div>
    </section>
  );
}
