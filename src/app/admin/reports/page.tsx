import Link from 'next/link';

import { ReportQueue } from '@/components/admin/report-queue';
import { EmptyState } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { adminReports } from '@/server/actions/admin';

export const dynamic = 'force-dynamic';

const STATUSES = ['open', 'reviewing', 'actioned', 'dismissed'] as const;

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = (STATUSES.find((s) => s === status) ?? 'open') as (typeof STATUSES)[number];
  const rows = await adminReports(active);

  return (
    <div>
      <nav aria-label="Report status" className="mb-5 flex flex-wrap gap-1 text-xs">
        {STATUSES.map((option) => (
          <Link
            key={option}
            href={`/admin/reports?status=${option}`}
            aria-current={active === option ? 'true' : undefined}
            className={cn(
              'rounded-md border px-2.5 py-1 capitalize transition-colors',
              active === option
                ? 'border-iris/40 bg-iris/10 text-iris'
                : 'border-line text-muted hover:text-text',
            )}
          >
            {option}
          </Link>
        ))}
      </nav>

      {rows.length ? (
        <ReportQueue
          reports={rows.map(({ report, reporter }) => ({
            id: report.id,
            subjectType: report.subjectType,
            subjectId: report.subjectId,
            category: report.category,
            details: report.details,
            status: report.status,
            snapshot: report.snapshot,
            createdAt: report.createdAt.toISOString(),
            reporter: reporter.displayName,
          }))}
        />
      ) : (
        <EmptyState title={`Nothing ${active}`} description="The queue is clear." />
      )}
    </div>
  );
}
