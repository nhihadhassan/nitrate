import { notFound } from 'next/navigation';

import { Poster, PosterGrid } from '@/components/film/poster';
import { ShareStory } from '@/components/share/share-story';
import { getCurrentUser } from '@/server/auth/session';
import { getClubBySlug, getMembership } from '@/server/services/clubs';
import { getClubYearbook } from '@/server/services/stats';

export const dynamic = 'force-dynamic';

export default async function ClubYearbookPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ year?: string }> }) {
  const club = await getClubBySlug((await params).slug);
  if (!club) notFound();
  const user = await getCurrentUser();
  const membership = await getMembership(club.id, user?.id ?? null);
  const rawYear = (await searchParams).year;
  const year = rawYear ? Number(rawYear) : null;
  const yearbook = await getClubYearbook(club.id, year, user?.id ?? null).catch(() => null);
  if (!yearbook) notFound();
  const canShare = club.visibility === 'public' && membership?.status === 'active' && membership.role !== 'member';

  return (
    <article className="mx-auto max-w-5xl space-y-12">
      <header className="border-b border-line pb-8"><p className="eyebrow text-iris">Club Yearbook</p><h1 className="mt-3 text-5xl sm:text-7xl">{yearbook.title}</h1><p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">A record of what the club watched and made together. Contributions are told without a leaderboard.</p></header>
      <section className="flex flex-wrap gap-x-12 gap-y-6"><Metric value={yearbook.screenings.length} label="movie nights" /><Metric value={yearbook.uniqueFilms} label="unique films" /><Metric value={Math.round(yearbook.totalRuntimeMinutes / 60)} label="hours together" /></section>
      {yearbook.ratingsWithheld ? <p className="rounded-md border border-line p-4 text-sm text-muted">Some group ratings stay hidden under this club’s blind-rating rules.</p> : null}
      <section><h2 className="eyebrow mb-4">The programme</h2><PosterGrid>{yearbook.screenings.map((screening) => <Poster key={screening.screeningId} film={screening} size="md" />)}</PosterGrid></section>
      {yearbook.memberStories.length ? <section className="border-t border-line pt-9"><h2 className="text-3xl">Made by the whole room</h2><div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{yearbook.memberStories.map((member) => <p key={member.displayName} className="text-sm text-muted"><span className="font-medium text-text">{member.displayName}</span><br />{member.picks} picks contributed · {member.attended} nights attended</p>)}</div></section> : null}
      {yearbook.collage.length ? <section><h2 className="eyebrow mb-4">Closing collage</h2><PosterGrid>{yearbook.collage.map((film, index) => <Poster key={`${film.movieId}-${index}`} film={film} size="sm" />)}</PosterGrid></section> : null}
      {canShare ? <ShareStory createInput={{ kind: 'club_yearbook', clubId: club.id, year }} imageUrl={`/api/cards/yearbook/${club.id}${year ? `?year=${year}` : ''}`} /> : null}
    </article>
  );
}

function Metric({ value, label }: { value: number; label: string }) { return <div><p className="font-display text-5xl tabular">{value}</p><p className="text-xs uppercase tracking-[0.14em] text-dim">{label}</p></div>; }
