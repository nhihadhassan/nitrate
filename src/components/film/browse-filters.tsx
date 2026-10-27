'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ChevronDownIcon } from '@/components/ui/icons';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export type BrowseFilterOption = { value: string; label: string };

/** Keep secondary catalogue filters out of the way on phones. */
export function BrowseFilters({
  pathname,
  query,
  decade,
  genre,
  decades,
  genres,
}: {
  pathname: '/films' | '/watchlist';
  query: Record<string, string | number | undefined>;
  decade?: number;
  genre?: string;
  decades: BrowseFilterOption[];
  genres: BrowseFilterOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedDecade, setSelectedDecade] = useState(decade?.toString() ?? '');
  const [selectedGenre, setSelectedGenre] = useState(genre ?? '');
  useEffect(() => {
    if (!open) return;
    setSelectedDecade(decade?.toString() ?? '');
    setSelectedGenre(genre ?? '');
  }, [open, decade, genre]);
  const activeGenre = genres.find((option) => option.value === genre)?.label;
  const active = [decade ? `${decade}s` : null, activeGenre].filter(Boolean);
  const label = active.length ? active.join(' · ') : 'Era and genre';
  const href = (patch: Record<string, string | number | undefined>) => {
    const next = { ...query, ...patch };
    return { pathname, query: Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined && value !== '')) };
  };
  const navigate = (patch: Record<string, string | number | undefined>) => {
    const next = href(patch);
    const params = new URLSearchParams(Object.entries(next.query).map(([key, value]) => [key, String(value)]));
    router.push(params.size ? `${pathname}?${params.toString()}` : pathname);
    setOpen(false);
  };
  const optionClass = (selected: boolean) => cn(
    'flex min-h-10 shrink-0 items-center rounded-md border px-3 text-xs transition-colors',
    selected ? 'border-ember/40 bg-ember/10 text-ember' : 'border-line text-muted hover:text-text',
  );

  return <>
    <div className="sm:hidden">
      <Button variant="outline" className="min-w-0 max-w-full justify-start gap-2" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="truncate">{label}</span>
        {active.length ? <span className="shrink-0 rounded-full bg-ember/15 px-1.5 py-0.5 text-[0.625rem] text-ember">{active.length}</span> : null}
        <ChevronDownIcon className="ml-auto h-4 w-4 shrink-0" />
      </Button>
    </div>
    <div className="hidden space-y-3 sm:block">
      <FilterRow label="Decade">{decades.map((option) => <Link key={option.value || 'any'} href={href({ decade: option.value ? Number(option.value) : undefined, page: undefined })} aria-current={(decade?.toString() ?? '') === option.value ? 'true' : undefined} className={optionClass((decade?.toString() ?? '') === option.value)}>{option.label}</Link>)}</FilterRow>
      <FilterRow label="Genre">{genres.map((option) => <Link key={option.value || 'any'} href={href({ genre: option.value || undefined, page: undefined })} aria-current={(genre ?? '') === option.value ? 'true' : undefined} className={optionClass((genre ?? '') === option.value)}>{option.label}</Link>)}</FilterRow>
    </div>
    <Sheet open={open} onClose={() => setOpen(false)} title="Filter films" description="Choose an era and genre." size="sm" footer={<div className="flex items-center justify-between gap-3"><Button variant="ghost" onClick={() => navigate({ decade: undefined, genre: undefined, page: undefined })}>Clear filters</Button><Button variant="primary" onClick={() => navigate({ decade: selectedDecade ? Number(selectedDecade) : undefined, genre: selectedGenre || undefined, page: undefined })}>Apply filters</Button></div>}>
      <div className="space-y-6">
        <FilterChoices label="Decade">{decades.map((option) => <button key={option.value || 'any'} type="button" aria-pressed={selectedDecade === option.value} onClick={() => setSelectedDecade(option.value)} className={optionClass(selectedDecade === option.value)}>{option.label}</button>)}</FilterChoices>
        <FilterChoices label="Genre">{genres.map((option) => <button key={option.value || 'any'} type="button" aria-pressed={selectedGenre === option.value} onClick={() => setSelectedGenre(option.value)} className={optionClass(selectedGenre === option.value)}>{option.label}</button>)}</FilterChoices>
      </div>
    </Sheet>
  </>;
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <nav aria-label={label} className="mobile-tabs -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">{children}</nav>;
}

function FilterChoices({ label, children }: { label: string; children: React.ReactNode }) {
  return <fieldset><legend className="mb-2 text-sm font-medium">{label}</legend><div className="flex flex-wrap gap-2">{children}</div></fieldset>;
}
