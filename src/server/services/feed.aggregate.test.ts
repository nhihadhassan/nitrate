import { describe, expect, it } from 'vitest';

import { aggregateFeedItems, type FeedItem } from './feed';

const ACTOR = { id: 'u1', username: 'nina', displayName: 'Nina', avatarAssetId: null };
const OTHER_ACTOR = { id: 'u2', username: 'sam', displayName: 'Sam', avatarAssetId: null };

/** Minimal stand-in — aggregation only reads actor, movie, type and time. */
function movie(id: string) {
  return { id, slug: `film-${id}`, title: `Film ${id}` } as unknown as FeedItem['movie'];
}

function event(
  overrides: Partial<FeedItem> & { type: FeedItem['types'][number]; at: string },
): FeedItem {
  const createdAt = new Date(overrides.at);
  return {
    id: `${overrides.type}-${overrides.at}`,
    types: [overrides.type],
    createdAt,
    oldestAt: createdAt,
    actor: ACTOR,
    movie: movie('m1'),
    entry: null,
    list: null,
    club: null,
    metadata: {},
    ...overrides,
  };
}

describe('aggregateFeedItems', () => {
  it('folds one sitting into one card', () => {
    const result = aggregateFeedItems([
      event({ type: 'review_created', at: '2026-08-11T20:04:00Z' }),
      event({ type: 'film_liked', at: '2026-08-11T20:03:40Z' }),
      event({ type: 'film_rated', at: '2026-08-11T20:03:30Z' }),
      event({ type: 'film_logged', at: '2026-08-11T20:03:00Z' }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].types).toEqual([
      'review_created',
      'film_liked',
      'film_rated',
      'film_logged',
    ]);
    // The cursor for the next page is the oldest event in the group.
    expect(result[0].oldestAt.toISOString()).toBe('2026-08-11T20:03:00.000Z');
  });

  it('keeps genuinely separate moments separate', () => {
    const result = aggregateFeedItems([
      // Re-rating the same film a week later is a new opinion, not the same act.
      event({ type: 'film_rated', at: '2026-08-18T09:00:00Z' }),
      event({ type: 'film_logged', at: '2026-08-11T20:03:00Z' }),
    ]);
    expect(result).toHaveLength(2);
  });

  it('never merges across people or across films', () => {
    const sameSecond = '2026-08-11T20:03:00Z';
    const result = aggregateFeedItems([
      event({ type: 'film_logged', at: sameSecond }),
      event({ type: 'film_logged', at: sameSecond, actor: OTHER_ACTOR, id: 'other-actor' }),
      event({ type: 'film_logged', at: sameSecond, movie: movie('m2'), id: 'other-film' }),
    ]);
    expect(result).toHaveLength(3);
  });

  it('leaves club and list events alone', () => {
    const result = aggregateFeedItems([
      event({ type: 'club_screening_completed', at: '2026-08-11T20:03:10Z' }),
      event({ type: 'club_movie_selected', at: '2026-08-11T20:03:05Z' }),
      event({ type: 'film_logged', at: '2026-08-11T20:03:00Z' }),
    ]);
    expect(result).toHaveLength(3);
  });

  it('prefers the event carrying the written review as the card body', () => {
    const withReview = {
      id: 'e1',
      rating: 9,
      liked: true,
      reviewText: 'Joker carried, enough said.',
      containsSpoilers: false,
      watchedDate: '2026-08-11',
      isRewatch: false,
      likeCount: 0,
      commentCount: 0,
      likedByViewer: false,
    };
    const withoutReview = { ...withReview, reviewText: null };

    const result = aggregateFeedItems([
      event({ type: 'film_rated', at: '2026-08-11T20:03:30Z', entry: withoutReview }),
      event({ type: 'review_created', at: '2026-08-11T20:03:10Z', entry: withReview }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].entry?.reviewText).toBe('Joker carried, enough said.');
  });

  it('does not chain a long tail of events into one card', () => {
    // Each event is inside the window of the previous one, but the run spans a
    // day: the group is closed by distance from its own oldest member.
    const result = aggregateFeedItems([
      event({ type: 'film_liked', at: '2026-08-12T02:00:00Z' }),
      event({ type: 'film_rated', at: '2026-08-11T21:00:00Z' }),
      event({ type: 'film_logged', at: '2026-08-11T16:00:00Z' }),
    ]);
    expect(result).toHaveLength(2);
  });
});
