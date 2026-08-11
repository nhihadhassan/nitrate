import 'server-only';

import { and, eq, inArray, sql } from 'drizzle-orm';

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
    .values({
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
    })
    .onConflictDoUpdate({
      target: [movies.provider, movies.providerId],
      set: {
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
      },
    })
    .returning();
  return row;
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

/**
 * Resolves the `/film/[slug]` param, which may be a stored slug or a raw
 * provider id (used by deep links and the importer).
 */
export async function resolveMovie(slugOrProviderId: string): Promise<Movie> {
  const bySlug = await findMovieBySlug(slugOrProviderId);
  if (bySlug) return bySlug;

  if (/^\d+$/.test(slugOrProviderId)) {
    const byProvider = await findMovieByProviderId(slugOrProviderId);
    if (byProvider) return byProvider;
    const { movie } = await ensureMovieDetails(slugOrProviderId);
    return movie;
  }

  throw new NotFoundError('We could not find that film.');
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
