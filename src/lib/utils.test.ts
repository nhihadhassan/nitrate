import { describe, expect, it } from 'vitest';

import {
  clubLocalInputValue,
  clubLocalToInstant,
  formatClubDateTime,
  formatCount,
  formatDateOnly,
  formatRuntime,
  formatStars,
  isValidRating,
  slugify,
  starGlyphs,
  toHalfStars,
  toStars,
} from './utils';

describe('ratings', () => {
  it('round-trips stars and half-stars without drift', () => {
    for (let half = 1; half <= 10; half += 1) {
      expect(toHalfStars(toStars(half))).toBe(half);
    }
  });

  it('accepts only whole half-stars in range', () => {
    expect(isValidRating(1)).toBe(true);
    expect(isValidRating(10)).toBe(true);
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(11)).toBe(false);
    expect(isValidRating(3.5)).toBe(false);
    expect(isValidRating('7')).toBe(false);
  });

  it('formats half-stars for display', () => {
    expect(formatStars(7)).toBe('3.5');
    expect(formatStars(10)).toBe('5.0');
    expect(formatStars(null)).toBe('—');
    expect(starGlyphs(7)).toBe('★★★½');
    expect(starGlyphs(10)).toBe('★★★★★');
  });
});

describe('slugify', () => {
  it('produces url-safe slugs', () => {
    expect(slugify('The Grand Budapest Hotel')).toBe('the-grand-budapest-hotel');
    expect(slugify("Everything Everywhere All at Once")).toBe('everything-everywhere-all-at-once');
  });

  it('strips diacritics and punctuation', () => {
    expect(slugify('Amélie')).toBe('amelie');
    expect(slugify('Amélie')).toBe('amelie');
    expect(slugify('WALL·E')).toBe('wall-e');
  });

  it('never returns an empty slug', () => {
    expect(slugify('!!!')).toBe('untitled');
    expect(slugify('')).toBe('untitled');
  });
});

describe('formatting', () => {
  it('formats runtimes', () => {
    expect(formatRuntime(95)).toBe('1h 35m');
    expect(formatRuntime(120)).toBe('2h');
    expect(formatRuntime(42)).toBe('42m');
    expect(formatRuntime(null)).toBeNull();
    expect(formatRuntime(0)).toBeNull();
  });

  it('abbreviates counts', () => {
    expect(formatCount(999)).toBe('999');
    expect(formatCount(1200)).toBe('1.2k');
    expect(formatCount(15_000)).toBe('15k');
    expect(formatCount(2_400_000)).toBe('2.4m');
  });

  it('formats date-only strings without timezone drift', () => {
    // A naive `new Date('2024-01-01')` renders as 31 Dec in negative offsets.
    expect(formatDateOnly('2024-01-01')).toBe('1 Jan 2024');
    expect(formatDateOnly('2024-12-31')).toBe('31 Dec 2024');
  });
});

describe('club time (America/Toronto)', () => {
  it('renders an instant as a Toronto wall-clock time, no offset suffix', () => {
    // 2026-09-11 20:00 EDT
    expect(formatClubDateTime(new Date('2026-09-12T00:00:00Z'))).toBe('Fri Sept 11, 8:00 PM');
    // 2026-01-15 19:30 EST — the offset shifts, the label does not mention it
    expect(formatClubDateTime(new Date('2026-01-16T00:30:00Z'))).toBe('Thu Jan 15, 7:30 PM');
  });

  it('returns an empty string for an invalid date rather than throwing', () => {
    expect(formatClubDateTime(new Date(NaN))).toBe('');
  });

  it('reads a typed wall-clock time as Toronto, across the DST boundary', () => {
    // Summer: 8 PM Toronto is 00:00 UTC the next day (-4)
    expect(clubLocalToInstant('2026-07-04T20:00').toISOString()).toBe('2026-07-05T00:00:00.000Z');
    // Winter: 8 PM Toronto is 01:00 UTC the next day (-5)
    expect(clubLocalToInstant('2026-02-04T20:00').toISOString()).toBe('2026-02-05T01:00:00.000Z');
  });

  it('round-trips an instant through the input value and back', () => {
    const instant = new Date('2026-09-12T00:00:00Z');
    expect(clubLocalInputValue(instant)).toBe('2026-09-11T20:00');
    expect(clubLocalToInstant(clubLocalInputValue(instant)).toISOString()).toBe(instant.toISOString());
  });
});
