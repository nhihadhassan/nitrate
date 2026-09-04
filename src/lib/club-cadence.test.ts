import { describe, expect, it } from 'vitest';

import {
  cadenceLabel,
  nextSelectionAt,
  nextSelectionCopy,
  roundMovieLabel,
  roundPeriodLabel,
  roundSelectionLabel,
} from './club-cadence';

const SEPTEMBER = new Date('2026-09-20T16:00:00.000Z');

describe('Movie Club cadence', () => {
  it('names a monthly round from its round start rather than its deadline', () => {
    expect(roundMovieLabel('monthly', SEPTEMBER, 'America/Toronto')).toBe('September’s movie');
    expect(roundSelectionLabel('monthly', SEPTEMBER, 'America/Toronto')).toBe('September movie');
    expect(roundPeriodLabel('monthly', SEPTEMBER, 'America/Toronto')).toBe('September 2026');
  });

  it('keeps weekly language only for weekly clubs', () => {
    expect(roundMovieLabel('weekly', SEPTEMBER, 'America/Toronto')).toBe('This week’s movie');
    expect(roundMovieLabel('biweekly', SEPTEMBER, 'America/Toronto')).toBe('This selection’s movie');
    expect(roundMovieLabel('custom', SEPTEMBER, 'America/Toronto')).toBe('This selection’s movie');
  });

  it('calculates each supported next-selection interval', () => {
    expect(nextSelectionAt('weekly', SEPTEMBER).toISOString()).toBe('2026-09-27T16:00:00.000Z');
    expect(nextSelectionAt('biweekly', SEPTEMBER).toISOString()).toBe('2026-10-04T16:00:00.000Z');
    expect(nextSelectionAt('monthly', SEPTEMBER).toISOString()).toBe('2026-10-20T16:00:00.000Z');
    expect(nextSelectionAt('custom', SEPTEMBER, 21).toISOString()).toBe('2026-10-11T16:00:00.000Z');
    expect(nextSelectionAt('monthly', new Date('2026-01-31T16:00:00.000Z')).toISOString()).toBe('2026-02-28T16:00:00.000Z');
  });

  it('turns a due date into useful dashboard context', () => {
    expect(nextSelectionCopy(new Date('2026-09-16T12:00:00Z'), new Date('2026-09-04T12:00:00Z'))).toBe('Next movie selection in 12 days');
    expect(nextSelectionCopy(new Date('2026-09-05T12:00:00Z'), new Date('2026-09-04T12:00:00Z'))).toBe('Next movie selection tomorrow');
    expect(nextSelectionCopy(new Date('2026-09-04T12:00:00Z'), new Date('2026-09-04T12:00:00Z'))).toBe('Ready for the next movie');
  });

  it('describes custom cadence with its actual interval', () => {
    expect(cadenceLabel('custom', 18)).toBe('Every 18 days');
  });
});
