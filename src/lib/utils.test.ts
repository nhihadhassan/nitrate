import { describe, expect, it } from 'vitest';

import {
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
