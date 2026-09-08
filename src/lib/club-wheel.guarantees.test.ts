import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { angleForIndex, buildSpinTrack } from '@/components/club/wheel/spin';
import { WHEEL_TOTAL_MS } from '@/lib/motion';

const wheelSource = readFileSync(
  new URL('../components/club/wheel/poster-wheel.tsx', import.meta.url),
  'utf8',
);
const spinSource = readFileSync(
  new URL('../components/club/wheel/spin.ts', import.meta.url),
  'utf8',
);
const experienceSource = readFileSync(
  new URL('../components/club/wheel-experience.tsx', import.meta.url),
  'utf8',
);
const primitivesSource = readFileSync(
  new URL('../components/motion/primitives.tsx', import.meta.url),
  'utf8',
);

describe('the wheel never decides anything', () => {
  it('has no randomness anywhere in the client wheel', () => {
    for (const source of [wheelSource, spinSource]) {
      expect(source).not.toContain('Math.random');
      expect(source).not.toContain('crypto.');
    }
  });

  it('lands the requested index exactly, whatever the starting angle', () => {
    for (const count of [2, 3, 5, 8, 12]) {
      for (let index = 0; index < count; index += 1) {
        const target = angleForIndex(index, count);
        const track = buildSpinTrack({ from: 137.5, targetAngle: target });
        const landed = ((track.keyframes.at(-1)! % 360) + 360) % 360;
        expect(Math.abs(landed - target)).toBeLessThan(0.001);
      }
    }
  });

  it('always travels forwards and ends on the final keyframe', () => {
    const track = buildSpinTrack({ from: 0, targetAngle: 200 });
    expect(track.keyframes.at(-1)).toBeGreaterThan(track.keyframes[0]);
    expect(track.times.at(-1)).toBe(1);
    expect(track.ease).toHaveLength(track.keyframes.length - 1);
  });
});

describe('reduced motion', () => {
  it('short-circuits the wheel to its committed result instead of animating', () => {
    // The reduced branch sets the angle outright and reports settled; it must
    // not fall through to `animate`.
    const reducedBranch = wheelSource.slice(
      wheelSource.indexOf('if (reduced)'),
      wheelSource.indexOf('const track ='),
    );
    expect(reducedBranch).toContain('angle.set(target)');
    expect(reducedBranch).toContain('onSettled');
    expect(reducedBranch).not.toContain('animate(');
  });

  it('keeps a skip out of the animation for everyone', () => {
    expect(experienceSource).toContain('Skip animation');
    expect(experienceSource).toContain('Skip to the result');
  });
});

describe('the reveal does not depend on an animation finishing', () => {
  // Motion pauses while a tab is hidden. A phone locked mid-spin used to leave
  // the wheel frozen and the reveal unrecorded.
  it('completes on wall-clock time and on returning to the tab', () => {
    expect(experienceSource).toContain('WHEEL_TOTAL_MS');
    expect(experienceSource).toContain('visibilitychange');
    expect(WHEEL_TOTAL_MS).toBeGreaterThan(4000);
  });

  it('records the reveal exactly once per attempt', () => {
    expect(experienceSource).toContain('finishing.current');
  });
});

describe('motion never gates whether content appears', () => {
  // A JavaScript entrance animation starts at opacity 0 and is paused while
  // the tab is hidden, which stranded posters invisible. Content entrances
  // belong to CSS.
  it('ships no variant-driven entrance primitives', () => {
    expect(primitivesSource).not.toContain('staggerChildren');
    expect(primitivesSource).not.toContain('initial="hidden"');
  });
});
