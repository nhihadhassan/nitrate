import { describe, expect, it } from 'vitest';

import { CURATED_THEMES, suggestThemesForClub, themeMatchScore } from './movie-themes';

describe('suggestThemesForClub', () => {
  it('ranks the seasonal theme first in its month, labelled for the month', () => {
    const ranked = suggestThemesForClub({ month: 10 });
    expect(ranked[0].theme.id).toBe('spooky-season');
    expect(ranked[0].label).toBe('perfect-for-month');
  });

  it('does not boost a seasonal theme outside its month', () => {
    const ranked = suggestThemesForClub({ month: 3 });
    const spooky = ranked.find((entry) => entry.theme.id === 'spooky-season')!;
    expect(spooky.label).not.toBe('perfect-for-month');
  });

  it('boosts a genre theme the club already likes, in a non-seasonal month', () => {
    const ranked = suggestThemesForClub({ month: 3, topGenreNames: ['Comedy'] });
    expect(ranked[0].theme.id).toBe('comedy-night');
    expect(ranked[0].label).toBe('based-on-club');
  });

  it('applies a recent-theme penalty without excluding the theme entirely', () => {
    const withoutPenalty = suggestThemesForClub({ month: 10 });
    const withPenalty = suggestThemesForClub({ month: 10, recentThemeIds: ['spooky-season'] });
    const before = withoutPenalty.find((entry) => entry.theme.id === 'spooky-season')!;
    const after = withPenalty.find((entry) => entry.theme.id === 'spooky-season')!;
    expect(after.score).toBeLessThan(before.score);
    expect(after.theme.id).toBe('spooky-season'); // still present, just lower
  });

  it('ranks every curated theme exactly once', () => {
    const ranked = suggestThemesForClub({ month: 1 });
    expect(ranked).toHaveLength(CURATED_THEMES.length);
    expect(new Set(ranked.map((entry) => entry.theme.id)).size).toBe(CURATED_THEMES.length);
  });
});

describe('themeMatchScore', () => {
  const spookySeason = CURATED_THEMES.find((theme) => theme.id === 'spooky-season')!;
  const nineties = CURATED_THEMES.find((theme) => theme.id === '90s-classics')!;

  it('scores higher for more overlapping genres', () => {
    const oneMatch = themeMatchScore(spookySeason, { genreIds: [27] });
    const twoMatch = themeMatchScore(spookySeason, { genreIds: [27, 53] });
    expect(twoMatch).toBeGreaterThan(oneMatch);
  });

  it('scores zero for a movie with no matching genre', () => {
    expect(themeMatchScore(spookySeason, { genreIds: [35] })).toBe(0);
  });

  it('rewards a year inside a decade theme range, not outside it', () => {
    expect(themeMatchScore(nineties, { year: 1995 })).toBeGreaterThan(0);
    expect(themeMatchScore(nineties, { year: 2010 })).toBe(0);
  });
});
