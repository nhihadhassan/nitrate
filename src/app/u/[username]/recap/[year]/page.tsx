import { notFound } from 'next/navigation';

import { Poster, PosterGrid } from '@/components/film/poster';
import { ShareStory } from '@/components/share/share-story';
import { loadProfileContext } from '@/server/services/profile-context';
import { getPersonalRecap } from '@/server/services/stats';

export const dynamic = 'force-dynamic';

export default async function RecapPage({ params }: { params: Promise<{ username: string; year: string }> }) {
  const { username, year: rawYear } = await params;
  const { profile, access } = await loadProfileContext(username);
  if (!access.isSelf) notFound();
  const year = Number(rawYear);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) notFound();
  const recap = await getPersonalRecap(profile.id, year);

  return (
    <article className="mx-auto max-w-5xl space-y-14">
      <header className="grid items-end gap-8 border-b border-line pb-10 sm:grid-cols-[minmax(0,1fr)_13rem]">
        <div>
          <p className="eyebrow text-ember">Private yearly recap</p>
          <h1 className="mt-3 text-5xl leading-none sm:text-7xl">{recap.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{recap.closingLine}</p>
        </div>
        {recap.openingFilm ? <Poster film={recap.openingFilm} size="lg" /> : null}
      </header>

      {recap.sparse ? (
        <section><p className="eyebrow">A quieter cut</p><h2 className="mt-2 text-3xl">Fewer entries, still a real year.</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">This recap leaves empty chapters out instead of padding them with invented conclusions.</p></section>
      ) : (
        <section><p className="eyebrow">The shape of the year</p><h2 className="mt-2 text-4xl">{recap.stats.uniqueFilms} films across {Math.round(recap.stats.runtimeMinutes / 60)} hours.</h2><p className="mt-3 text-sm text-muted">{recap.stats.rewatches} returns · {recap.stats.newToYou} new-to-you films · average {recap.stats.averageRating == null ? 'unrated' : `${(recap.stats.averageRating / 2).toFixed(1)} stars`}.</p></section>
      )}

      {recap.highestRated.length ? <section><p className="eyebrow mb-4">The films you held closest</p><PosterGrid>{recap.highestRated.map((film) => <Poster key={film.movieId} film={film} size="md" />)}</PosterGrid></section> : null}

      <section className="grid gap-8 border-y border-line py-9 sm:grid-cols-3">
        <StoryMetric value={recap.clubContribution.screenings} label="club screenings attended" />
        <StoryMetric value={recap.clubContribution.picks} label="club picks contributed" />
        <StoryMetric value={recap.clubContribution.ratings} label="club ratings left" />
      </section>

      {recap.collage.length ? <section><p className="eyebrow mb-4">Closing collage</p><PosterGrid>{recap.collage.map((film, index) => <Poster key={`${film.movieId}-${index}`} film={film} size="sm" />)}</PosterGrid></section> : null}

      <ShareStory createInput={{ kind: 'personal_recap', year }} imageUrl={`/api/cards/recap/${year}`} />
    </article>
  );
}

function StoryMetric({ value, label }: { value: number; label: string }) {
  return <div><p className="font-display text-5xl tabular">{value}</p><p className="mt-1 text-xs uppercase tracking-[0.14em] text-dim">{label}</p></div>;
}
