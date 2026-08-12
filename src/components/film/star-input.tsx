'use client';

import { useId, useState } from 'react';

import { cn, ratingLabel } from '@/lib/utils';

/**
 * Half-star rating input.
 *
 * Pointer: each star is two hit zones. Keyboard and screen reader: a real
 * slider with arrow keys, because a row of ten buttons is miserable to tab
 * through and announces as ten identical stars. The drawn stars are therefore
 * entirely decorative — `aria-hidden` on the whole row — and the range input is
 * the only control assistive technology ever sees. Clicking the current value
 * clears it, the fastest way to undo a misclick.
 */
export function StarInput({
  value,
  onChange,
  size = 'md',
  disabled,
  className,
  label = 'Your rating',
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  const starSize = { sm: 'h-5 w-5', md: 'h-7 w-7', lg: 'h-9 w-9' }[size];

  function commit(next: number) {
    if (disabled) return;
    onChange(value === next ? null : next);
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex items-center" onPointerLeave={() => setHover(null)} aria-hidden>
        {[1, 2, 3, 4, 5].map((star) => {
          const half = star * 2 - 1;
          const full = star * 2;
          return (
            <span key={star} className={cn('relative', starSize)}>
              <StarGlyph
                className={cn(
                  'rating-star absolute inset-0',
                  shown >= full
                    ? 'text-ember'
                    : shown >= half
                      ? 'text-line-strong'
                      : 'text-line-strong',
                  shown === full && hover === full && 'is-previewed',
                  shown >= half && value === shown && hover === null && 'is-selected',
                )}
                fill={shown >= full ? 1 : shown >= half ? 0.5 : 0}
              />
              {!disabled && (
                <>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden
                    onPointerEnter={() => setHover(half)}
                    onClick={() => commit(half)}
                    className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden
                    onPointerEnter={() => setHover(full)}
                    onClick={() => commit(full)}
                    className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
                  />
                </>
              )}
            </span>
          );
        })}
      </div>

      {/* The accessible control. Visually collapsed but fully operable. */}
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value ?? 0}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={ratingLabel(value)}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(next === 0 ? null : next);
        }}
        className="h-7 w-px cursor-pointer opacity-0 focus-visible:w-24 focus-visible:opacity-100"
      />

      <span aria-hidden className="min-w-9 text-sm text-muted tabular">
        {value ? (value / 2).toFixed(1) : '—'}
      </span>
    </div>
  );
}

function StarGlyph({ className, fill }: { className?: string; fill: number }) {
  const id = `half-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {fill === 0.5 ? (
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor="var(--ember)" />
            <stop offset="50%" stopColor="currentColor" />
          </linearGradient>
        </defs>
      ) : null}
      <path
        d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z"
        fill={fill === 0.5 ? `url(#${id})` : fill === 1 ? 'currentColor' : 'currentColor'}
        opacity={fill === 0 ? 0.35 : 1}
      />
    </svg>
  );
}
