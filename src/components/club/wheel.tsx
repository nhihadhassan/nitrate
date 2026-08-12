'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

/** Segment colours cycle through the brand accents so neighbours never match. */
const SEGMENT_COLORS = [
  'var(--ember)',
  'var(--iris)',
  'var(--jade)',
  'var(--amber)',
  'var(--rose)',
  'var(--ember-soft)',
];

export type WheelSegment = { nominationId: string; movieTitle: string };

/**
 * The wheel.
 *
 * It never decides anything — `winnerIndex` comes from the server, already
 * committed — it just animates to a predetermined stop. The rotation is chosen
 * so the winning segment finishes under the pointer at the top, after a few
 * full turns for suspense.
 */
export function Wheel({
  segments,
  winnerIndex,
  spinning,
  onSettled,
  size = 300,
}: {
  segments: WheelSegment[];
  winnerIndex: number | null;
  spinning: boolean;
  onSettled?: () => void;
  size?: number;
}) {
  const [rotation, setRotation] = useState(0);
  const [settled, setSettled] = useState(false);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const sliceAngle = segments.length ? 360 / segments.length : 360;

  useEffect(() => {
    if (winnerIndex === null || settled) return;

    // Land the middle of the winning slice under the pointer at 12 o'clock.
    const target = 360 - (winnerIndex * sliceAngle + sliceAngle / 2);
    const turns = reducedMotion.current ? 0 : 5;
    setRotation(turns * 360 + target);

    const duration = reducedMotion.current ? 0 : 4200;
    const timer = window.setTimeout(() => {
      setSettled(true);
      onSettled?.();
    }, duration);
    return () => window.clearTimeout(timer);
  }, [winnerIndex, sliceAngle, settled, onSettled]);

  const gradient = useMemo(() => {
    if (!segments.length) return 'var(--surface)';
    const stops = segments.map((_, index) => {
      const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length];
      return `${color} ${index * sliceAngle}deg ${(index + 1) * sliceAngle}deg`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }, [segments, sliceAngle]);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {/* Pointer */}
      <div
        aria-hidden
        className={cn(
          'wheel-pointer absolute left-1/2 top-[-10px] z-20 h-0 w-0 -translate-x-1/2',
          spinning && 'is-spinning',
        )}
        style={{
          borderLeft: '11px solid transparent',
          borderRight: '11px solid transparent',
          borderTop: '20px solid var(--text)',
          filter: 'drop-shadow(0 2px 4px rgb(0 0 0 / 0.5))',
        }}
      />

      <div
        className={cn(
          'movie-wheel relative h-full w-full rounded-full border-2 border-line-strong shadow-pop',
          spinning && 'is-spinning',
        )}
        style={{
          background: gradient,
          transform: `rotate(${rotation}deg)`,
          transition:
            winnerIndex !== null && !reducedMotion.current
              ? 'transform 4.2s cubic-bezier(0.16, 1, 0.3, 1)'
              : undefined,
        }}
        role="img"
        aria-label={
          settled && winnerIndex !== null
            ? `The wheel landed on ${segments[winnerIndex]?.movieTitle}`
            : `A wheel with ${segments.length} films`
        }
      >
        {segments.map((segment, index) => {
          // Labels sit at the polar centre of their slice but stay upright.
          // Rotating them radially would leave everything on the left half
          // upside down, which is exactly the half people squint at.
          const angle = index * sliceAngle + sliceAngle / 2;
          const radians = ((angle - 90) * Math.PI) / 180;
          const radius = size * 0.3;
          return (
            <span
              key={segment.nominationId}
              className="absolute text-center text-[0.6875rem] font-semibold leading-tight text-black/85"
              style={{
                left: `${50 + (Math.cos(radians) * radius * 100) / size}%`,
                top: `${50 + (Math.sin(radians) * radius * 100) / size}%`,
                transform: 'translate(-50%, -50%)',
                width: Math.min(size * 0.34, (size * Math.PI) / Math.max(segments.length, 3)),
                textShadow: '0 1px 2px rgb(255 255 255 / 0.4)',
              }}
            >
              <span className="line-clamp-2">{segment.movieTitle}</span>
            </span>
          );
        })}
      </div>

      {/* Hub */}
      <div
        aria-hidden
        className={cn(
          'wheel-hub absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-line-strong bg-canvas-raised text-xs font-semibold uppercase tracking-wide text-muted',
          spinning && 'animate-pulse',
        )}
      >
        {settled ? '🎬' : spinning ? '…' : 'Spin'}
      </div>
    </div>
  );
}
