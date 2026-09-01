import { describe, expect, it } from 'vitest';

import { organisePersonalDiscovery, type DiscoverySource } from './explore-rails';

type Film = { id: string; slug: string };

const film = (id: string): Film => ({ id, slug: `film-${id}` });
const source = (
  id: string,
  count: number,
  priority: number,
  kind: 'social' | 'personal' = 'social',
): DiscoverySource<Film> => ({
  id,
  title: id,
  films: Array.from({ length: count }, (_, index) => film(`${id}-${index}`)),
  priority,
  kind,
});

describe('Explore rail density', () => {
  it('omits empty sources', () => {
    expect(organisePersonalDiscovery([source('empty', 0, 10)])).toEqual([]);
  });

  it('combines one and two-film sources instead of making weak rails', () => {
    const rows = organisePersonalDiscovery([source('clubs', 1, 80), source('friends', 2, 90)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'combined-personal-discovery',
      title: 'From your circle',
      compact: true,
      mergedFrom: ['friends', 'clubs'],
    });
    expect(rows[0].films).toHaveLength(3);
  });

  it('turns combined sparse signals into a full rail once they have density', () => {
    const rows = organisePersonalDiscovery([source('clubs', 2, 80), source('friends', 3, 90)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].compact).toBe(false);
    expect(rows[0].films).toHaveLength(5);
  });

  it('keeps a healthy rail intact and orders it by relevance', () => {
    const rows = organisePersonalDiscovery([
      source('watching', 8, 100),
      source('watchlist', 6, 40, 'personal'),
    ]);
    expect(rows.map((row) => row.id)).toEqual(['watching', 'watchlist']);
    expect(rows.every((row) => !row.compact)).toBe(true);
  });

  it('deduplicates films when sparse sources overlap', () => {
    const first = source('friends', 2, 90);
    const second = source('clubs', 2, 80);
    second.films[0] = first.films[0];
    const [row] = organisePersonalDiscovery([first, second]);
    expect(row.films).toHaveLength(3);
  });
});
