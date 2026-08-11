import { cn } from '@/lib/utils';

/**
 * Read-only rating display. Half-stars are drawn by clipping a second star layer
 * rather than using a distinct glyph, so any value 0.5–5 renders precisely.
 */
export function Stars({
  value,
  size = 'md',
  className,
  showValue,
  tone = 'ember',
}: {
  value: number | null | undefined;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showValue?: boolean;
  tone?: 'ember' | 'muted';
}) {
  if (value == null) return null;
  const stars = value / 2;
  const pct = Math.max(0, Math.min(100, (stars / 5) * 100));

  const dims = {
    xs: 'text-[0.6875rem]',
    sm: 'text-[0.8125rem]',
    md: 'text-base',
    lg: 'text-2xl',
  }[size];

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 align-middle', className)}
      title={`${stars} out of 5`}
    >
      <span className={cn('relative inline-block leading-none tracking-[0.08em]', dims)} aria-hidden>
        <span className={tone === 'ember' ? 'text-line-strong' : 'text-line'}>★★★★★</span>
        <span
          className={cn(
            'absolute inset-0 overflow-hidden whitespace-nowrap',
            tone === 'ember' ? 'text-ember' : 'text-muted',
          )}
          style={{ width: `${pct}%` }}
        >
          ★★★★★
        </span>
      </span>
      <span className="sr-only">{stars} out of 5 stars</span>
      {showValue ? (
        <span className="text-xs text-muted tabular">
          {Number.isInteger(stars) ? stars.toFixed(1) : stars.toFixed(1)}
        </span>
      ) : null}
    </span>
  );
}

/** Compact "★ 3.8" used in dense contexts like feed meta rows. */
export function AverageRating({
  average,
  count,
  className,
}: {
  average: number | null;
  count: number;
  className?: string;
}) {
  if (average == null || count === 0) {
    return <span className={cn('text-xs text-dim', className)}>No ratings yet</span>;
  }
  return (
    <span className={cn('inline-flex items-baseline gap-1', className)}>
      <span aria-hidden className="text-ember">
        ★
      </span>
      <span className="font-medium tabular">{(average / 2).toFixed(1)}</span>
      <span className="text-xs text-dim tabular">
        ({count.toLocaleString()})
      </span>
    </span>
  );
}

/** Small heart used for the Like state, which is independent of the rating. */
export function LikeMark({ className, filled = true }: { className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn('h-[1em] w-[1em]', className)}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
    >
      <path d="M12 20.7 3.9 12.9a5.2 5.2 0 0 1 0-7.4 5.2 5.2 0 0 1 7.4 0l.7.7.7-.7a5.2 5.2 0 0 1 7.4 0 5.2 5.2 0 0 1 0 7.4Z" />
    </svg>
  );
}
