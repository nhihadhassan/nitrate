import { describe, expect, it } from 'vitest';

import { appendUniqueExploreFilms, EXPLORE_MAX_EXCLUDED_IDS, normalizeExploreIds } from './explore';

describe('Explore continuation', () => {
  it('appends only unseen canonical films in source order', () => {
    expect(appendUniqueExploreFilms([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }, { id: 'c' }]))
      .toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  });

  it('deduplicates and bounds the session exclusion list', () => {
    const ids = Array.from({ length: EXPLORE_MAX_EXCLUDED_IDS + 20 }, (_, index) => String(index));
    const result = normalizeExploreIds([...ids, ids.at(-1)!]);
    expect(result).toHaveLength(EXPLORE_MAX_EXCLUDED_IDS);
    expect(result.at(-1)).toBe(ids.at(-1));
  });
});
