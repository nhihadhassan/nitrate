import { Badge, EmptyState } from '@/components/ui/primitives';
import { EmailOutboxTools } from '@/components/admin/email-outbox-tools';
import { relativeTime } from '@/lib/utils';
import { requireAdmin } from '@/server/auth/session';
import { getOutbox, getOutboxCounts } from '@/server/email/queue';
import { emailIsConfigured } from '@/server/email/transport';

export const dynamic = 'force-dynamic';

const TONES = {
  sent: 'jade',
  queued: 'amber',
  failed: 'rose',
  skipped: 'neutral',
} as const;

export default async function AdminEmailPage() {
  await requireAdmin();
  const [rows, counts] = await Promise.all([getOutbox(80), getOutboxCounts()]);
  const configured = emailIsConfigured();

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl">Outbox</h2>
          <p className="mt-1 text-sm text-muted">
            Every message is written to the database first, then delivered by the hourly job — so a
            provider outage delays mail rather than losing it.
          </p>
        </div>
        <EmailOutboxTools />
      </div>

      {!configured ? (
        <p className="mb-5 rounded-md border border-amber/30 bg-amber/[0.07] px-3 py-2 text-xs text-amber">
          No email provider is configured. Mail still queues and can be inspected here, but it is
          printed to the server log instead of sent. Set <code>RESEND_API_KEY</code> and{' '}
          <code>EMAIL_FROM</code> to switch it on.
        </p>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-3 text-sm">
        {(['queued', 'sent', 'failed', 'skipped'] as const).map((status) => (
          <span key={status} className="rounded-md border border-line px-3 py-1.5">
            <span className="text-dim">{status}</span>{' '}
            <span className="tabular">{counts[status] ?? 0}</span>
          </span>
        ))}
      </div>

      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-dim">
                <th className="py-2 font-medium">To</th>
                <th className="py-2 font-medium">Subject</th>
                <th className="py-2 font-medium">Template</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 text-right font-medium">Attempts</th>
                <th className="py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line align-top">
                  <td className="py-2.5 text-muted">{row.toEmail}</td>
                  <td className="py-2.5">
                    {row.subject}
                    {row.error ? (
                      <span className="mt-0.5 block text-xs text-rose">{row.error}</span>
                    ) : null}
                  </td>
                  <td className="py-2.5 text-xs text-dim">{row.template}</td>
                  <td className="py-2.5">
                    <Badge tone={TONES[row.status]}>{row.status}</Badge>
                  </td>
                  <td className="py-2.5 text-right tabular">{row.attempts}</td>
                  <td className="py-2.5 text-xs text-dim">
                    {relativeTime(row.sentAt ?? row.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="Nothing sent yet"
          description="Club emails will appear here as they are queued."
        />
      )}
    </div>
  );
}
