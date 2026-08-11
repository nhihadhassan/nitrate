import { EmptyState } from '@/components/ui/primitives';
import { relativeTime } from '@/lib/utils';
import { adminAuditLog } from '@/server/actions/admin';

export const dynamic = 'force-dynamic';

export default async function AdminAuditPage() {
  const entries = await adminAuditLog();

  if (!entries.length) {
    return (
      <EmptyState
        title="No moderation actions yet"
        description="Every action taken from this dashboard is recorded here permanently."
      />
    );
  }

  return (
    <ul className="divide-y divide-line">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2.5 text-sm">
          <span className="font-medium">@{entry.actor}</span>
          <span className="text-muted">{entry.action.replace(/_/g, ' ')}</span>
          <span className="text-dim">
            {entry.subjectType} · {entry.subjectId.slice(0, 8)}
          </span>
          {entry.reason ? <span className="text-muted">“{entry.reason}”</span> : null}
          <span className="ml-auto text-xs text-dim">{relativeTime(entry.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
