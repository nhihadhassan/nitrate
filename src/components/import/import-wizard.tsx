'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { UploadIcon } from '@/components/ui/icons';
import { FormError } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { posterUrl } from '@/lib/images';
import { cn, pluralize } from '@/lib/utils';
import {
  confirmImportAction,
  matchImportSliceAction,
  resolveImportRowAction,
  startImportAction,
} from '@/server/actions/import';

type Row = {
  id: string;
  kind: string;
  rawTitle: string;
  rawYear: number | null;
  matchStatus: string;
  confidence: number | null;
  error: string | null;
  candidates: { providerId: string; title: string; year: number | null; posterPath: string | null }[];
  matched: { title: string; year: number | null; posterPath: string | null; slug: string } | null;
};

type Batch = {
  id: string;
  status: string;
  counts: Record<string, number>;
  totals: Record<string, number>;
  rows: Row[];
};

/**
 * Upload → parse → match → preview → resolve → confirm → import → summary.
 *
 * Matching is driven from here in slices so a 2,000-film export shows steady
 * progress instead of a spinner that might be a timeout.
 */
export function ImportWizard({ initialBatch }: { initialBatch: Batch | null }) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [batch, setBatch] = useState<Batch | null>(initialBatch);
  const [error, setError] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [summary, setSummary] = useState<Record<string, number> | null>(
    initialBatch?.status === 'completed' ? initialBatch.totals : null,
  );
  const [pending, startTransition] = useTransition();

  // Drive the matching loop whenever a batch is still resolving.
  useEffect(() => {
    if (!batch || batch.status !== 'matching' || matching) return;
    let cancelled = false;

    async function loop() {
      setMatching(true);
      for (;;) {
        const result = await matchImportSliceAction(batch!.id);
        if (cancelled) return;
        if (!result.ok) {
          setError(result.error);
          break;
        }
        setRemaining(result.data.remaining);
        if (result.data.remaining === 0) break;
      }
      setMatching(false);
      if (!cancelled) router.replace(`/settings/import?batch=${batch!.id}`);
    }

    void loop();
    return () => {
      cancelled = true;
    };
  }, [batch, matching, router]);

  async function upload(fileList: FileList) {
    setError(null);
    const files = await Promise.all(
      Array.from(fileList)
        .filter((file) => file.name.toLowerCase().endsWith('.csv'))
        .slice(0, 12)
        .map(async (file) => ({ name: file.name, text: await file.text() })),
    );

    if (!files.length) {
      setError('Those files are not CSVs. Upload the files from your Letterboxd export zip.');
      return;
    }

    startTransition(async () => {
      const result = await startImportAction({ files });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBatch({ id: result.data.batchId, status: 'matching', counts: {}, totals: {}, rows: [] });
      setRemaining(result.data.staged);
    });
  }

  if (summary) {
    return (
      <div className="max-w-xl space-y-6">
        <div>
          <h2 className="text-2xl">Import complete</h2>
          <p className="mt-1.5 text-sm text-muted">Your history is in. Nothing was overwritten.</p>
        </div>
        <dl className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-surface/50 p-4">
          <Stat label="Rows imported" value={summary.imported ?? 0} />
          <Stat label="Diary entries" value={summary.diary ?? 0} />
          <Stat label="Watchlist adds" value={summary.watchlist ?? 0} />
          <Stat label="Lists created" value={summary.lists ?? 0} />
          <Stat label="Needs your review" value={summary.unresolved ?? 0} />
          <Stat label="Failed" value={summary.failed ?? 0} />
        </dl>
        {(summary.unresolved ?? 0) > 0 ? (
          <p className="text-sm text-muted">
            {pluralize(summary.unresolved ?? 0, 'row')} could not be matched confidently. They are
            still here — nothing was discarded — and you can resolve them by re-running the import.
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button asChild variant="primary">
            <Link href="/">Go to your feed</Link>
          </Button>
          <Button variant="outline" onClick={() => { setSummary(null); setBatch(null); }}>
            Import more
          </Button>
        </div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="max-w-xl space-y-6">
        <div>
          <h2 className="text-2xl">Import from Letterboxd</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Export your data from Letterboxd (Settings → Data → Export), unzip it, and upload the
            CSVs here. We read <code className="text-xs">diary</code>,{' '}
            <code className="text-xs">reviews</code>, <code className="text-xs">ratings</code>,{' '}
            <code className="text-xs">watched</code>, <code className="text-xs">watchlist</code> and
            any lists.
          </p>
        </div>

        <FormError>{error}</FormError>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (event.dataTransfer.files.length) void upload(event.dataTransfer.files);
          }}
          className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-line px-6 py-12 text-center transition-colors hover:border-ember/40"
        >
          <UploadIcon className="h-6 w-6 text-dim" />
          <span className="font-medium">{pending ? 'Reading files…' : 'Choose CSV files'}</span>
          <span className="text-xs text-dim">or drop the whole unzipped folder&apos;s CSVs here</span>
        </button>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files?.length) void upload(event.target.files);
            event.target.value = '';
          }}
        />

        <ul className="space-y-1.5 text-xs text-dim">
          <li>· Re-running the same import will not duplicate anything.</li>
          <li>· Rewatches keep their own date, rating and review.</li>
          <li>· Anything we cannot match is kept for you to resolve, never dropped.</li>
        </ul>
      </div>
    );
  }

  if (batch.status === 'matching' || matching) {
    return (
      <div className="max-w-xl space-y-4">
        <h2 className="text-2xl">Matching your films…</h2>
        <p className="text-sm text-muted">
          {remaining !== null && remaining > 0
            ? `${pluralize(remaining, 'row')} to go. You can leave this open.`
            : 'Finishing up.'}
        </p>
        <div className="h-1 overflow-hidden rounded-full bg-line">
          <div className="h-full w-1/3 animate-pulse bg-ember" />
        </div>
        <FormError>{error}</FormError>
      </div>
    );
  }

  const ambiguous = batch.rows.filter((r) => r.matchStatus === 'ambiguous');
  const unmatched = batch.rows.filter((r) => r.matchStatus === 'unmatched');
  const matched = batch.rows.filter((r) => r.matchStatus === 'matched');

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-2xl">Review before importing</h2>
        <p className="mt-1.5 text-sm text-muted">
          {pluralize(matched.length, 'row')} matched confidently.
          {ambiguous.length ? ` ${ambiguous.length} need a quick check.` : ''}
          {unmatched.length ? ` ${unmatched.length} could not be found.` : ''}
        </p>
      </div>

      <FormError>{error}</FormError>

      {ambiguous.length ? (
        <section>
          <h3 className="eyebrow mb-3">Check these matches</h3>
          <ul className="space-y-2">
            {ambiguous.slice(0, 40).map((row) => (
              <ResolveRow key={row.id} row={row} onResolved={() => router.refresh()} />
            ))}
          </ul>
        </section>
      ) : null}

      {unmatched.length ? (
        <section>
          <h3 className="eyebrow mb-3">Not found</h3>
          <ul className="space-y-2">
            {unmatched.slice(0, 40).map((row) => (
              <ResolveRow key={row.id} row={row} onResolved={() => router.refresh()} />
            ))}
          </ul>
          <p className="mt-2 text-xs text-dim">
            These stay in the import and are skipped rather than guessed at.
          </p>
        </section>
      ) : null}

      <section className="border-t border-line pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Ready to import {pluralize(matched.length + ambiguous.length, 'row')}.
          </p>
          <Button
            variant="primary"
            size="lg"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await confirmImportAction(batch.id);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setSummary(result.data as unknown as Record<string, number>);
                toast({ message: 'Import complete', tone: 'success' });
              })
            }
          >
            {pending ? 'Importing…' : 'Import my history'}
          </Button>
        </div>
      </section>
    </div>
  );
}

function ResolveRow({ row, onResolved }: { row: Row; onResolved: () => void }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [resolved, setResolved] = useState<string | null>(null);

  function choose(providerId: string | null) {
    startTransition(async () => {
      const result = await resolveImportRowAction(row.id, providerId);
      if (!result.ok) {
        toast({ message: result.error, tone: 'error' });
        return;
      }
      setResolved(providerId ?? 'skipped');
      onResolved();
    });
  }

  return (
    <li className="rounded-lg border border-line p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium">
          {row.rawTitle}
          {row.rawYear ? <span className="ml-1.5 text-xs text-dim tabular">{row.rawYear}</span> : null}
        </p>
        <span className="shrink-0 text-[0.6875rem] uppercase tracking-wide text-dim">{row.kind}</span>
      </div>

      {resolved ? (
        <p className="mt-1.5 text-xs text-jade">
          {resolved === 'skipped' ? 'Skipped' : 'Match updated'}
        </p>
      ) : row.candidates.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {row.candidates.slice(0, 4).map((candidate) => {
            const poster = posterUrl(candidate.posterPath, 'xs');
            return (
              <li key={candidate.providerId}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => choose(candidate.providerId)}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
                    row.matched?.title === candidate.title
                      ? 'border-ember/40 bg-ember/10'
                      : 'border-line hover:border-line-strong',
                  )}
                >
                  {poster ? (
                    <span className="relative h-9 w-6 shrink-0 overflow-hidden rounded-xs">
                      <Image src={poster} alt="" fill sizes="24px" className="object-cover" />
                    </span>
                  ) : null}
                  <span className="min-w-0">
                    <span className="block truncate">{candidate.title}</span>
                    <span className="text-[0.625rem] text-dim tabular">{candidate.year}</span>
                  </span>
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              disabled={pending}
              onClick={() => choose(null)}
              className="rounded-md border border-line px-2.5 py-1.5 text-xs text-dim transition-colors hover:text-rose"
            >
              Skip this
            </button>
          </li>
        </ul>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <p className="text-xs text-dim">
            {row.error ?? 'No candidates found on the film database.'}
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => choose(null)}
            className="rounded-md border border-line px-2 py-1 text-xs text-dim hover:text-rose"
          >
            Skip
          </button>
        </div>
      )}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[0.6875rem] uppercase tracking-wide text-dim">{label}</dt>
      <dd className="font-display text-2xl tabular">{value}</dd>
    </div>
  );
}
