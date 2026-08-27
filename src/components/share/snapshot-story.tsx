import { Poster, PosterGrid } from '@/components/film/poster';
import type { ShareSnapshot } from '@/lib/stats';

export function SnapshotStory({ snapshot }: { snapshot: ShareSnapshot }) {
  if (snapshot.kind === 'personal_recap') {
    const recap = snapshot.payload;
    return (
      <article className="mx-auto max-w-5xl space-y-10">
        <header><p className="eyebrow text-ember">A shared Nitrate recap</p><h1 className="mt-3 text-5xl sm:text-7xl">{recap.title}</h1><p className="mt-4 max-w-2xl text-lg text-muted">{recap.closingLine}</p></header>
        <p className="font-display text-4xl">{recap.stats.uniqueFilms} films · {Math.round(recap.stats.runtimeMinutes / 60)} hours · {recap.stats.rewatches} rewatches</p>
        {recap.collage.length ? <PosterGrid>{recap.collage.map((film, index) => <Poster key={`${film.movieId}-${index}`} film={film} size="sm" />)}</PosterGrid> : null}
      </article>
    );
  }
  if (snapshot.kind === 'club_yearbook') {
    const yearbook = snapshot.payload;
    return (
      <article className="mx-auto max-w-5xl space-y-10">
        <header><p className="eyebrow text-iris">A shared Club Yearbook</p><h1 className="mt-3 text-5xl sm:text-7xl">{yearbook.title}</h1><p className="mt-4 text-muted">{yearbook.screenings.length} movie nights, remembered without ranking the people who made them happen.</p></header>
        {yearbook.ratingsWithheld ? <p className="rounded-md border border-line p-4 text-sm text-muted">Blind club ratings remain inside the club and are not included in this public story.</p> : null}
        <PosterGrid>{yearbook.collage.map((film, index) => <Poster key={`${film.movieId}-${index}`} film={film} size="sm" />)}</PosterGrid>
      </article>
    );
  }
  const comparison = snapshot.payload;
  return (
    <article className="mx-auto max-w-5xl space-y-10">
      <header><p className="eyebrow text-jade">Taste comparison</p><h1 className="mt-3 text-5xl sm:text-7xl">{comparison.left.displayName} & {comparison.right.displayName}</h1><p className="mt-4 text-muted">{comparison.confidenceLabel}. No match percentage, just the films behind the comparison.</p></header>
      <ComparisonRows title="Shared favourites" films={comparison.sharedFavourites} />
      <ComparisonRows title="Close agreements" films={comparison.agreements} />
      <ComparisonRows title="Good disagreements" films={comparison.disagreements} />
    </article>
  );
}

function ComparisonRows({ title, films }: { title: string; films: Array<{ movieId: string; slug: string; title: string; year: number | null; posterPath: string | null }> }) {
  return films.length ? <section><h2 className="eyebrow mb-3">{title}</h2><PosterGrid>{films.map((film) => <Poster key={film.movieId} film={film} size="sm" />)}</PosterGrid></section> : null;
}
