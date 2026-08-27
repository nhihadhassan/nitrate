import type { Metadata } from 'next';
import Link from 'next/link';

import { ListLibraryCard } from '@/components/list/list-library-card';
import { Button } from '@/components/ui/button';
import { Container, EmptyState, inputClass } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { requireUser } from '@/server/auth/session';
import { getListLibrary, type ListLibrarySort, type ListLibraryView } from '@/server/services/lists';

export const metadata: Metadata = { title: 'List library' };
export const dynamic = 'force-dynamic';

const VIEWS: Array<{ key: ListLibraryView; label: string }> = [
  { key: 'mine', label: 'Your lists' },
  { key: 'saved', label: 'Saved Lists' },
  { key: 'liked', label: 'Likes' },
];
const SORTS: Array<{ key: ListLibrarySort; label: string }> = [
  { key: 'updated', label: 'Updated' },
  { key: 'title', label: 'A–Z' },
  { key: 'popular', label: 'Popular' },
];

export default async function ListLibraryPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; sort?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const view = (VIEWS.find((item) => item.key === params.view)?.key ?? 'mine') as ListLibraryView;
  const sort = (SORTS.find((item) => item.key === params.sort)?.key ?? 'updated') as ListLibrarySort;
  const q = params.q?.trim() ?? '';
  const library = await getListLibrary(user.id, { view, sort, q });
  return (
    <Container size="wide" className="py-8 pb-20">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Private library</p><h1 className="mt-1 text-3xl sm:text-4xl">Lists</h1><p className="mt-2 text-sm text-muted">Your lists, private saves, and public likes in one searchable place.</p></div>
        <div className="flex gap-2"><Button asChild variant="outline"><Link href="/lists/collaboration">Invitations</Link></Button><Button asChild variant="primary"><Link href="/lists/new">New list</Link></Button></div>
      </header>
      <nav aria-label="List library sections" className="mobile-tabs mt-6 flex gap-2 overflow-x-auto">{VIEWS.map((item) => <Link key={item.key} href={{ pathname: '/lists', query: { view: item.key, sort, ...(q ? { q } : {}) } }} aria-current={view === item.key ? 'page' : undefined} className={cn('flex min-h-11 shrink-0 items-center rounded-md border px-3 text-sm', view === item.key ? 'border-ember/40 bg-ember/10 text-ember' : 'border-line text-muted')}>{item.label}</Link>)}</nav>
      <form className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto]" action="/lists">
        <input type="hidden" name="view" value={view} />
        <input name="q" defaultValue={q} className={inputClass} placeholder="Search titles and descriptions" aria-label="Search list library" />
        <select name="sort" defaultValue={sort} className={inputClass} aria-label="Sort list library">{SORTS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
        <Button type="submit" variant="secondary">Apply</Button>
      </form>
      {library.length ? <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{library.map((list) => <ListLibraryCard key={list.id} list={list} author={list.owner} initialPinned={list.libraryPinned} pinKind={view === 'mine' ? 'owned' : view === 'saved' ? 'saved' : null} />)}</div> : <div className="mt-10"><EmptyState title={q ? 'No matching lists' : view === 'saved' ? 'No Saved Lists' : view === 'liked' ? 'No liked lists' : 'No lists yet'} description={view === 'saved' ? 'Saving is private. Use Save privately on any list you can view.' : 'Create or discover a list to fill this section.'} /></div>}
    </Container>
  );
}
