'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Container, EmptyState } from '@/components/ui/primitives';

export default function FilmsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[nitrate] films route failed', error);
  }, [error]);

  return (
    <Container size="wide" className="py-8 pb-20">
      <EmptyState
        title="Films did not load"
        description="The catalogue request failed. Your filters are still here, so you can safely try again."
        action={
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
        }
      />
    </Container>
  );
}
