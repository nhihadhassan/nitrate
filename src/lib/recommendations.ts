/**
 * A closed vocabulary for every recommendation shown by Nitrate. Keeping the
 * explanation structured prevents individual surfaces from inventing opaque
 * scores or pseudo-scientific compatibility percentages.
 */
export type RecommendationReason =
  | { kind: 'friend_loved'; names: string[] }
  | { kind: 'friend_watched'; count: number }
  | { kind: 'club_interest'; count: number }
  | { kind: 'shared_ratings'; count: number }
  | { kind: 'shared_favourite'; titles: string[] }
  | { kind: 'social_proximity'; count: number }
  | { kind: 'favourite_genre'; genre: string }
  | { kind: 'similar_to_film'; title: string }
  | { kind: 'on_watchlist' }
  | { kind: 'filmmaker_follow'; name: string }
  | { kind: 'community_signal'; label: string };

export type RecommendationReasonKind = RecommendationReason['kind'];

export const MIN_SHARED_RATINGS_FOR_TASTE = 10;

export function canClaimTasteSimilarity(sharedRatings: number): boolean {
  return sharedRatings >= MIN_SHARED_RATINGS_FOR_TASTE;
}

export function recommendationReasonLabel(reason: RecommendationReason): string {
  switch (reason.kind) {
    case 'friend_loved':
      return reason.names.length === 1
        ? `${reason.names[0]} loved it`
        : `${reason.names.length} friends loved it`;
    case 'friend_watched':
      return reason.count === 1 ? '1 friend watched' : `${reason.count} friends watched`;
    case 'club_interest':
      return reason.count === 1 ? 'In 1 of your Movie Ideas queues' : `In ${reason.count} of your Movie Ideas queues`;
    case 'shared_ratings':
      return `Taste signal from ${reason.count} shared ratings`;
    case 'shared_favourite':
      return reason.titles.length === 1
        ? `You both favourited ${reason.titles[0]}`
        : `${reason.titles.length} shared favourites`;
    case 'social_proximity':
      return reason.count === 1 ? 'Followed by 1 person you know' : `Followed by ${reason.count} people you know`;
    case 'favourite_genre':
      return `From your favourite genre: ${reason.genre}`;
    case 'similar_to_film':
      return `Because you loved ${reason.title}`;
    case 'on_watchlist':
      return 'Saved to your watchlist';
    case 'filmmaker_follow':
      return `New work from ${reason.name}`;
    case 'community_signal':
      return reason.label;
  }
}

export type RecommendationFeedbackKind = 'hide' | 'already_know' | 'less_like_this';

export const RECOMMENDATION_FEEDBACK_DAYS: Record<RecommendationFeedbackKind, number | null> = {
  hide: 90,
  already_know: null,
  less_like_this: 30,
};

export function feedbackExpiry(kind: RecommendationFeedbackKind, now = new Date()): Date | null {
  const days = RECOMMENDATION_FEEDBACK_DAYS[kind];
  if (days === null) return null;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export type PeopleSignalInput = {
  sharedRatings: number;
  sharedFavourites: string[];
  sharedClubs: number;
  mutualFollows: number;
};

export function peopleRecommendationReasons(input: PeopleSignalInput): RecommendationReason[] {
  const reasons: RecommendationReason[] = [];
  if (canClaimTasteSimilarity(input.sharedRatings)) {
    reasons.push({ kind: 'shared_ratings', count: input.sharedRatings });
  }
  if (input.sharedFavourites.length) {
    reasons.push({ kind: 'shared_favourite', titles: input.sharedFavourites.slice(0, 2) });
  }
  if (input.sharedClubs) reasons.push({ kind: 'club_interest', count: input.sharedClubs });
  if (input.mutualFollows) reasons.push({ kind: 'social_proximity', count: input.mutualFollows });
  return reasons;
}

/** Stable, bounded weight used only to order candidates; never shown as compatibility. */
export function peopleRecommendationScore(input: PeopleSignalInput): number {
  return Math.min(input.sharedRatings, 30) * 2
    + Math.min(input.sharedFavourites.length, 4) * 8
    + Math.min(input.sharedClubs, 3) * 7
    + Math.min(input.mutualFollows, 5) * 4;
}
