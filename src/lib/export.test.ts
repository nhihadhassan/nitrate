import { describe, expect, it } from 'vitest';

import { csvCell, csvRow, NITRATE_EXPORT_VERSION, toLetterboxdRating, type ExportManifestV1 } from './export';

describe('portable export contract', () => {
  it('escapes CSV cells without losing commas, quotes, or newlines', () => {
    expect(csvCell('one, "two"\nthree')).toBe('"one, ""two""\nthree"');
    expect(csvRow(['Heat', 1995, null])).toBe('Heat,1995,\r\n');
  });

  it('maps half-star integers safely to Letterboxd values', () => {
    expect(toLetterboxdRating(1)).toBe('0.5');
    expect(toLetterboxdRating(9)).toBe('4.5');
    expect(toLetterboxdRating(null)).toBe('');
  });

  it('keeps privacy exclusions and cursor batching explicit in the manifest', () => {
    const manifest: ExportManifestV1 = { schemaVersion: NITRATE_EXPORT_VERSION, product: 'Nitrate', generatedAt: new Date(0).toISOString(), userId: 'u1', username: 'alex', files: [], privacy: { otherPeoplePrivateDataIncluded: false, clubDiscussionsIncluded: false }, batching: { strategy: 'cursor', batchSize: 250 } };
    expect(manifest.schemaVersion).toBe('1.0');
    expect(manifest.privacy).toEqual({ otherPeoplePrivateDataIncluded: false, clubDiscussionsIncluded: false });
    expect(manifest.batching.strategy).toBe('cursor');
  });
});
