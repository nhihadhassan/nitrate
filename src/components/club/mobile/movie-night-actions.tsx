'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { CalendarIcon, ChevronDownIcon, FilmIcon, ShareIcon } from '@/components/ui/icons';
import { Field, FormError, inputClass } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { clubLocalInputValue, clubLocalToInstant } from '@/lib/utils';
import { updateScreeningAction } from '@/server/actions/clubs';

type Props = {
  screeningId: string;
  clubSlug: string;
  title: string;
  dateLabel: string;
  scheduledAt: string;
  location: string | null;
  inviteLink: string | null;
  watchLink: string | null;
  notes: string | null;
  canEdit: boolean;
};

export function MovieNightMobileActions(props: Props) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [openCalendar, setOpenCalendar] = useState(false);
  const [when, setWhen] = useState(() => clubLocalInputValue(new Date(props.scheduledAt)));
  const [location, setLocation] = useState(props.location ?? '');
  const [inviteLink, setInviteLink] = useState(props.inviteLink ?? '');
  const [watchLink, setWatchLink] = useState(props.watchLink ?? '');
  const [notes, setNotes] = useState(props.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openEditor(calendarFirst: boolean) {
    setOpenCalendar(calendarFirst);
    setEditing(true);
  }

  function save() {
    const instant = clubLocalToInstant(when);
    if (Number.isNaN(instant.getTime())) return setError('Choose a date and time.');
    setError(null);
    startTransition(async () => {
      const result = await updateScreeningAction({
        screeningId: props.screeningId,
        clubSlug: props.clubSlug,
        scheduledAt: instant.toISOString(),
        location: location.trim() || null,
        inviteLink: inviteLink.trim() || null,
        watchLink: watchLink.trim() || null,
        notes: notes.trim() || null,
      });
      if (!result.ok) return setError(result.error);
      toast({ message: 'Movie night updated', tone: 'success' });
      setEditing(false);
      router.refresh();
    });
  }

  async function share() {
    const data = { title: `${props.title} movie night`, url: window.location.href };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else {
      await navigator.clipboard.writeText(data.url);
      toast({ message: 'Movie-night link copied', tone: 'success' });
    }
  }

  const quickClass = 'flex min-h-[4.75rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas-raised px-2 text-center text-xs text-muted transition-colors hover:border-line-strong hover:text-text';

  return (
    <div className="space-y-4 lg:hidden">
      <div className="grid grid-cols-4 gap-2" aria-label="Movie night actions">
        {props.canEdit ? (
          <button type="button" onClick={() => openEditor(true)} className={quickClass}>
            <CalendarIcon className="h-5 w-5 text-text" /> Reschedule
          </button>
        ) : <span className={`${quickClass} opacity-45`}><CalendarIcon className="h-5 w-5" /> Reschedule</span>}
        {props.inviteLink ? <a href={props.inviteLink} target="_blank" rel="noreferrer noopener" className={quickClass}><ShareIcon className="h-5 w-5" /> Invite link</a> : <span className={`${quickClass} opacity-45`}><ShareIcon className="h-5 w-5" /> Invite link</span>}
        {props.watchLink ? <a href={props.watchLink} target="_blank" rel="noreferrer noopener" className={quickClass}><FilmIcon className="h-5 w-5" /> Watch link</a> : <span className={`${quickClass} opacity-45`}><FilmIcon className="h-5 w-5" /> Watch link</span>}
        <button type="button" onClick={share} className={quickClass}><ShareIcon className="h-5 w-5 text-text" /> Share</button>
      </div>

      <section className="rounded-xl border border-line bg-canvas-raised p-4" aria-labelledby="movie-night-details">
        <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
          <h2 id="movie-night-details" className="font-display text-xl">Details</h2>
          {props.canEdit ? <button type="button" onClick={() => openEditor(false)} className="min-h-10 px-2 text-sm font-medium text-ember">Edit</button> : null}
        </div>
        <dl className="divide-y divide-line text-sm">
          <DetailRow label="When" value={props.dateLabel} />
          <DetailRow label="Where" value={props.location ?? 'Not set'} />
          <DetailRow label="Invite link" value={props.inviteLink ?? 'Not set'} href={props.inviteLink} />
          <DetailRow label="Watch link" value={props.watchLink ?? 'Not set'} href={props.watchLink} />
          <DetailRow label="Notes" value={props.notes ?? 'No notes'} />
        </dl>
      </section>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit movie night" description="Toronto time (ET)" size="sm" footer={<div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button><Button variant="primary" size="sm" onClick={save} disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</Button></div>}>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save(); }}>
          <FormError>{error}</FormError>
          <Field label="When"><DateTimePicker value={when} onChange={setWhen} clearable={false} required defaultOpen={openCalendar} /></Field>
          <details className="group rounded-lg border border-line bg-canvas/40">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-medium text-muted hover:text-text">
              <span>More details</span>
              <ChevronDownIcon className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="space-y-4 border-t border-line p-3">
              <Field label="Where" optional><input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={200} className={inputClass} placeholder="Sam's flat / the Rio / a call" /></Field>
              <Field label="Invite link" optional><input type="url" value={inviteLink} onChange={(event) => setInviteLink(event.target.value)} maxLength={500} className={inputClass} placeholder="https://partiful.com/e/…" /></Field>
              <Field label="Watch link" optional><input type="url" value={watchLink} onChange={(event) => setWatchLink(event.target.value)} maxLength={500} className={inputClass} placeholder="https://" /></Field>
              <Field label="Notes" optional><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={1000} className={inputClass} /></Field>
            </div>
          </details>
        </form>
      </Sheet>
    </div>
  );
}

function DetailRow({ label, value, href }: { label: string; value: string; href?: string | null }) {
  return <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] gap-3 py-3"><dt className="text-text">{label}</dt><dd className="min-w-0 truncate text-muted">{href ? <a href={href} target="_blank" rel="noreferrer noopener" className="hover:text-ember">{value}</a> : value}</dd></div>;
}
