import { recommendationReasonLabel, type RecommendationReason } from '@/lib/recommendations';

/**
 * Compact text-only reason line: no avatar stack, badge cloud, score or
 * percentage — just the one or two things that made this recommendation. Pair
 * with `RecommendationOptionsMenu` (as a `Poster` overlay) where feedback
 * controls are also wanted; the two are deliberately independent so a caller
 * can show a reason without a menu, or a menu without repeating a reason a
 * section heading already established.
 */
export function RecommendationContext({
  reasons,
}: {
  reasons: RecommendationReason[];
}) {
  if (!reasons.length) return null;
  return (
    <p className="mt-1.5 line-clamp-2 text-[0.6875rem] leading-relaxed text-ember">
      {reasons.slice(0, 2).map(recommendationReasonLabel).join(' · ')}
    </p>
  );
}
