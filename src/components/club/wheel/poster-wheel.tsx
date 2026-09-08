'use client';

import { animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';

import { angleForIndex, buildSpinTrack } from '@/components/club/wheel/spin';
import { DURATION, EASE } from '@/lib/motion';
import { posterUrl } from '@/lib/images';

import type { WheelItem, WheelPresentationProps } from './types';

/**
 * The wheel.
 *
 * Each pick owns a wedge, and the wedge *is* the artwork — the poster is
 * clipped to the slice rather than sitting inside it as a thumbnail, so the
 * whole face is film. A bronze rim with steady lights and a weighted hub keep
 * it reading as a projector part rather than a prize wheel: no flashing, no
 * chase lights, nothing blinking.
 *
 * It decides nothing. `winnerIndex` arrives already committed by the server;
 * this component only converts that index into an angle.
 */
export function PosterWheel({
  items,
  winnerIndex,
  spinning,
  onSettled,
  height = 340,
  hubLabel,
}: WheelPresentationProps & { hubLabel?: string }) {
  const reduced = useReducedMotion();
  const angle = useMotionValue(0);
  const blur = useMotionValue(0);
  const started = useRef(false);
  const [turning, setTurning] = useState(false);
  const uid = useId().replace(/:/g, '');

  const count = Math.max(items.length, 1);
  const slice = 360 / count;

  useEffect(() => {
    if (winnerIndex === null || started.current) return;
    started.current = true;

    const target = angleForIndex(winnerIndex, count);

    if (reduced) {
      angle.set(target);
      onSettled?.();
      return;
    }

    const track = buildSpinTrack({ from: angle.get(), targetAngle: target });
    setTurning(true);
    const spin = animate(angle, track.keyframes, {
      duration: track.duration,
      times: track.times,
      ease: track.ease as never,
      onComplete: () => {
        setTurning(false);
        onSettled?.();
      },
    });
    // Blur only while the artwork is genuinely too fast to read, and gone well
    // before the result matters.
    const haze = animate(blur, [0, 0, 4.5, 4.5, 0.5, 0, 0], {
      duration: track.duration,
      times: [0, track.times[1], track.times[2], track.times[3], track.times[4], track.times[5], 1],
      ease: 'linear',
    });

    return () => {
      spin.stop();
      haze.stop();
    };
  }, [winnerIndex, count, reduced, angle, blur, onSettled]);

  const filter = useMotionTemplate`blur(${blur}px)`;

  // Viewport is a 200×200 box centred on the hub, so every measurement below
  // is a fraction of the radius and the whole thing scales with `height`.
  const R = 92;
  const rimOuter = 99;
  const hubRadius = 25;
  const bulbCount = Math.min(28, Math.max(16, count * 4));

  return (
    <div className="relative mx-auto" style={{ height, width: height }}>
      <motion.svg
        viewBox="-100 -100 200 200"
        className="absolute inset-0 h-full w-full"
        // Motion's own `rotate` shorthand, not a transform string: on an SVG
        // element a CSS transform template is silently dropped.
        style={{ rotate: angle, filter, transformOrigin: 'center', transformBox: 'view-box' }}
        role="img"
        aria-label={
          winnerIndex !== null && !spinning
            ? `The wheel landed on ${items[winnerIndex]?.movie.title ?? 'the club pick'}`
            : `${items.length} picks on the wheel`
        }
      >
        <defs>
          {items.map((item, index) => (
            <clipPath key={item.nominationId} id={`${uid}-slice-${index}`}>
              <path d={wedgePath(index * slice, (index + 1) * slice, R)} />
            </clipPath>
          ))}
          <radialGradient id={`${uid}-center-shade`}>
            <stop offset="0%" stopColor="rgb(0 0 0)" stopOpacity="0.85" />
            <stop offset="45%" stopColor="rgb(0 0 0)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(0 0 0)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}-rim`} x1="0" y1="-1" x2="0" y2="1">
            <stop offset="0%" stopColor="#7b5a3a" />
            <stop offset="38%" stopColor="#2a1f18" />
            <stop offset="72%" stopColor="#5c4229" />
            <stop offset="100%" stopColor="#1a1410" />
          </linearGradient>
        </defs>

        {items.map((item, index) => (
          <Wedge
            key={item.nominationId}
            item={item}
            index={index}
            slice={slice}
            count={count}
            radius={R}
            clipId={`${uid}-slice-${index}`}
          />
        ))}

        {/* Pulls the middle down so the hub sits on something, not on artwork. */}
        <circle cx="0" cy="0" r={R} fill={`url(#${uid}-center-shade)`} />

        {/* Hairlines between picks. */}
        {items.map((item, index) => {
          const point = polar(index * slice, R);
          return (
            <line
              key={`divider-${item.nominationId}`}
              x1="0"
              y1="0"
              x2={point.x}
              y2={point.y}
              stroke="rgb(255 210 160 / 0.22)"
              strokeWidth="0.6"
            />
          );
        })}

        {/* Rim. */}
        <circle
          cx="0"
          cy="0"
          r={(R + rimOuter) / 2}
          fill="none"
          stroke={`url(#${uid}-rim)`}
          strokeWidth={rimOuter - R}
        />
        <circle cx="0" cy="0" r={R} fill="none" stroke="rgb(0 0 0 / 0.6)" strokeWidth="0.8" />
        <circle cx="0" cy="0" r={rimOuter} fill="none" stroke="rgb(255 210 160 / 0.16)" strokeWidth="0.6" />

        {/* Steady rim lights. They never blink or chase. */}
        {Array.from({ length: bulbCount }, (_, index) => {
          const point = polar((360 / bulbCount) * index, (R + rimOuter) / 2);
          return (
            <circle
              key={`bulb-${index}`}
              cx={point.x}
              cy={point.y}
              r="0.9"
              fill="var(--amber)"
              opacity="0.75"
            />
          );
        })}
      </motion.svg>

      {/* Titles belong to a wheel at rest. They orbit with their wedge and
          counter-rotate to stay upright, but they are gone for the whole spin:
          text whipping around the rim reads as noise, and a real wheel only
          shows you artwork going past. They fade back in as it settles. */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ rotate: angle }}
        animate={{ opacity: turning ? 0 : 1 }}
        transition={{ duration: turning ? 0.12 : DURATION.slow, ease: EASE.out }}
      >
        {items.map((item, index) => (
          <WedgeLabel
            key={item.nominationId}
            title={item.movie.title}
            bisector={index * slice + slice / 2}
            wheelAngle={angle}
            count={count}
          />
        ))}
      </motion.div>

      {/* Hub and pointer do not turn. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber/25 bg-canvas text-center"
        style={{
          height: `${hubRadius}%`,
          width: `${hubRadius}%`,
          boxShadow: '0 6px 18px -6px rgb(0 0 0 / 0.9), inset 0 1px 0 rgb(255 210 160 / 0.12)',
        }}
      >
        {hubLabel ? (
          <span className="px-2 font-display text-[0.6rem] leading-tight text-muted line-clamp-2">
            {hubLabel}
          </span>
        ) : null}
      </div>

      <span
        aria-hidden
        className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2"
        style={{
          borderLeft: '10px solid transparent',
          borderRight: '10px solid transparent',
          borderTop: '18px solid var(--ember)',
          filter: 'drop-shadow(0 3px 8px rgb(255 91 46 / 0.55))',
        }}
      />
    </div>
  );
}

/**
 * Trigonometry produces numbers whose last digit can differ between Node and
 * the browser. React 19 treats that as a hydration mismatch and declines to
 * patch the subtree — which leaves the wheel rendered but inert — so every
 * generated coordinate is rounded to a precision both sides agree on.
 */
function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

/** A point on the wheel, with 0° at twelve o'clock and angles going clockwise. */
function polar(degrees: number, radius: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return { x: round(radius * Math.cos(radians)), y: round(radius * Math.sin(radians)) };
}

function wedgePath(from: number, to: number, radius: number) {
  const start = polar(from, radius);
  const end = polar(to, radius);
  const largeArc = to - from > 180 ? 1 : 0;
  // A single-pick round is a full circle, which an arc command cannot express.
  if (to - from >= 360) {
    return `M ${-radius} 0 A ${radius} ${radius} 0 1 0 ${radius} 0 A ${radius} ${radius} 0 1 0 ${-radius} 0 Z`;
  }
  return `M 0 0 L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function Wedge({
  item,
  index,
  slice,
  count,
  radius,
  clipId,
}: {
  item: WheelItem;
  index: number;
  slice: number;
  count: number;
  radius: number;
  clipId: string;
}) {
  const href = posterUrl(item.movie.posterPath, 'md');
  const bisector = index * slice + slice / 2;
  const centre = polar(bisector, radius * 0.58);
  // Cover the wedge: wide enough for its chord, tall enough for a 2:3 poster.
  // The poster stays upright inside its wedge — the wheel turns, the artwork
  // does not tumble — so the box has to be wide enough to cover the wedge from
  // whichever side it sits on.
  const width = round(Math.max(radius * 1.2, 2 * radius * Math.sin(Math.PI / count) * 1.4));
  const boxHeight = round(width * 1.5);

  return (
    <g clipPath={`url(#${clipId})`}>
      <path d={wedgePath(index * slice, (index + 1) * slice, radius)} fill="var(--surface)" />
      {href ? (
        <image
          href={href}
          x={round(centre.x - width / 2)}
          y={round(centre.y - boxHeight / 2)}
          width={width}
          height={boxHeight}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : null}
    </g>
  );
}

function WedgeLabel({
  title,
  bisector,
  wheelAngle,
  count,
}: {
  title: string;
  bisector: number;
  wheelAngle: ReturnType<typeof useMotionValue<number>>;
  count: number;
}) {
  const upright = useTransform(wheelAngle, (value) => `translate(-50%, -50%) rotate(${-value}deg)`);
  const point = polar(bisector, 68);

  return (
    <motion.span
      className="absolute block text-center font-display uppercase leading-tight text-white"
      style={{
        left: `${round(50 + point.x / 2)}%`,
        top: `${round(50 + point.y / 2)}%`,
        width: count > 6 ? '22%' : '30%',
        transform: upright,
        fontSize: count > 8 ? '0.5rem' : '0.6rem',
        letterSpacing: '0.06em',
        textShadow: '0 1px 6px rgb(0 0 0 / 0.95), 0 0 2px rgb(0 0 0 / 0.9)',
      }}
    >
      <span className="line-clamp-2">{title}</span>
    </motion.span>
  );
}
