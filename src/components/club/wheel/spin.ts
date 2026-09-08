import { WHEEL } from '@/lib/motion';

/**
 * The spin, as a keyframe track.
 *
 * Both wheel geometries animate a single angle in degrees, so the sequence —
 * wind-up, acceleration, cruise, the long slow-down, the suspense crawl and
 * the final settle — is described once, here, and neither presentation can
 * drift from the other.
 *
 * It takes the destination as an input. The angle it lands on is derived from
 * a winner the server already committed; nothing in this file decides
 * anything, and nothing here may be used to *choose* a slot.
 */

export type SpinTrack = {
  /** Absolute angles in degrees, ending exactly on `targetAngle + turns*360`. */
  keyframes: number[];
  /** Normalised 0–1 progress points for each keyframe. */
  times: number[];
  /** Per-segment easing, one shorter than `keyframes`. */
  ease: (string | number[])[];
  /** Total duration in seconds. */
  duration: number;
};

/** Fraction of the total travel completed by the end of each phase. */
const PROGRESS = {
  windUp: -0.004,
  accelerate: 0.1,
  cruise: 0.56,
  decelerate: 0.952,
  suspense: 0.994,
  /** Overshoots by a hair so the settle has something to fall back from. */
  overshoot: 1.004,
} as const;

export function buildSpinTrack({
  from = 0,
  targetAngle,
  turns = 6,
}: {
  /** Where the wheel currently sits, so a replay does not jump. */
  from?: number;
  /** The angle, within one rotation, that puts the winner under the pointer. */
  targetAngle: number;
  turns?: number;
}): SpinTrack {
  // Always travel forwards: normalise the target ahead of the current angle,
  // then add whole turns for the distance the eye needs to lose track.
  const normalised = ((targetAngle - from) % 360 + 360) % 360;
  const travel = normalised + turns * 360;
  const at = (fraction: number) => from + travel * fraction;

  const phases = [
    WHEEL.windUp,
    WHEEL.accelerate,
    WHEEL.cruise,
    WHEEL.decelerate,
    WHEEL.suspense,
    WHEEL.settle * 0.45,
    WHEEL.settle * 0.55,
  ];
  const duration = phases.reduce((total, phase) => total + phase, 0);

  const times: number[] = [0];
  let elapsed = 0;
  phases.forEach((phase) => {
    elapsed += phase;
    times.push(Number((elapsed / duration).toFixed(4)));
  });

  return {
    keyframes: [
      from,
      at(PROGRESS.windUp),
      at(PROGRESS.accelerate),
      at(PROGRESS.cruise),
      at(PROGRESS.decelerate),
      at(PROGRESS.suspense),
      at(PROGRESS.overshoot),
      at(1),
    ],
    times,
    ease: [
      'easeOut', // pull back
      'easeIn', // commit and accelerate
      'linear', // cruise
      'easeOut', // the long slow-down
      'linear', // suspense crawl
      'easeOut', // drift a hair past
      'easeInOut', // settle back into the slot
    ],
    duration,
  };
}

/**
 * The angle that brings `index` under the pointer, for a wheel whose slots are
 * laid out anticlockwise from the pointer position.
 */
export function angleForIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  const slice = 360 / count;
  return ((360 - (index * slice + slice / 2)) % 360 + 360) % 360;
}
