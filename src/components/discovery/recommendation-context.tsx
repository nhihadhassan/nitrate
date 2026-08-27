import { RecommendationFeedback } from '@/components/discovery/recommendation-feedback';
import { recommendationReasonLabel, type RecommendationReason } from '@/lib/recommendations';

/** Compact text-only context: no avatar stack, badge cloud, score or percentage. */
export function RecommendationContext({
  movieId,
  reasons,
  controls = false,
}: {
  movieId: string;
  reasons: RecommendationReason[];
  controls?: boolean;
}) {
  if (!reasons.length) return null;
  return (
    <div className="mt-1.5">
      <p className="line-clamp-2 text-[0.6875rem] leading-relaxed text-ember">
        {reasons.slice(0, 2).map(recommendationReasonLabel).join(' · ')}
      </p>
      {controls ? (
        <RecommendationFeedback targetType="movie" targetId={movieId} reasonKind={reasons[0].kind} compact />
      ) : null}
    </div>
  );
}
