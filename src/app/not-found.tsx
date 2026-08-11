import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/primitives';

export default function NotFound() {
  return (
    <Container size="narrow" className="py-24 text-center">
      <p className="font-display text-7xl text-ember/70">404</p>
      <h1 className="mt-4 text-3xl">This reel is missing</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
        The page you were after does not exist, was deleted, or is private.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Button asChild variant="primary">
          <Link href="/">Back to your feed</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/search">Search for a film</Link>
        </Button>
      </div>
    </Container>
  );
}
