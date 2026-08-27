import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Container, EmptyState } from '@/components/ui/primitives';
import { syntheticCurationState } from '@/test-fixtures/curation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Synthetic curation fixtures', robots: { index: false, follow: false } };

const STATES = ['normal', 'pending', 'stale', 'imported', 'high-volume', 'private', 'blocked', 'failure'];

export default async function CurationFixturesPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.ALLOW_SYNTHETIC_FIXTURES !== 'true') notFound();
  const stateName = (await searchParams).state ?? 'normal';
  const state = syntheticCurationState(stateName);
  return (
    <Container size="wide" className="py-8 pb-20">
      <nav aria-label="Synthetic curation states" className="mobile-tabs mb-8 flex gap-2 overflow-x-auto text-xs">{STATES.map((item) => <Link key={item} href={`/dev/curation-fixtures?state=${item}`} aria-current={stateName === item ? 'page' : undefined} className="flex min-h-11 shrink-0 items-center rounded-md border border-line px-3">{item}</Link>)}</nav>
      {state.unavailable ? <EmptyState title={state.title} description={state.description} /> : <>
        <header className="max-w-3xl"><p className="eyebrow">Nitrate 1.6 · synthetic data</p><h1 className="mt-2 text-4xl sm:text-5xl">{state.title}</h1><p className="mt-3 text-sm text-muted">{state.description}</p><p className="mt-2 text-xs text-dim">{state.itemCount} films · list version 14 · cloned from Synthetic Source</p></header>
        {state.conflict ? <p role="alert" className="mt-5 rounded-md border border-rose/30 bg-rose/[0.06] p-3 text-sm text-rose">{state.conflict}</p> : null}
        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div><div className="mb-3 flex flex-wrap gap-2"><button className="min-h-11 rounded-md border border-line px-3 text-sm">Add film</button><button className="min-h-11 rounded-md border border-line px-3 text-sm">Transfer to Movie Ideas</button><button className="min-h-11 rounded-md border border-line px-3 text-sm">Download art</button></div><ol className="divide-y divide-line border-y border-line">{state.items.map((item, index) => <li key={item.id} className="grid min-h-16 gap-2 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center"><span className="text-sm text-dim">{index + 1}</span><div><p className="text-sm font-medium">{item.title} <span className="text-xs text-dim">{item.year}</span></p><p className="text-xs text-dim">Added by {item.contributor}{item.note ? ` · ${item.note}` : ''}</p></div><div className="flex gap-1"><button aria-label={`Move ${item.title} up`} className="h-11 w-11 rounded-md">↑</button><button aria-label={`Move ${item.title} down`} className="h-11 w-11 rounded-md">↓</button></div></li>)}</ol>{state.itemCount > state.items.length ? <p className="mt-3 text-xs text-dim">Showing the first {state.items.length} of {state.itemCount} synthetic films.</p> : null}</div>
          <aside className="space-y-5"><section className="rounded-lg border border-line p-4"><p className="eyebrow">Roles</p><ul className="mt-2 space-y-2">{state.editors.map((editor) => <li key={editor.name} className="flex justify-between gap-3 text-sm"><span>{editor.name}</span><span className="text-dim">{editor.status}</span></li>)}</ul><button className="mt-4 min-h-11 w-full rounded-md border border-line px-3 text-sm">Invite editor</button></section><section className="rounded-lg border border-line p-4"><p className="eyebrow">Private library controls</p><div className="mt-3 flex flex-wrap gap-2"><button className="min-h-11 rounded-md border border-line px-3 text-sm">Save privately</button><button className="min-h-11 rounded-md border border-line px-3 text-sm">Clone</button><button className="min-h-11 rounded-md border border-line px-3 text-sm">Pin</button></div></section></aside>
        </section>
      </>}
    </Container>
  );
}
