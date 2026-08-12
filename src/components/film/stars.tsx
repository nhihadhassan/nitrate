import { ratingLabel } from '@/lib/utils';
import { cn } from '@/lib/utils';

/**
 * Every read-only rating in the product renders through this file.
 *
 * Accessibility is the reason it is centralised. The star row is drawn by
 * clipping a second layer of five glyphs over a first — visually exact for any
 * half-star value, but ten `★` characters to a screen reader, which used to
 * announce as "black star black star black star…" on every card in a grid. The
 * glyphs are therefore `aria-hidden` and the whole component carries a single
 * `role="img"` with a real sentence: "4.5 out of 5 stars".
 *
 * If you need stars somewhere new, use these. Do not hand-roll `'★'.repeat(n)`.
 */
export function Stars({
  value,
  size = 'md',
  className,
  showValue,
  tone = 'ember',
  /** Prefix for context, e.g. "Nina rated this". */
  labelPrefix,
}: {
  value: number | null | undefined;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showValue?: boolean;
  tone?: 'ember' | 'muted';
  labelPrefix?: string;
}) {
  if (value == null) return null;
  const stars = value / 2;
  const pct = Math.max(0, Math.min(100, (stars / 5) * 100));
  const label = labelPrefix ? `${labelPrefix}: ${ratingLabel(value)}` : ratingLabel(value);

  const dims = {
    xs: 'text-[0.6875rem]',
    sm: 'text-[0.8125rem]',
    md: 'text-base',
    lg: 'text-2xl',
  }[size];

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 align-middle', className)}
      role="img"
      aria-label={label}
      title={label}
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
      {showValue ? (
        <span aria-hidden className="text-xs text-muted tabular">
          {stars.toFixed(1)}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Compact "★ 3.8 (1,204)" for dense meta rows. One announcement, not three
 * fragments — a screen reader hears the sentence, not the punctuation.
 */
export function AverageRating({
  average,
  count,
  className,
  emptyLabel = 'No ratings yet',
}: {
  average: number | null;
  count: number;
  className?: string;
  emptyLabel?: string;
}) {
  if (average == null || count === 0) {
    return <span className={cn('text-xs text-dim', className)}>{emptyLabel}</span>;
  }
  const stars = (average / 2).toFixed(1);
  return (
    <span
      className={cn('inline-flex items-baseline gap-1', className)}
      role="img"
      aria-label={`${stars} out of 5 stars from ${count.toLocaleString()} ${
        count === 1 ? 'rating' : 'ratings'
      }`}
    >
      <span aria-hidden className="text-ember">
        ★
      </span>
      <span aria-hidden className="font-medium tabular">
        {stars}
      </span>
      <span aria-hidden className="text-xs text-dim tabular">
        ({count.toLocaleString()})
      </span>
    </span>
  );
}

/**
 * A large numeric rating, for panels where the number is the headline. The
 * caller supplies the surrounding label, so this stays decorative.
 */
export function RatingNumber({
  average,
  className,
  placeholder = '—',
}: {
  average: number | null;
  className?: string;
  placeholder?: string;
}) {
  return (
    <span className={cn('font-display leading-none tabular', className)}>
      {average == null ? placeholder : (average / 2).toFixed(1)}
    </span>
  );
}

/**
 * Small heart for the Like state, which is independent of the rating.
 * Decorative by default; pass a `label` where the heart is the only thing
 * carrying the meaning.
 */
export function LikeMark({
  className,
  filled = true,
  label,
}: {
  className?: string;
  filled?: boolean;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('h-[1em] w-[1em]', className)}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
    >
      {label ? <title>{label}</title> : null}
      <path d="M12 20.7 3.9 12.9a5.2 5.2 0 0 1 0-7.4 5.2 5.2 0 0 1 7.4 0l.7.7.7-.7a5.2 5.2 0 0 1 7.4 0 5.2 5.2 0 0 1 0 7.4Z" />
    </svg>
  );
}

/**
 * A rating distribution. Bars are scaled to the tallest bucket so shape stays
 * readable at any volume; the accessible name carries the actual summary,
 * because ten unlabelled bars are noise to a screen reader.
 */
export function RatingHistogram({
  buckets,
  total,
  className,
  height = 'h-14',
}: {
  buckets: { rating: number; count: number; percent: number }[];
  total: number;
  className?: string;
  height?: string;
}) {
  if (!total) return null;
  const top = buckets.reduce((best, bucket) => (bucket.count > best.count ? bucket : best), buckets[0]);
  return (
    <div className={className}>
      <div
        className={cn('flex items-end gap-[3px]', height)}
        role="img"
        aria-label={`Rating distribution across ${total.toLocaleString()} ${
          total === 1 ? 'rating' : 'ratings'
        }. Most common: ${top.rating / 2} out of 5 stars.`}
      >
        {buckets.map((bucket) => (
          <div
            key={bucket.rating}
            className="group relative flex h-full flex-1 items-end"
            title={`${bucket.rating / 2} out of 5 — ${bucket.count.toLocaleString()}`}
          >
            <div
              className="w-full rounded-t-[1px] bg-ember/70 transition-colors group-hover:bg-ember"
              style={{
                height: `${Math.max(bucket.percent, bucket.count ? 6 : 2)}%`,
                minHeight: '2px',
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[0.625rem] text-dim" aria-hidden>
        <span>★</span>
        <span>★★★★★</span>
      </div>
    </div>
  );
}
