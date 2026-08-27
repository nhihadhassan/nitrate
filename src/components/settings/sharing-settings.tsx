'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { revokeShareSnapshotAction } from '@/server/actions/shares';

export function SharingSettings({ shares }: { shares: Array<{ id: string; kind: string; year: number | null; createdAt: string; lastAccessedAt: string | null }> }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <div className="max-w-xl">
      <h2 className="text-2xl">Public story links</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">Links contain a frozen, sanitized story rather than live account data. Revoke any link here; its token cannot be recovered or reopened from this page.</p>
      {shares.length ? <ul className="mt-6 divide-y divide-line border-y border-line">{shares.map((share) => <li key={share.id} className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-medium">{label(share.kind, share.year)}</p><p className="mt-0.5 text-xs text-dim">Created {new Date(share.createdAt).toLocaleDateString('en-CA')}{share.lastAccessedAt ? ` · last opened ${new Date(share.lastAccessedAt).toLocaleDateString('en-CA')}` : ' · not opened yet'}</p></div><Button size="sm" variant="danger" disabled={pending} onClick={() => startTransition(async () => { const result = await revokeShareSnapshotAction(share.id); if (!result.ok) return toast({ message: result.error, tone: 'error' }); toast({ message: 'Public link revoked', tone: 'success' }); router.refresh(); })}>Revoke</Button></li>)}</ul> : <p className="mt-6 rounded-md border border-line p-4 text-sm text-dim">You have no active public story links.</p>}
    </div>
  );
}

function label(kind: string, year: number | null) {
  if (kind === 'personal_recap') return `${year ?? ''} personal recap`;
  if (kind === 'club_yearbook') return `${year ?? 'All-time'} Club Yearbook`;
  return 'Taste comparison';
}
