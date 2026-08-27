import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Container, EmptyState } from '@/components/ui/primitives';
import { recommendationReasonLabel } from '@/lib/recommendations';
import { syntheticDiscoveryState } from '@/test-fixtures/discovery';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Synthetic discovery fixtures', robots: { index: false, follow: false } };

const STATES = ['normal', 'limited-overlap', 'circle-full', 'private', 'blocked', 'failure'];

export default async function DiscoveryFixturesPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.ALLOW_SYNTHETIC_FIXTURES !== 'true') notFound();
  const stateName = (await searchParams).state ?? 'normal';
  const state = syntheticDiscoveryState(stateName);
  return (
    <Container size="wide" className="py-8 pb-20">
      <nav aria-label="Synthetic discovery states" className="mobile-tabs mb-8 flex gap-2 overflow-x-auto text-xs">
        {STATES.map((item) => <Link key={item} href={`/dev/discovery-fixtures?state=${item}`} aria-current={stateName === item ? 'page' : undefined} className="flex min-h-11 shrink-0 items-center rounded-md border border-line px-3">{item}</Link>)}
      </nav>
      <header className="max-w-2xl">
        <p className="eyebrow">Nitrate 1.5 · synthetic data</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">{state.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{state.description}</p>
        {state.failure ? <p className="mt-4 rounded-md border border-rose/30 bg-rose/[0.06] p-3 text-xs text-rose">{state.failure}</p> : null}
      </header>

      <section className="mt-10">
        <h2 className="text-2xl">Find people</h2>
        {state.people.length ? <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{state.people.map((person) => (
          <li key={person.id} className="flex min-h-44 flex-col rounded-lg border border-line p-4">
            <p className="text-lg font-medium">{person.name}</p>
            <p className="text-xs text-dim">@{person.username} · {person.filmCount} films</p>
            <ul className="mt-3 space-y-1 text-xs text-muted">{person.reasons.map((reason) => <li key={reason.kind}>{recommendationReasonLabel(reason)}</li>)}</ul>
            <div className="mt-auto flex flex-wrap gap-2 pt-4"><button className="min-h-11 rounded-md border border-line px-3 text-xs">Follow</button><button className="min-h-11 rounded-md px-3 text-xs text-muted">Hide</button><button className="min-h-11 rounded-md px-3 text-xs text-muted">Already know</button></div>
          </li>
        ))}</ul> : <div className="mt-4"><EmptyState title="No eligible suggestions" description="The private and block boundary is applied before any suggestion reaches the page." /></div>}
      </section>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <section className="rounded-lg border border-line p-5">
          <p className="eyebrow">Private Taste circle · {state.circle.length}/5</p>
          <h2 className="mt-1 text-2xl">Chronological, when enabled</h2>
          <ul className="mt-4 divide-y divide-line">{state.circle.map((person) => <li key={person.username} className="py-3"><p className="text-sm font-medium">{person.name}</p><p className="text-xs text-dim">@{person.username}</p></li>)}</ul>
          {stateName === 'circle-full' ? <p className="mt-4 text-xs text-amber">Five-person limit reached. Add is disabled until someone is removed.</p> : null}
        </section>
        <section className="rounded-lg border border-line p-5">
          <p className="eyebrow">Reversible controls</p>
          <h2 className="mt-1 text-2xl">Hidden recommendations</h2>
          <ul className="mt-4 divide-y divide-line">{state.hidden.map((item) => <li key={item.label} className="flex min-h-14 items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-dim">{item.detail}</p></div><button className="min-h-11 rounded-md border border-line px-3 text-xs">Restore</button></li>)}</ul>
        </section>
      </div>
    </Container>
  );
}
