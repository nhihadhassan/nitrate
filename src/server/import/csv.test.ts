import { describe, expect, it } from 'vitest';

import { parseCsv, pick } from './csv';
import { stageFiles } from './letterboxd';

describe('parseCsv', () => {
  it('handles quoted fields containing commas, quotes and newlines', () => {
    const csv = 'Name,Review\n"Heat","He said ""don\'t"", then left.\nSecond line."\n';
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe('Heat');
    expect(rows[1][1]).toBe('He said "don\'t", then left.\nSecond line.');
  });

  it('strips a UTF-8 BOM', () => {
    const rows = parseCsv('﻿Date,Name\n2024-01-01,Heat\n');
    expect(rows[0][0]).toBe('Date');
  });

  it('handles CRLF line endings', () => {
    const rows = parseCsv('Name,Year\r\nHeat,1995\r\n');
    expect(rows[1]).toEqual(['Heat', '1995']);
  });
});

describe('pick', () => {
  it('falls back across header spellings, case-insensitively', () => {
    const row = { Name: 'Heat', 'letterboxd uri': 'https://example.test' };
    expect(pick(row, 'Title', 'Name')).toBe('Heat');
    expect(pick(row, 'Letterboxd URI')).toBe('https://example.test');
    expect(pick(row, 'Missing')).toBeNull();
  });
});

describe('stageFiles', () => {
  it('reads a diary export into dated viewings', () => {
    const staged = stageFiles([
      {
        name: 'diary.csv',
        text: [
          'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date',
          '2024-03-02,Heat,1995,https://boxd.it/x,4.5,Yes,"cinema, 35mm",2024-03-01',
        ].join('\n'),
      },
    ]);

    expect(staged).toHaveLength(1);
    expect(staged[0].kind).toBe('diary');
    expect(staged[0].rawTitle).toBe('Heat');
    expect(staged[0].rawYear).toBe(1995);
    expect(staged[0].payload).toMatchObject({
      watchedDate: '2024-03-01',
      rating: 9, // 4.5 stars -> 9 half-stars
      rewatch: true,
      tags: ['cinema', '35mm'],
    });
  });

  it('treats a watchlist export as watchlist rows', () => {
    const staged = stageFiles([
      { name: 'watchlist.csv', text: 'Date,Name,Year\n2024-01-01,Stalker,1979\n' },
    ]);
    expect(staged[0].kind).toBe('watchlist');
  });

  it('reads ratings-only exports as ratings', () => {
    const staged = stageFiles([
      { name: 'ratings.csv', text: 'Date,Name,Year,Rating\n2024-01-01,Stalker,1979,5\n' },
    ]);
    expect(staged[0].kind).toBe('rating');
    expect(staged[0].payload).toMatchObject({ rating: 10 });
  });

  it('collapses the same viewing appearing in diary and reviews', () => {
    const staged = stageFiles([
      {
        name: 'diary.csv',
        text: 'Name,Year,Watched Date,Rating\nHeat,1995,2024-03-01,4\n',
      },
      {
        name: 'reviews.csv',
        text: 'Name,Year,Watched Date,Rating,Review\nHeat,1995,2024-03-01,4,"Still holds up."\n',
      },
    ]);

    expect(staged).toHaveLength(1);
    // The richer record (the one carrying the review) wins.
    expect(staged[0].kind).toBe('review');
    expect(staged[0].payload).toMatchObject({ review: 'Still holds up.' });
  });

  it('produces stable dedupe keys so re-importing is a no-op', () => {
    const file = {
      name: 'diary.csv',
      text: 'Name,Year,Watched Date,Rating\nHeat,1995,2024-03-01,4\n',
    };
    const first = stageFiles([file]);
    const second = stageFiles([file]);
    expect(first[0].dedupeKey).toBe(second[0].dedupeKey);
  });

  it('keeps rows with no year rather than dropping them', () => {
    const staged = stageFiles([{ name: 'watched.csv', text: 'Name\nSome Obscure Short\n' }]);
    expect(staged).toHaveLength(1);
    expect(staged[0].rawYear).toBeNull();
  });
});
