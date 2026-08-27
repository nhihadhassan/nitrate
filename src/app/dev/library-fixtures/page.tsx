import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Container, EmptyState } from '@/components/ui/primitives';
import { LIBRARY_FIXTURE_STATES, syntheticLibraryState } from '@/test-fixtures/library';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Synthetic permanent library fixtures', robots: { index: false, follow: false } };

export default async function LibraryFixturesPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.ALLOW_SYNTHETIC_FIXTURES !== 'true') notFound();
  const stateName = (await searchParams).state ?? 'normal';
  const fixture = syntheticLibraryState(stateName);
  return <Container size="wide" className="py-8 pb-20">
    <nav aria-label="Synthetic library states" className="mobile-tabs mb-8 flex gap-2 overflow-x-auto text-xs">{LIBRARY_FIXTURE_STATES.map((item) => <Link key={item} href={`/dev/library-fixtures?state=${item}`} aria-current={fixture.state === item ? 'page' : undefined} className="flex min-h-11 shrink-0 items-center rounded-md border border-line px-3">{item}</Link>)}</nav>
    {fixture.failed ? <EmptyState title={fixture.title} description={fixture.description} /> : <>
      <header className="max-w-3xl"><p className="eyebrow">Nitrate 1.7 · synthetic data only</p><h1 className="mt-2 text-4xl sm:text-5xl">{fixture.title}</h1><p className="mt-3 text-sm leading-relaxed text-muted">{fixture.description}</p></header>
      <section className="mt-8 grid gap-3 sm:grid-cols-3">{Object.entries(fixture.counts).map(([label, value]) => <div key={label} className="rounded-lg border border-line p-4"><p className="text-3xl tabular">{value.toLocaleString()}</p><p className="text-xs uppercase tracking-wide text-dim">{label}</p></div>)}</section>
      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div><h2 className="text-2xl">Owned copies</h2>{fixture.copies.length ? <ul className="mt-3 divide-y divide-line border-y border-line">{fixture.copies.map((copy, index) => <li key={`${copy.title}-${index}`} className="flex min-h-16 items-center justify-between gap-3 py-3"><div><p className="font-medium">{copy.title}</p><p className="text-xs text-dim">{copy.edition ?? 'Standard edition'}{copy.purchased ? ` · ${copy.purchased}` : ''}</p></div><span className="rounded-xs bg-iris/10 px-2 py-1 text-xs text-iris">{copy.format}</span></li>)}</ul> : <p className="mt-3 text-sm text-muted">No copies yet. An empty ownership file is still included.</p>}</div>
        <aside className="rounded-lg border border-line p-4"><p className="eyebrow">Private export</p><h2 className="mt-1 text-xl">Everything that is yours</h2><ul className="mt-3 space-y-2 text-sm text-muted"><li>Versioned Nitrate JSON</li><li>Human-readable CSVs</li><li>Safe Letterboxd mappings</li><li>No discussions or other people’s private data</li></ul><a href={`/dev/library-fixtures/archive?state=${fixture.state}`} className="mt-5 flex min-h-11 items-center justify-center rounded-md bg-ember px-4 text-sm font-semibold text-canvas">Download synthetic ZIP</a></aside>
      </section>
      <section className="mt-8"><h2 className="text-2xl">Optional viewing context</h2><div className="mt-3 flex flex-wrap gap-2">{fixture.contexts.map((context) => <span key={context} className="rounded-md border border-line px-3 py-2 text-sm">{context}</span>)}</div></section>
    </>}
  </Container>;
}
