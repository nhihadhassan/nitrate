import { requireUser } from '@/server/auth/session';
import { getTasteComparison } from '@/server/services/stats';
import { storyCard } from '@/server/story-card';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ otherUserId: string }> }) {
  const user = await requireUser();
  const comparison = await getTasteComparison(user.id, (await params).otherUserId);
  return storyCard({
    eyebrow: 'Taste, compared honestly',
    title: `${comparison.left.displayName} & ${comparison.right.displayName}`,
    subtitle: comparison.confidenceLabel,
    metrics: [
      { label: 'shared ratings', value: String(comparison.sharedRatingCount) },
      { label: 'agreements', value: String(comparison.agreements.length) },
      { label: 'disagreements', value: String(comparison.disagreements.length) },
    ],
    posters: [...comparison.sharedFavourites, ...comparison.agreements, ...comparison.disagreements],
  });
}
