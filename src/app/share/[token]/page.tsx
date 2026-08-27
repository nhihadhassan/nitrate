import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SnapshotStory } from '@/components/share/snapshot-story';
import { Container } from '@/components/ui/primitives';
import { getPublicShareSnapshot } from '@/server/services/shares';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Shared Nitrate story', robots: { index: false, follow: false } };

export default async function SharedStoryPage({ params }: { params: Promise<{ token: string }> }) {
  const snapshot = await getPublicShareSnapshot((await params).token).catch(() => null);
  if (!snapshot) notFound();
  return <Container size="wide" className="py-10"><SnapshotStory snapshot={snapshot} /><p className="mx-auto mt-12 max-w-5xl border-t border-line pt-5 text-xs text-dim">This is a revocable snapshot. It does not update with later private activity.</p></Container>;
}
