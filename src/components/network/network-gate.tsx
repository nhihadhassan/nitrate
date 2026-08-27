import Link from 'next/link';

import { NETWORK_THRESHOLDS, type NetworkSurface } from '@/lib/network';

const LABELS: Record<NetworkSurface, string> = { people: 'People discovery', community_lists: 'Community lists', public_clubs: 'Public clubs', community_trends: 'Community trends' };

export function NetworkGate({ surface, metrics, streak }: { surface: NetworkSurface; metrics: Record<string, number>; streak: number }) {
  const thresholds = NETWORK_THRESHOLDS[surface];
  return <section className="mx-auto max-w-2xl rounded-xl border border-line bg-surface/45 p-6 text-center">
    <p className="eyebrow">Evidence gate</p><h1 className="mt-2 text-3xl">{LABELS[surface]} is still gathering signal</h1>
    <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted">Nitrate unlocks this automatically only after the real community meets every threshold for seven consecutive days. Synthetic fixtures never count.</p>
    <dl className="mt-6 grid gap-2 text-left sm:grid-cols-2">{Object.entries(thresholds).map(([key, target]) => <div key={key} className="rounded-md border border-line p-3"><dt className="text-xs text-dim">{key.replaceAll(/([A-Z])/g, ' $1').toLowerCase()}</dt><dd className="mt-1 text-xl tabular">{metrics[key] ?? 0} <span className="text-sm text-dim">/ {target}</span></dd></div>)}</dl>
    <p className="mt-4 text-xs text-dim">Current consecutive eligible days: {streak} / 7</p>
    <Link href="/network" className="mt-5 inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm">Back to Network</Link>
  </section>;
}
