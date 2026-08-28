import 'server-only';

import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';

import { db } from '@/server/db';
import { credits, genres, movieGenres, movies, people } from '@/server/db/schema';

import type {
  DiscoverParams,
  MovieProvider,
  ProviderGenre,
  ProviderMovieDetail,
  ProviderMovieSummary,
  ProviderPage,
  ProviderPerson,
  WatchAvailability,
} from './types';

const PAGE_SIZE = 20;

type MovieRow = typeof movies.$inferSelect;

function rowToSummary(row: MovieRow): ProviderMovieSummary {
  return {
    providerId: row.providerId,
    title: row.title,
    originalTitle: row.originalTitle,
    year: row.year,
    releaseDate: row.releaseDate,
    posterPath: row.posterPath,
    backdropPath: row.backdropPath,
    overview: row.overview,
    popularity: row.providerPopularity,
    voteAverage: row.providerVoteAverage,
    voteCount: row.providerVoteCount,
    adult: row.adult,
  };
}

function page<T>(results: T[], pageNumber: number, total: number): ProviderPage<T> {
  return {
    results,
    page: pageNumber,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    totalResults: total,
  };
}

/**
 * Serves everything from the canonical films we have already stored.
 *
 * Two jobs: it is the automatic fallback when TMDB is unreachable, and it is
 * what runs when no provider credentials are configured at all. Because every
 * film a user touches is persisted locally, this degrades to "you can still use
 * everything you and your friends already know about" rather than a blank app.
 */
export class OfflineProvider implements MovieProvider {
  readonly id = 'offline' as const;

  async searchMovies(query: string, pageNumber = 1): Promise<ProviderPage<ProviderMovieSummary>> {
    const term = `%${query.trim().toLowerCase()}%`;
    const where = sql`lower(${movies.title}) like ${term} or lower(coalesce(${movies.originalTitle}, '')) like ${term}`;
    const [rows, [count]] = await Promise.all([
      db
        .select()
        .from(movies)
        .where(where)
        // Prefer a prefix match, then local engagement, then provider popularity.
        .orderBy(
          sql`case when lower(${movies.title}) like ${`${query.trim().toLowerCase()}%`} then 0 else 1 end`,
          desc(movies.watchCount),
          desc(movies.providerPopularity),
        )
        .limit(PAGE_SIZE)
        .offset((pageNumber - 1) * PAGE_SIZE),
      db.select({ n: sql<number>`count(*)::int` }).from(movies).where(where),
    ]);
    return page(rows.map(rowToSummary), pageNumber, count?.n ?? rows.length);
  }

  async searchPeople(query: string, pageNumber = 1): Promise<ProviderPage<ProviderPerson>> {
    const term = `%${query.trim().toLowerCase()}%`;
    const rows = await db
      .select()
      .from(people)
      .where(sql`lower(${people.name}) like ${term}`)
      .limit(PAGE_SIZE)
      .offset((pageNumber - 1) * PAGE_SIZE);
    return page(
      rows.map((p) => ({
        providerId: p.providerId,
        name: p.name,
        profilePath: p.profilePath,
        knownForDepartment: p.knownForDepartment,
      })),
      pageNumber,
      rows.length,
    );
  }

  async getMovie(providerId: string): Promise<ProviderMovieDetail | null> {
    const [row] = await db.select().from(movies).where(eq(movies.providerId, providerId)).limit(1);
    if (!row) return null;

    const [genreRows, creditRows] = await Promise.all([
      db
        .select({ providerId: genres.providerId, name: genres.name })
        .from(movieGenres)
        .innerJoin(genres, eq(genres.id, movieGenres.genreId))
        .where(eq(movieGenres.movieId, row.id)),
      db
        .select({ credit: credits, person: people })
        .from(credits)
        .innerJoin(people, eq(people.id, credits.personId))
        .where(eq(credits.movieId, row.id))
        .orderBy(credits.kind, credits.sortOrder),
    ]);

    return {
      ...rowToSummary(row),
      runtime: row.runtime,
      tagline: row.tagline,
      imdbId: row.imdbId,
      originalLanguage: row.originalLanguage,
      status: row.releaseStatus,
      genres: genreRows,
      credits: creditRows.map(({ credit, person }) => ({
        personProviderId: person.providerId,
        name: person.name,
        profilePath: person.profilePath,
        knownForDepartment: person.knownForDepartment,
        kind: credit.kind,
        character: credit.character,
        department: credit.department,
        job: credit.job,
        order: credit.sortOrder,
      })),
      similar: await this.similarTo(row),
    };
  }

  private async similarTo(row: MovieRow): Promise<ProviderMovieSummary[]> {
    const genreIds = await db
      .select({ id: movieGenres.genreId })
      .from(movieGenres)
      .where(eq(movieGenres.movieId, row.id));
    if (!genreIds.length) return [];
    const rows = await db
      .selectDistinctOn([movies.id])
      .from(movies)
      .innerJoin(movieGenres, eq(movieGenres.movieId, movies.id))
      .where(
        and(
          inArray(
            movieGenres.genreId,
            genreIds.map((g) => g.id),
          ),
          sql`${movies.id} <> ${row.id}`,
        ),
      )
      .limit(12);
    return rows.map((r) => rowToSummary(r.movies));
  }

  async getPerson(providerId: string): Promise<ProviderPerson | null> {
    const [person] = await db.select().from(people).where(eq(people.providerId, providerId)).limit(1);
    if (!person) return null;
    const rows = await db
      .select({ movie: movies })
      .from(credits)
      .innerJoin(movies, eq(movies.id, credits.movieId))
      .where(eq(credits.personId, person.id))
      .orderBy(desc(movies.providerPopularity))
      .limit(24);
    return {
      providerId: person.providerId,
      name: person.name,
      profilePath: person.profilePath,
      knownForDepartment: person.knownForDepartment,
      knownFor: rows.map((r) => rowToSummary(r.movie)),
    };
  }

  private async byPopularity(pageNumber: number, order = desc(movies.providerPopularity)) {
    const rows = await db
      .select()
      .from(movies)
      .orderBy(order)
      .limit(PAGE_SIZE)
      .offset((pageNumber - 1) * PAGE_SIZE);
    return page(rows.map(rowToSummary), pageNumber, rows.length);
  }

  trending() {
    return this.byPopularity(1);
  }

  popular(pageNumber = 1) {
    return this.byPopularity(pageNumber);
  }

  topRated(pageNumber = 1) {
    return this.byPopularity(pageNumber, desc(movies.providerVoteAverage));
  }

  nowPlaying(pageNumber = 1) {
    return this.byPopularity(pageNumber, desc(movies.releaseDate));
  }

  upcoming(pageNumber = 1) {
    return this.byPopularity(pageNumber, desc(movies.releaseDate));
  }

  async discover(params: DiscoverParams): Promise<ProviderPage<ProviderMovieSummary>> {
    const pageNumber = params.page ?? 1;
    const conditions = [];
    if (params.decade) {
      conditions.push(gte(movies.year, params.decade), lte(movies.year, params.decade + 9));
    }
    if (params.yearFrom) conditions.push(gte(movies.year, params.yearFrom));
    if (params.yearTo) conditions.push(lte(movies.year, params.yearTo));

    if (params.genreId) {
      const [genre] = await db
        .select({ id: genres.id })
        .from(genres)
        .where(eq(genres.providerId, params.genreId))
        .limit(1);
      if (!genre) return page([], pageNumber, 0);
      const rows = await db
        .select({ movie: movies })
        .from(movies)
        .innerJoin(movieGenres, eq(movieGenres.movieId, movies.id))
        .where(and(eq(movieGenres.genreId, genre.id), ...conditions))
        .orderBy(desc(movies.providerPopularity))
        .limit(PAGE_SIZE)
        .offset((pageNumber - 1) * PAGE_SIZE);
      return page(rows.map((r) => rowToSummary(r.movie)), pageNumber, rows.length);
    }

    const rows = await db
      .select()
      .from(movies)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(params.sortBy === 'rating' ? desc(movies.providerVoteAverage) : desc(movies.providerPopularity))
      .limit(PAGE_SIZE)
      .offset((pageNumber - 1) * PAGE_SIZE);
    return page(rows.map(rowToSummary), pageNumber, rows.length);
  }

  async genres(): Promise<ProviderGenre[]> {
    const rows = await db.select({ providerId: genres.providerId, name: genres.name }).from(genres);
    return rows;
  }

  // Nothing about streaming availability is stored locally — there is no
  // honest offline answer, so this degrades to "no data" rather than a guess.
  async watchProviders(): Promise<WatchAvailability | null> {
    return null;
  }

  async watchRegions(): Promise<{ code: string; name: string }[]> {
    return [];
  }
}
