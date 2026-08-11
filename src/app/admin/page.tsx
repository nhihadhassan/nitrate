import Link from 'next/link';

import { and, eq, gte, sql } from 'drizzle-orm';

import { requireAdmin } from '@/server/auth/session';
import { db } from '@/server/db';
import {
  analyticsEvents,
  clubs,
  diaryEntries,
  reports,
  screenings,
  users,
} from '@/server/db/schema';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  await requireAdmin();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    [userCount],
    [openReports],
    [weekLogs],
    [clubCount],
    [screeningCount],
    clubRetention,
  ] = await Promise.all([
    db.select({ value: sql<number>`count(*)::int` }).from(users).where(sql`${users.deletedAt} is null`),
    db.select({ value: sql<number>`count(*)::int` }).from(reports).where(eq(reports.status, 'open')),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(diaryEntries)
      .where(gte(diaryEntries.createdAt, weekAgo)),
    db.select({ value: sql<number>`count(*)::int` }).from(clubs).where(sql`${clubs.deletedAt} is null`),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(screenings)
      .where(eq(screenings.status, 'completed')),

    // The retention question the PRD actually asks: do club members log more?
    db.execute<{ segment: string; users: number; logs: number }>(sql`
      with membership as (
        select u.id,
               exists (
                 select 1 from nitrate.club_members cm
                 where cm.user_id = u.id and cm.status = 'active'
               ) as in_club
        from nitrate.users u
        where u.deleted_at is null
      )
      select case when in_club then 'In a club' else 'Not in a club' end as segment,
             count(distinct m.id)::int as users,
             coalesce(count(d.id), 0)::int as logs
      from membership m
      left join nitrate.diary_entries d
        on d.user_id = m.id and d.created_at >= ${weekAgo} and d.deleted_at is null
      group by in_club
    `),
  ]);

  const [importSegment] = await db.execute<{ imported: number; not_imported: number }>(sql`
    select
      count(distinct case when a.name = 'import_completed' then a.user_id end)::int as imported,
      (select count(*) from nitrate.users where deleted_at is null)::int -
        count(distinct case when a.name = 'import_completed' then a.user_id end)::int as not_imported
    from nitrate.analytics_events a
  `);

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Metric label="Members" value={userCount?.value ?? 0} />
        <Metric
          label="Open reports"
          value={openReports?.value ?? 0}
          href="/admin/reports"
          urgent={(openReports?.value ?? 0) > 0}
        />
        <Metric label="Logs this week" value={weekLogs?.value ?? 0} />
        <Metric label="Clubs" value={clubCount?.value ?? 0} href="/admin/clubs" />
        <Metric label="Screenings done" value={screeningCount?.value ?? 0} />
      </section>

      <section>
        <h2 className="text-xl">Does the club loop work?</h2>
        <p className="mt-1 text-sm text-muted">
          Diary entries in the last seven days, split by club membership.
        </p>
        <table className="mt-3 w-full max-w-lg text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-dim">
              <th className="py-2 font-medium">Segment</th>
              <th className="py-2 text-right font-medium">Members</th>
              <th className="py-2 text-right font-medium">Logs</th>
              <th className="py-2 text-right font-medium">Per member</th>
            </tr>
          </thead>
          <tbody>
            {clubRetention.map((row) => (
              <tr key={row.segment} className="border-b border-line">
                <td className="py-2">{row.segment}</td>
                <td className="py-2 text-right tabular">{row.users}</td>
                <td className="py-2 text-right tabular">{row.logs}</td>
                <td className="py-2 text-right tabular">
                  {row.users ? (row.logs / row.users).toFixed(2) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-xl">Imports</h2>
        <p className="mt-1 text-sm text-muted">
          {importSegment?.imported ?? 0} members have imported a Letterboxd history;{' '}
          {importSegment?.not_imported ?? 0} have not.
        </p>
      </section>

      <section>
        <h2 className="text-xl">Recent product events</h2>
        <RecentEvents />
      </section>
    </div>
  );
}

async function RecentEvents() {
  const rows = await db
    .select({ name: analyticsEvents.name, value: sql<number>`count(*)::int` })
    .from(analyticsEvents)
    .where(and(gte(analyticsEvents.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))))
    .groupBy(analyticsEvents.name)
    .orderBy(sql`count(*) desc`)
    .limit(20);

  if (!rows.length) return <p className="mt-2 text-sm text-dim">No events in the last week.</p>;

  return (
    <ul className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <li key={row.name} className="flex justify-between gap-3 border-b border-line py-1.5 text-sm">
          <span className="truncate text-muted">{row.name}</span>
          <span className="tabular">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

function Metric({
  label,
  value,
  href,
  urgent,
}: {
  label: string;
  value: number;
  href?: string;
  urgent?: boolean;
}) {
  const content = (
    <div
      className={`rounded-lg border p-4 ${
        urgent ? 'border-rose/40 bg-rose/[0.07]' : 'border-line bg-surface/50'
      }`}
    >
      <p className="text-[0.6875rem] uppercase tracking-wide text-dim">{label}</p>
      <p className={`font-display text-3xl tabular ${urgent ? 'text-rose' : ''}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
