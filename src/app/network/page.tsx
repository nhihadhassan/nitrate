import Link from 'next/link';

import { Container } from '@/components/ui/primitives';
import { NETWORK_THRESHOLDS, type NetworkSurface } from '@/lib/network';
import { getNetworkStatuses } from '@/server/services/network';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Network', description: 'Evidence-gated community discovery on Nitrate.' };

const DETAILS: Array<{ key: NetworkSurface; href: string; title: string; description: string }> = [
  { key: 'people', href: '/network/people', title: 'People', description: 'Public profiles with explainable taste overlap.' },
  { key: 'community_lists', href: '/network/lists', title: 'Community lists', description: 'Substantial public curation across many creators.' },
  { key: 'public_clubs', href: '/network/clubs', title: 'Public clubs', description: 'Active clubs with clear, moderated joining policies.' },
  { key: 'community_trends', href: '/network/trends', title: 'Community trends', description: 'Transparent 90-day film activity, never surveillance.' },
];

export default async function NetworkPage() {
  const statuses = await getNetworkStatuses();
  return <Container size="wide" className="py-8 pb-20"><header className="max-w-3xl"><p className="eyebrow">Nitrate 2.0</p><h1 className="mt-2 text-4xl sm:text-5xl">Network, when there is a real network.</h1><p className="mt-3 text-sm leading-relaxed text-muted">Every surface is built, but automatic availability waits for sustained evidence. Admins can force a surface on for controlled validation or off during an incident.</p></header><div className="mt-9 grid gap-4 md:grid-cols-2">{DETAILS.map((detail) => { const status = statuses.find((item) => item.key === detail.key)!; return <section key={detail.key} className="rounded-xl border border-line p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl">{detail.title}</h2><p className="mt-1 text-sm text-muted">{detail.description}</p></div><span className={`rounded-full px-2 py-1 text-[0.6875rem] font-medium ${status.available ? 'bg-fern/10 text-fern' : 'bg-surface text-dim'}`}>{status.available ? 'Available' : 'Gated'}</span></div><p className="mt-4 text-xs text-dim">{status.streak}/7 eligible days · mode {status.mode.replaceAll('_', ' ')}</p><dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">{Object.entries(NETWORK_THRESHOLDS[detail.key]).map(([key, value]) => <div key={key}><dt className="inline">{key.replaceAll(/([A-Z])/g, ' $1').toLowerCase()}: </dt><dd className="inline tabular">{status.metrics[key] ?? 0}/{value}</dd></div>)}</dl><Link href={detail.href} className="mt-5 inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm font-medium">{status.available ? 'Open' : 'See evidence gate'}</Link></section>; })}</div></Container>;
}
