import { CLUB_STAGES, type ClubStage } from '@/lib/club';
import { cn } from '@/lib/utils';

/**
 * Where the club is in its loop, at a glance.
 *
 * Deliberately not a progress bar: the cycle never finishes, it comes round
 * again. Stages before the current one are dimmed rather than ticked, and the
 * whole strip collapses to the current stage plus its neighbours on small
 * screens, where nine labels would be unreadable anyway.
 */
export function LifecycleStrip({ stage, headline }: { stage: ClubStage; headline: string }) {
  const currentIndex = CLUB_STAGES.findIndex((step) => step.key === stage);

  return (
    <section aria-label="Where the club is" className="rounded-lg border border-line bg-surface/40 p-4">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.6875rem] uppercase tracking-wide">
        {CLUB_STAGES.map((step, index) => {
          const isCurrent = step.key === stage;
          const isPast = index < currentIndex;
          return (
            <li key={step.key} className="flex items-center gap-1.5">
              <span
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'rounded-xs px-1.5 py-0.5 transition-colors',
                  isCurrent
                    ? 'bg-iris/15 font-semibold text-iris'
                    : isPast
                      ? 'text-muted'
                      : 'text-dim',
                  // Off-stage steps get out of the way on narrow screens.
                  !isCurrent && Math.abs(index - currentIndex) > 1 && 'hidden sm:inline-block',
                )}
              >
                {step.label}
              </span>
              {index < CLUB_STAGES.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    'text-dim',
                    Math.abs(index - currentIndex) > 1 && 'hidden sm:inline',
                  )}
                >
                  ›
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-2.5 text-sm text-muted">{headline}</p>
    </section>
  );
}
