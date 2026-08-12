/**
 * How an aggregated activity card reads.
 *
 * Client-safe on purpose: the feed card and the server both need to agree on
 * what a group of events *is*, and duplicating that logic is how the two drift.
 */

export type FeedEventType =
  | 'film_logged'
  | 'film_watched'
  | 'film_rated'
  | 'film_liked'
  | 'review_created'
  | 'list_created'
  | 'list_updated'
  | 'user_followed'
  | 'club_created'
  | 'club_movie_selected'
  | 'club_screening_scheduled'
  | 'club_screening_completed';

/**
 * The single verb for everything folded into one card. Precedence is by how
 * much the action tells you: watching beats reviewing beats rating beats
 * liking, because "watched" is the fact the other three decorate.
 */
export function feedVerb(types: readonly string[], options: { isRewatch?: boolean } = {}): string {
  const set = new Set(types);
  if (set.has('club_movie_selected')) return 'picked the next club film';
  if (set.has('club_screening_completed')) return 'watched with';
  if (set.has('list_created')) return 'made a list';
  if (set.has('film_logged') || set.has('film_watched')) {
    return options.isRewatch ? 'rewatched' : 'watched';
  }
  if (set.has('review_created')) return 'reviewed';
  if (set.has('film_rated')) return 'rated';
  if (set.has('film_liked')) return 'liked';
  return 'watched';
}
