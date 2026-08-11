'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/primitives';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[nitrate] unhandled render error', error);
  }, [error]);

  return (
    <Container size="narrow" className="py-24 text-center">
      <p className="eyebrow">Something broke</p>
      <h1 className="mt-3 text-3xl">That did not work</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
        We hit an unexpected error. Trying again often fixes it — if it does not, the film database
        may be having a moment.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-dim">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-8 flex justify-center">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      </div>
    </Container>
  );
}
