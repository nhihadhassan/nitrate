'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Badge, inputClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { REPORT_CATEGORY_LABELS, type ReportCategory } from '@/lib/types';
import { relativeTime, truncate } from '@/lib/utils';
import { resolveReportAction } from '@/server/actions/admin';

type Report = {
  id: string;
  subjectType: string;
  subjectId: string;
  category: string;
  details: string | null;
  status: string;
  snapshot: Record<string, unknown>;
  createdAt: string;
  reporter: string;
};

const ACTIONS = [
  { value: 'none', label: 'No action' },
  { value: 'remove_content', label: 'Remove content' },
  { value: 'warn_user', label: 'Warn author' },
  { value: 'suspend_user', label: 'Suspend author' },
  { value: 'unsuspend_user', label: 'Unsuspend author' },
] as const;

export function ReportQueue({ reports }: { reports: Report[] }) {
  return (
    <ul className="space-y-4">
      {reports.map((report) => (
        <li key={report.id}>
          <ReportCard report={report} />
        </li>
      ))}
    </ul>
  );
}

function ReportCard({ report }: { report: Report }) {
  const router = useRouter();
  const toast = useToast();
  const [action, setAction] = useState<(typeof ACTIONS)[number]['value']>('none');
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();

  function resolve(status: 'reviewing' | 'actioned' | 'dismissed') {
    startTransition(async () => {
      const result = await resolveReportAction({
        reportId: report.id,
        status,
        note: note.trim() || undefined,
        action: status === 'actioned' ? action : 'none',
      });
      if (!result.ok) {
        toast({ message: result.error, tone: 'error' });
        return;
      }
      toast({ message: 'Report updated', tone: 'success' });
      router.refresh();
    });
  }

  const snapshotText =
    (report.snapshot.reviewText as string) ??
    (report.snapshot.body as string) ??
    (report.snapshot.title as string) ??
    (report.snapshot.bio as string) ??
    null;

  return (
    <article className="rounded-lg border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="rose">{REPORT_CATEGORY_LABELS[report.category as ReportCategory] ?? report.category}</Badge>
        <Badge>{report.subjectType}</Badge>
        <span className="text-xs text-dim">
          reported by {report.reporter} · {relativeTime(report.createdAt)}
        </span>
      </div>

      {report.details ? (
        <p className="mt-2.5 text-sm text-muted">“{report.details}”</p>
      ) : null}

      {/* Snapshot taken at report time, so deleting the content does not hide it. */}
      {snapshotText ? (
        <blockquote className="mt-3 rounded-md border border-line bg-surface px-3 py-2 text-sm text-muted">
          {truncate(snapshotText, 500)}
        </blockquote>
      ) : (
        <p className="mt-3 text-xs text-dim">No content snapshot was captured.</p>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-xs text-dim">Moderator note</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
            className={inputClass}
            placeholder="Context for the audit log"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-dim">Action</span>
          <select
            value={action}
            onChange={(event) => setAction(event.target.value as typeof action)}
            className={inputClass}
          >
            {ACTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="danger" size="sm" disabled={pending} onClick={() => resolve('actioned')}>
          Action &amp; close
        </Button>
        <Button variant="outline" size="sm" disabled={pending} onClick={() => resolve('dismissed')}>
          Dismiss
        </Button>
        {report.status === 'open' ? (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => resolve('reviewing')}>
            Mark reviewing
          </Button>
        ) : null}
      </div>
    </article>
  );
}
