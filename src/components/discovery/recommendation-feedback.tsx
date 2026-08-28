'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import type { RecommendationReasonKind } from '@/lib/recommendations';
import { recommendationFeedbackAction } from '@/server/actions/discovery';

/**
 * Full, always-visible "Hide" / "Less like this" controls. For a poster-corner
 * menu instead (the common case), use `RecommendationOptionsMenu` — this
 * component is for surfaces with room for inline buttons, like the people
 * suggestion cards on `/explore/people`.
 */
export function RecommendationFeedback({
  targetType,
  targetId,
  reasonKind,
  includeAlreadyKnow = false,
}: {
  targetType: 'user' | 'movie' | 'person';
  targetId: string;
  reasonKind?: RecommendationReasonKind;
  includeAlreadyKnow?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const submit = (kind: 'hide' | 'already_know' | 'less_like_this') => {
    startTransition(async () => {
      const result = await recommendationFeedbackAction({ targetType, targetId, kind, reasonKind });
      if (!result.ok) return toast({ message: result.error, tone: 'error' });
      toast({
        message: kind === 'already_know' ? 'Marked as someone you already know' : kind === 'hide' ? 'Hidden for 90 days' : 'Adjusted for 30 days',
        tone: 'success',
      });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Recommendation controls">
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => submit('hide')}>
        Hide
      </Button>
      {includeAlreadyKnow ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => submit('already_know')}>
          Already know
        </Button>
      ) : (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => submit('less_like_this')}>
          Less like this
        </Button>
      )}
    </div>
  );
}
