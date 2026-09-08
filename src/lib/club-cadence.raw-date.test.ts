import { describe, expect, it } from 'vitest';

import { cadenceLine, roundSelectionLabel, nextSelectionAt } from './club-cadence';

/**
 * Regression: a timestamp selected through a raw `sql<Date>` fragment arrives
 * from postgres.js as a *string*, because Drizzle runs statements through
 * `unsafe()` with `prepare: false` and the driver has no type information for
 * a hand-written subselect. Passing that string on to `Intl.DateTimeFormat`
 * threw `RangeError: Invalid time value` and took out the signed-in home page
 * for any club with a monthly cadence.
 *
 * The fix coerces at the query boundary (`rawDate` in services/clubs.ts).
 * These tests pin the behaviour the formatters rely on, so the shape of the
 * failure is documented even though the guard lives server-side.
 */
describe('cadence formatting against real Date input', () => {
  const roundStart = new Date('2026-09-08T05:47:00.000Z');

  it('names the month for a monthly club', () => {
    expect(roundSelectionLabel('monthly', roundStart, 'America/Toronto')).toBe('September movie');
  });

  it('builds the cadence line', () => {
    expect(cadenceLine('monthly', null, roundStart, 'America/Toronto')).toBe(
      'Monthly · September movie',
    );
  });

  it('advances a monthly cadence by one month', () => {
    expect(nextSelectionAt('monthly', roundStart).toISOString().slice(0, 7)).toBe('2026-10');
  });

  // The exact failure the raw fragment produced, kept as documentation: these
  // formatters take a Date and nothing else, so the coercion has to happen
  // before the value ever reaches them.
  it('throws on a string, which is why raw fragments must be coerced first', () => {
    expect(() =>
      roundSelectionLabel('monthly', '2026-09-08T05:47:00.000Z' as unknown as Date, 'America/Toronto'),
    ).toThrow(RangeError);
  });
});
