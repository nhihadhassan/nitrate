import type { Metadata } from 'next';
import Link from 'next/link';

import { Container } from '@/components/ui/primitives';
import type { NetworkSurface } from '@/lib/network';
import { getNetworkStatuses } from '@/server/services/network';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Network',
  description: 'Discover people, lists, Movie Clubs and what the Nitrate community is watching.',
  alternates: { canonical: '/network' },
  robots: { index: false, follow: false },
};

const SURFACES: Array<{
  key: NetworkSurface;
  href: string;
  title: string;
  description: string;
}> = [
  {
    key: 'people',
    href: '/network/people',
    title: 'People worth following',
    description: 'Film lovers whose taste overlaps with yours in useful, explainable ways.',
  },
  {
    key: 'community_lists',
    href: '/network/lists',
    title: 'Popular public lists',
    description: 'Collections people have spent real time shaping.',
  },
  {
    key: 'public_clubs',
    href: '/network/clubs',
    title: 'Interesting Movie Clubs',
    description: 'Public groups with an active film-watching rhythm.',
  },
  {
    key: 'community_trends',
    href: '/network/trends',
    title: 'What people are watching',
    description: 'Recent community activity, drawn only from public film logs.',
  },
];

export default async function NetworkPage() {
  const statuses = await getNetworkStatuses();
  const available = SURFACES.filter((surface) =>
    statuses.some((status) => status.key === surface.key && status.available),
  );

  return (
    <Container size="wide" className="py-10 pb-20">
      <header className="max-w-2xl">
        <p className="eyebrow">Community discovery</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">Network</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
          Discover people, lists, clubs and what the Nitrate community is watching.
        </p>
      </header>

      {available.length ? (
        <ul className="mt-9 grid gap-3 md:grid-cols-2">
          {available.map((surface) => (
            <li key={surface.key}>
              <Link
                href={surface.href}
                className="interactive-card block min-h-40 rounded-lg border border-line p-5 hover:border-line-strong"
              >
                <h2 className="text-2xl">{surface.title}</h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                  {surface.description}
                </p>
                <span className="mt-5 inline-block text-sm font-medium text-ember">Explore →</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <section className="mt-10 max-w-2xl border-y border-line py-8">
          <h2 className="text-2xl">Still taking shape</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Network will open when there is enough public activity to make it genuinely useful.
            Explore still has films, reviews and lists worth finding now.
          </p>
          <Link
            href="/explore"
            className="mt-5 inline-flex min-h-11 items-center rounded-md border border-line-strong px-4 text-sm font-medium hover:bg-surface-hover"
          >
            Keep exploring
          </Link>
        </section>
      )}
    </Container>
  );
}
