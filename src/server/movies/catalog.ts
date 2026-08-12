import 'server-only';

import { and, eq, inArray, sql } from 'drizzle-orm';

import type { FilmRef } from '@/lib/types';
import { slugify } from '@/lib/utils';
import { db, type DbOrTx } from '@/server/db';
import { credits, genres, movieGenres, movies, people, type Movie } from '@/server/db/schema';
import { NotFoundError } from '@/server/errors';

import {
  primaryProvider,
  withProvider,
  type ProviderMovieDetail,
  type ProviderMovieSummary,
} from './provider';

/** Re-fetch full credits at most once a month; film metadata barely moves. */
const DETAIL_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function providerName() {
  return primaryProvider().id === 'offline' ? 'tmdb' : primaryProvider().id;
}

async function uniqueSlug(base: string, providerId: string, tx: DbOrTx): Promise<string> {
  const candidate = base || 'film';
  const existing = await tx
    .select({ slug: movies.slug, providerId: movies.providerId })
    .from(movies)
    .where(eq(movies.slug, candidate))
    .limit(1);
  if (!existing.length || existing[0].providerId === providerId) return candidate;
  return `${candidate}-${providerId}`;
}

export function movieSlugBase(title: string, year: number | null): string {
  return year ? `${slugify(title, 50)}-${year}` : slugify(title, 60);
}

/* -------------------------------------------------------------------------- */
/* Ingestion                                                                  */
/* -------------------------------------------------------------------------- */

function movieValues(summary: ProviderMovieSummary, provider: string, slug: string) {
  return {
    provider,
    providerId: summary.providerId,
    slug,
    title: summary.title,
    originalTitle: summary.originalTitle ?? null,
    year: summary.year,
    releaseDate: summary.releaseDate,
    overview: summary.overview,
    posterPath: summary.posterPath,
    backdropPath: summary.backdropPath,
    adult: summary.adult,
    providerPopularity: summary.popularity,
    providerVoteAverage: summary.voteAverage,
    providerVoteCount: summary.voteCount,
  };
}

/**
 * What a repeat sighting of a film is allowed to change. Notably absent: the
 * slug (URLs are permanent once issued) and every local aggregate.
 */
function summaryRefreshSet() {
  return {
    title: sql`excluded.title`,
    originalTitle: sql`excluded.original_title`,
    year: sql`excluded.year`,
    releaseDate: sql`excluded.release_date`,
    overview: sql`coalesce(excluded.overview, ${movies.overview})`,
    posterPath: sql`coalesce(excluded.poster_path, ${movies.posterPath})`,
    backdropPath: sql`coalesce(excluded.backdrop_path, ${movies.backdropPath})`,
    providerPopularity: sql`excluded.provider_popularity`,
    providerVoteAverage: sql`excluded.provider_vote_average`,
    providerVoteCount: sql`excluded.provider_vote_count`,
    updatedAt: new Date(),
  };
}

/**
 * Persists a provider summary as a canonical local film. Idempotent: repeated
 * calls refresh the volatile fields and leave local aggregates alone.
 */
export async function upsertMovieFromSummary(
  summary: ProviderMovieSummary,
  tx: DbOrTx = db,
): Promise<Movie> {
  const provider = providerName();
  const slug = await uniqueSlug(movieSlugBase(summary.title, summary.year), summary.providerId, tx);

  const [row] = await tx
    .insert(movies)
    .values(movieValues(summary, provider, slug))
    .onConflictDoUpdate({
      target: [movies.provider, movies.providerId],
      set: summaryRefreshSet(),
    })
    .returning();
  return row;
}

/**
 * Turns a page of provider results into canonical local films, in one round
 * trip rather than one per title.
 *
 * This is the seam that keeps `/film/<provider id>` URLs out of the product.
 * Discovery rails, search and filmographies all arrive as provider summaries;
 * running them through here before they reach a component means every link is
 * a real slug backed by a real row. Metadata is refreshed on the way past, so
 * the catalogue stays warm without a second job.
 *
 * Only summary fields are written — credits and runtime still hydrate lazily on
 * the film page, so a rail costs one insert and no provider calls.
 */
export async function ensureMoviesFromSummaries(
  summaries: ProviderMovieSummary[],
): Promise<Movie[]> {
  const wanted = dedupeBy(
    summaries.filter((summary) => summary.providerId),
    (summary) => summary.providerId,
  );
  if (!wanted.length) return [];

  const provider = providerName();
  const byProviderId = new Map<string, Movie>();

  const existing = await db
    .select()
    .from(movies)
    .where(
      and(
        eq(movies.provider, provider),
        inArray(
          movies.providerId,
          wanted.map((summary) => summary.providerId),
        ),
      ),
    );
  for (const row of existing) byProviderId.set(row.providerId, row);

  const missing = wanted.filter((summary) => !byProviderId.has(summary.providerId));

  if (missing.length) {
    const bases = missing.map((summary) => movieSlugBase(summary.title, summary.year) || 'film');
    // One lookup answers "is this slug spoken for?" for the whole batch.
    const taken = new Set(
      (
        await db
          .select({ slug: movies.slug })
          .from(movies)
          .where(inArray(movies.slug, Array.from(new Set(bases))))
      ).map((row) => row.slug),
    );

    const values = missing.map((summary, index) => {
      const base = bases[index];
      // Two different films sharing a title *and* a year is rare but real;
      // disambiguate with the provider id rather than a counter, so the slug is
      // stable no matter what order the batch happened to arrive in.
      const slug = taken.has(base) ? `${base}-${summary.providerId}` : base;
      taken.add(slug);
      return { summary, slug };
    });

    try {
      const inserted = await db
        .insert(movies)
        .values(values.map(({ summary, slug }) => movieValues(summary, provider, slug)))
        .onConflictDoUpdate({
          target: [movies.provider, movies.providerId],
          set: summaryRefreshSet(),
        })
        .returning();
      for (const row of inserted) byProviderId.set(row.providerId, row);
    } catch (error) {
      // A concurrent request can claim a slug between our lookup and our insert.
      // One bad row must not cost the whole rail, so fall back to per-film
      // upserts, which resolve slugs individually.
      console.warn('[movies] batch ingest fell back to per-film upsert:', error);
      for (const { summary } of values) {
        try {
          const row = await upsertMovieFromSummary(summary);
          byProviderId.set(row.providerId, row);
        } catch (rowError) {
          console.warn(`[movies] could not ingest ${summary.providerId}:`, rowError);
        }
      }
    }
  }

  // Provider ordering is the editorial ordering; preserve it exactly.
  return wanted
    .map((summary) => byProviderId.get(summary.providerId))
    .filter((movie): movie is Movie => Boolean(movie));
}

/** The canonical, linkable projection of a local film row. */
export function toFilmRef(movie: Movie): FilmRef {
  return {
    id: movie.id,
    slug: movie.slug,
    title: movie.title,
    year: movie.year,
    posterPath: movie.posterPath,
  };
}

/** Provider results, canonicalised and ready to render. */
export async function filmRefsFromSummaries(
  summaries: ProviderMovieSummary[],
): Promise<FilmRef[]> {
  const rows = await ensureMoviesFromSummaries(summaries);
  return rows.map(toFilmRef);
}

async function upsertGenres(list: { providerId: string; name: string }[], tx: DbOrTx) {
  if (!list.length) return [];
  const rows = await tx
    .insert(genres)
    .values(list.map((g) => ({ providerId: g.providerId, name: g.name, slug: slugify(g.name) })))
    .onConflictDoUpdate({ target: genres.providerId, set: { name: sql`excluded.name` } })
    .returning();
  return rows;
}

/**
 * Fetches full details (credits, genres, runtime) and stores them. Safe to call
 * on every film page view — it short-circuits when the local copy is fresh.
 */
export async function ensureMovieDetails(
  providerId: string,
  options: { force?: boolean } = {},
): Promise<{ movie: Movie; detail: ProviderMovieDetail | null; degraded: boolean }> {
  const existing = await findMovieByProviderId(providerId);

  const isFresh =
    existing?.detailsFetchedAt && Date.now() - existing.detailsFetchedAt.getTime() < DETAIL_TTL_MS;
  if (existing && isFresh && !options.force) {
    return { movie: existing, detail: null, degraded: false };
  }

  const { data: detail, degraded } = await withProvider((provider) => provider.getMovie(providerId));
  if (!detail) {
    if (existing) return { movie: existing, detail: null, degraded };
    throw new NotFoundError('We could not find that film.');
  }

  const movie = await db.transaction(async (tx) => {
    const saved = await upsertMovieFromSummary(detail, tx);

    await tx
      .update(movies)
      .set({
        runtime: detail.runtime,
        tagline: detail.tagline,
        imdbId: detail.imdbId,
        originalLanguage: detail.originalLanguage,
        releaseStatus: detail.status,
        detailsFetchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(movies.id, saved.id));

    const genreRows = await upsertGenres(detail.genres, tx);
    if (genreRows.length) {
      await tx.delete(movieGenres).where(eq(movieGenres.movieId, saved.id));
      await tx
        .insert(movieGenres)
        .values(genreRows.map((g) => ({ movieId: saved.id, genreId: g.id })))
        .onConflictDoNothing();
    }

    if (detail.credits.length) {
      const peopleRows = await tx
        .insert(people)
        .values(
          dedupeBy(detail.credits, (c) => c.personProviderId).map((c) => ({
            provider: providerName(),
            providerId: c.personProviderId,
            name: c.name,
            slug: slugify(c.name),
            profilePath: c.profilePath,
            knownForDepartment: c.knownForDepartment,
          })),
        )
        .onConflictDoUpdate({
          target: [people.provider, people.providerId],
          set: {
            name: sql`excluded.name`,
            profilePath: sql`coalesce(excluded.profile_path, ${people.profilePath})`,
          },
        })
        .returning();

      const byProviderId = new Map(peopleRows.map((p) => [p.providerId, p.id]));
      await tx.delete(credits).where(eq(credits.movieId, saved.id));
      const creditValues = detail.credits
        .map((c) => {
          const personId = byProviderId.get(c.personProviderId);
          if (!personId) return null;
          return {
            movieId: saved.id,
            personId,
            kind: c.kind,
            character: c.character ?? null,
            department: c.department ?? null,
            job: c.job ?? null,
            sortOrder: c.order,
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);
      if (creditValues.length) {
        await tx.insert(credits).values(creditValues).onConflictDoNothing();
      }
    }

    const [fresh] = await tx.select().from(movies).where(eq(movies.id, saved.id)).limit(1);
    return fresh;
  });

  // Store the "similar" films too so related-film rails survive an outage.
  if (detail.similar.length) {
    await Promise.all(
      detail.similar.slice(0, 8).map((s) => upsertMovieFromSummary(s).catch(() => undefined)),
    );
  }

  return { movie, detail, degraded };
}

function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Lookups                                                                    */
/* -------------------------------------------------------------------------- */

export async function findMovieByProviderId(providerId: string): Promise<Movie | null> {
  const [row] = await db
    .select()
    .from(movies)
    .where(and(eq(movies.provider, providerName()), eq(movies.providerId, providerId)))
    .limit(1);
  return row ?? null;
}

export async function findMovieBySlug(slug: string): Promise<Movie | null> {
  const [row] = await db.select().from(movies).where(eq(movies.slug, slug)).limit(1);
  return row ?? null;
}

export async function getMovieById(id: string): Promise<Movie> {
  const [row] = await db.select().from(movies).where(eq(movies.id, id)).limit(1);
  if (!row) throw new NotFoundError('We could not find that film.');
  return row;
}

export async function moviesByIds(ids: string[]): Promise<Map<string, Movie>> {
  if (!ids.length) return new Map();
  const rows = await db.select().from(movies).where(inArray(movies.id, ids));
  return new Map(rows.map((r) => [r.id, r]));
}

/** A `/film/[slug]` param that is a bare provider id rather than a slug. */
export function isProviderIdParam(param: string): boolean {
  return /^\d+$/.test(param);
}

/**
 * Resolves the `/film/[slug]` param, which is normally a canonical slug but may
 * be a raw provider id: the product no longer emits those, yet links shared
 * before the canonical system existed — and anything pasted from TMDB — still
 * have to land somewhere real.
 *
 * Returns `null` rather than throwing when the film genuinely does not exist,
 * so callers can render a 404 instead of an error boundary.
 */
export async function resolveMovie(slugOrProviderId: string): Promise<Movie | null> {
  const bySlug = await findMovieBySlug(slugOrProviderId);
  if (bySlug) return bySlug;

  if (!isProviderIdParam(slugOrProviderId)) return null;

  const byProvider = await findMovieByProviderId(slugOrProviderId);
  if (byProvider) return byProvider;

  try {
    const { movie } = await ensureMovieDetails(slugOrProviderId);
    return movie;
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

/**
 * Makes sure a provider film exists locally before anything references it by id.
 * Every write path (log, watchlist, list, nomination, queue) funnels through here.
 */
export async function ensureMovieByProviderId(providerId: string): Promise<Movie> {
  const existing = await findMovieByProviderId(providerId);
  if (existing) return existing;
  const { movie } = await ensureMovieDetails(providerId);
  return movie;
}
