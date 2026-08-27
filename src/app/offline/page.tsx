import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/primitives';

export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <Container size="narrow" className="flex min-h-[65vh] items-center py-12">
      <div>
        <p className="eyebrow text-ember">No connection</p>
        <h1 className="mt-2 text-4xl">Nitrate is waiting for the signal.</h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted">
          Your diary, clubs, and private notes are never stored in the offline page cache. Reconnect to see current personal data or make changes.
        </p>
        <Button asChild variant="primary" className="mt-6">
          <Link href="/">Try again</Link>
        </Button>
      </div>
    </Container>
  );
}
