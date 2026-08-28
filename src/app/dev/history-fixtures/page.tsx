import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SnapshotStory } from '@/components/share/snapshot-story';
import { Container } from '@/components/ui/primitives';
import { syntheticHistorySnapshot } from '@/test-fixtures/history';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Synthetic history fixtures', robots: { index: false, follow: false } };

const STATES = ['recap-normal', 'recap-sparse', 'recap-imported', 'recap-high-volume', 'yearbook', 'taste-limited', 'taste-established', 'private', 'blocked', 'failure'];

export default async function HistoryFixturePage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.ALLOW_SYNTHETIC_FIXTURES !== 'true') notFound();
  const state = (await searchParams).state ?? 'recap-normal';
  const snapshot = syntheticHistorySnapshot(state);
  return (
    <Container size="wide" className="py-8">
      <nav aria-label="Synthetic history states" className="mobile-tabs mb-8 flex gap-2 overflow-x-auto text-xs">{STATES.map((item) => <Link key={item} href={`/dev/history-fixtures?state=${item}`} aria-current={state === item ? 'page' : undefined} className="flex min-h-11 shrink-0 items-center rounded-md border border-line px-3">{item}</Link>)}</nav>
      {snapshot ? <SnapshotStory snapshot={snapshot} /> : <div className="mx-auto max-w-xl rounded-lg border border-line p-8"><p className="eyebrow text-rose">Unavailable by design</p><h1 className="mt-2 text-4xl">This story cannot be opened.</h1><p className="mt-3 text-sm leading-relaxed text-muted">Synthetic {state} state: the public route reveals neither the source identity nor whether privacy, blocking, revocation, or a missing record caused the denial.</p></div>}
    </Container>
  );
}
