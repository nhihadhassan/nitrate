import Link from 'next/link';

import { PosterRail } from '@/components/film/poster-rail';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/ui/primitives';
import type { RankedStat, StatsScope } from '@/lib/stats';
import { loadProfileContext } from '@/server/services/profile-context';
import { getPersonalStats } from '@/server/services/stats';

export const dynamic = 'force-dynamic';

function parseScope(query: { scope?: string; year?: string; month?: string }): StatsScope {
  const now = new Date();
  const year = Math.max(1900, Math.min(2200, Number(query.year) || now.getFullYear()));
  if (query.scope === 'all') return { kind: 'all-time' };
  if (query.scope === 'month') return { kind: 'month', year, month: Math.max(1, Math.min(12, Number(query.month) || now.getMonth() + 1)) };
  if (query.scope === 'custom') return { kind: 'custom-year', year };
  return { kind: 'year', year };
}

export default async function StatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ scope?: string; year?: string; month?: string }>;
}) {
  const { username } = await params;
  const query = await searchParams;
  const { profile, viewer, access } = await loadProfileContext(username);
  const scope = parseScope(query);
  const stats = await getPersonalStats(profile.id, scope);
  const base = `/u/${encodeURIComponent(profile.username)}/stats`;

  return (
    <div className="mx-auto max-w-5xl space-y-12">
      <header className="border-b border-line pb-7">
        <p className="eyebrow text-ember">Your taste, in context</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl sm:text-5xl">{stats.scopeLabel}</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              A reading of {access.isSelf ? 'your' : `${profile.displayName}’s`} viewing history, without a score for being a person.
            </p>
          </div>
          {access.isSelf && scope.kind !== 'month' && scope.kind !== 'all-time' ? (
            <Button asChild variant="primary"><Link href={`/u/${profile.username}/recap/${scope.year}`}>Open {scope.year === new Date().getFullYear() ? 'Year so far' : `${scope.year} recap`}</Link></Button>
          ) : viewer && viewer.id !== profile.id ? (
            <Button asChild variant="outline"><Link href={`/taste/${viewer.id}/${profile.id}`}>Compare your taste</Link></Button>
          ) : null}
        </div>
        <nav aria-label="Statistics period" className="mobile-tabs -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 text-xs sm:mx-0 sm:px-0">
          <ScopeLink href={`${base}?scope=year&year=${new Date().getFullYear()}`} active={scope.kind === 'year' && scope.year === new Date().getFullYear()}>This year</ScopeLink>
          <ScopeLink href={`${base}?scope=month&year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}`} active={scope.kind === 'month'}>This month</ScopeLink>
          <ScopeLink href={`${base}?scope=all`} active={scope.kind === 'all-time'}>All time</ScopeLink>
          {stats.availableYears.map((year) => <ScopeLink key={year} href={`${base}?scope=custom&year=${year}`} active={(scope.kind === 'year' || scope.kind === 'custom-year') && scope.year === year}>{year}</ScopeLink>)}
        </nav>
      </header>

      <section aria-labelledby="stats-story">
        <h2 id="stats-story" className="sr-only">Viewing overview</h2>
        <dl className="flex flex-wrap gap-x-10 gap-y-6">
          <Metric label="dated viewings" value={stats.viewingCount} href={`/u/${profile.username}/diary${scope.kind === 'all-time' ? '' : `?year=${scope.year}`}`} />
          <Metric label="unique films" value={stats.uniqueFilms} href={`/u/${profile.username}/films`} />
          <Metric label="library total" value={stats.libraryTotal} href={`/u/${profile.username}/films`} />
          <Metric label="hours" value={Math.round(stats.runtimeMinutes / 60)} />
          <Metric label="rated" value={stats.ratedCount} />
          <Metric label="average" value={stats.averageRating == null ? '—' : (stats.averageRating / 2).toFixed(1)} />
          <Metric label="rewatches" value={stats.rewatches} />
          <Metric label="new to you" value={stats.newToYou} />
        </dl>
      </section>

      {stats.latestViewings.length ? (
        <section>
          <SectionHeading title="The films behind the numbers" />
          <PosterRail label={`${stats.scopeLabel} films`} films={stats.latestViewings} />
        </section>
      ) : (
        <p className="rounded-lg border border-line p-6 text-sm text-muted">No dated viewings in this period yet.</p>
      )}

      <section className="grid min-w-0 gap-10 border-t border-line pt-9 sm:grid-cols-2 lg:grid-cols-3">
        <Ranked title="Genres" items={stats.topGenres} />
        <Ranked title="Directors" items={stats.topDirectors} />
        <Ranked title="Actors" items={stats.topActors} />
        <Ranked title="Decades" items={stats.decades} />
        <Ranked title="Languages" items={stats.languages} />
        <Ranked title="Runtimes" items={stats.runtimeBands} />
      </section>

      <section className="grid gap-10 border-t border-line pt-9 sm:grid-cols-2">
        <Ranked title="Days you watch" items={stats.activityByWeekday} />
        <Ranked title="Months in motion" items={stats.activityByMonth} />
      </section>

      {stats.opinionOutliers.length ? (
        <section className="border-t border-line pt-9">
          <SectionHeading title="Where your opinion wandered" subtitle="Films where your rating most clearly differed from Nitrate’s current community average. A difference is shown only after three community ratings." />
          <ul className="divide-y divide-line">
            {stats.opinionOutliers.map((film) => (
              <li key={film.movieId} className="flex items-baseline justify-between gap-4 py-3 text-sm">
                <Link href={`/film/${film.slug}`} className="font-medium hover:text-ember">{film.title}</Link>
                <span className="text-xs text-dim tabular">You {(film.rating! / 2).toFixed(1)} · community {(film.communityRating / 2).toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="border-t border-line pt-9">
        <SectionHeading title="Taste changes" />
        <ul className="space-y-2 text-sm leading-relaxed text-muted">
          {stats.tasteChanges.map((change) => <li key={change}>{change}</li>)}
        </ul>
      </section>
    </div>
  );
}

function ScopeLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} aria-current={active ? 'page' : undefined} className={active ? 'flex min-h-11 shrink-0 items-center rounded-md border border-ember/40 bg-ember/10 px-3 text-ember' : 'flex min-h-11 shrink-0 items-center rounded-md border border-line px-3 text-muted hover:text-text'}>{children}</Link>;
}

function Metric({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const content = <><dd className="font-display text-4xl tabular">{value}</dd><dt className="mt-1 text-[0.6875rem] uppercase tracking-[0.14em] text-dim">{label}</dt></>;
  return <div>{href ? <Link href={href} className="block hover:text-ember">{content}</Link> : content}</div>;
}

function Ranked({ title, items }: { title: string; items: RankedStat[] }) {
  return <div className="min-w-0"><h2 className="eyebrow mb-3">{title}</h2>{items.length ? <ol className="space-y-2">{items.slice(0, 8).map((item, index) => <li key={item.label} className="flex items-baseline gap-3 text-sm"><span className="w-5 text-xs text-dim tabular">{String(index + 1).padStart(2, '0')}</span><span className="min-w-0 flex-1 truncate text-muted">{item.label}</span><span className="text-xs text-dim tabular">{item.count}</span></li>)}</ol> : <p className="text-sm text-dim">Not enough data yet.</p>}</div>;
}
