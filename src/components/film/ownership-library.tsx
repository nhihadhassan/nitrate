'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FormError, inputClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { removeOwnershipCopyAction, saveOwnershipCopyAction } from '@/server/actions/ownership';
import type { OwnershipCopy, OwnershipFormat } from '@/server/db/schema';

const FORMAT_LABELS: Record<OwnershipFormat, string> = {
  '4k_uhd': '4K UHD', 'blu_ray': 'Blu-ray', dvd: 'DVD', digital: 'Digital', other: 'Other',
};

export function OwnershipLibrary({ movieId, copies }: { movieId: string; copies: OwnershipCopy[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<OwnershipFormat>('blu_ray');
  const [edition, setEdition] = useState('');
  const [notes, setNotes] = useState('');
  const [purchasedOn, setPurchasedOn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="mt-5 rounded-lg border border-line bg-surface/65 p-4" aria-labelledby="ownership-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="ownership-title" className="font-display text-lg">In your library</h2>
          <p className="mt-0.5 text-xs text-dim">Private to you. Add every physical or digital copy you own.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          {open ? 'Close' : 'Add a copy'}
        </Button>
      </div>

      {copies.length ? (
        <ul className="mt-3 space-y-2">
          {copies.map((copy) => (
            <li key={copy.id} className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{FORMAT_LABELS[copy.format]}</span>
                {copy.edition ? <span className="text-muted"> · {copy.edition}</span> : null}
                {copy.purchasedOn ? <span className="block text-xs text-dim">Purchased {copy.purchasedOn}</span> : null}
                {copy.notes ? <span className="mt-0.5 block text-xs text-dim">{copy.notes}</span> : null}
              </span>
              <button type="button" disabled={pending} onClick={() => startTransition(async () => {
                const result = await removeOwnershipCopyAction({ copyId: copy.id });
                if (!result.ok) return setError(result.error);
                toast({ message: 'Copy removed from your library', tone: 'success' });
                router.refresh();
              })} className="min-h-11 shrink-0 px-2 text-xs text-muted underline underline-offset-2 hover:text-rose">Remove</button>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-muted">No owned copies recorded yet.</p>}

      {open ? (
        <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <Field label="Format" htmlFor="ownership-format">
            <select id="ownership-format" className={inputClass} value={format} onChange={(event) => setFormat(event.target.value as OwnershipFormat)}>
              {Object.entries(FORMAT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Edition" htmlFor="ownership-edition" optional>
            <input id="ownership-edition" className={inputClass} maxLength={120} value={edition} onChange={(event) => setEdition(event.target.value)} placeholder="Criterion, steelbook…" />
          </Field>
          <Field label="Purchase date" htmlFor="ownership-date" optional>
            <input id="ownership-date" type="date" className={inputClass} value={purchasedOn} onChange={(event) => setPurchasedOn(event.target.value)} />
          </Field>
          <Field label="Private notes" htmlFor="ownership-notes" optional>
            <input id="ownership-notes" className={inputClass} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <FormError>{error}</FormError>
            <Button disabled={pending} onClick={() => startTransition(async () => {
              setError(null);
              const result = await saveOwnershipCopyAction({ movieId, format, edition: edition || null, notes: notes || null, purchasedOn: purchasedOn || null });
              if (!result.ok) return setError(result.error);
              setEdition(''); setNotes(''); setPurchasedOn(''); setOpen(false);
              toast({ message: 'Copy added to your library', tone: 'success' });
              router.refresh();
            })}>{pending ? 'Saving…' : 'Save copy'}</Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
