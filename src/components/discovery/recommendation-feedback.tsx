'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import type { RecommendationReasonKind } from '@/lib/recommendations';
import { recommendationFeedbackAction } from '@/server/actions/discovery';

export function RecommendationFeedback({
  targetType,
  targetId,
  reasonKind,
  includeAlreadyKnow = false,
  compact = false,
}: {
  targetType: 'user' | 'movie' | 'person';
  targetId: string;
  reasonKind?: RecommendationReasonKind;
  includeAlreadyKnow?: boolean;
  compact?: boolean;
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

  const controls = (
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
  if (!compact) return controls;
  return (
    <details className="relative mt-1 text-[0.6875rem] text-dim">
      <summary className="min-h-6 cursor-pointer list-none py-1 hover:text-text">Tune suggestion</summary>
      <div className="absolute bottom-7 left-0 z-20 w-36 rounded-md border border-line bg-canvas-raised p-1.5 shadow-pop">
        {controls}
      </div>
    </details>
  );
}
