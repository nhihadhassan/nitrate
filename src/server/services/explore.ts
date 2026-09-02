import 'server-only';

import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm';

import type { FilmRef } from '@/lib/types';
import {
  EXPLORE_MAX_BATCHES,
  EXPLORE_MAX_RAIL_PAGE,
  type ExploreCursor,
  type ExploreModule,
  type RailContinuation,
} from '@/lib/explore';
import type { RecommendationReason } from '@/lib/recommendations';
import { COMMUNITY_RANKING, PROVIDER_RANKING, bayesianAverage } from '@/lib/ranking';
import { db } from '@/server/db';
import {
  diaryEntries,
  clubMembers,
  clubQueueItems,
  follows,
  genres as genresTable,
  movieGenres,
  movies,
  userMovieState,
  users,
} from '@/server/db/schema';
import { ensureMoviesFromSummaries, filmRefsFromSummaries, toFilmRef } from '@/server/movies/catalog';
import {
  withProvider,
  type ProviderGenre,
  type ProviderMovieSummary,
} from '@/server/movies/provider';
import { viewableSql, type Viewer } from '@/server/privacy';

/** A rail entry: a canonical film plus, sometimes, the reason it is here. */
export type RailFilm = FilmRef & { caption?: string; reason?: RecommendationReason };

function usable(items: ProviderMovieSummary[]): ProviderMovieSummary[] {
  return items.filter((movie) => !movie.adult && movie.posterPath);
}

export type EditorialRails = {
  trending: RailFilm[];
  nowPlaying: RailFilm[];
  canon: RailFilm[];
  upcoming: RailFilm[];
  genres: ProviderGenre[];
  degraded: boolean;
};

/**
 * The four provider-sourced rails, ingested into canonical local records in a
 * single pass so every poster links to a real slug rather than a TMDB id.
 */
export async function getEditorialRails(): Promise<EditorialRails> {
  const [trending, nowPlaying, canon, upcoming, genres] = await Promise.all([
    withProvider((p) => p.trending('week')),
    withProvider((p) => p.nowPlaying(1)),
    // Not `/movie/top_rated`: asking discover for well-voted films and ranking
    // them ourselves means The Canon can be explained — and can never be topped
    // by something with a handful of votes.
    withProvider((p) => p.discover({ sortBy: 'rating', minVotes: 3000, page: 1 })),
    withProvider((p) => p.upcoming(1)),
    withProvider((p) => p.genres()),
  ]);

  const canonRanked = [...usable(canon.data.results)].sort(
    (a, b) =>
      bayesianAverage({ average: b.voteAverage, count: b.voteCount, ...PROVIDER_RANKING }) -
      bayesianAverage({ average: a.voteAverage, count: a.voteCount, ...PROVIDER_RANKING }),
  );

  const groups = [
    usable(trending.data.results),
    usable(nowPlaying.data.results),
    canonRanked,
    usable(upcoming.data.results),
  ];

  // One ingest for every rail on the page; provider id is the join key.
  const ingested = await ensureMoviesFromSummaries(groups.flat());
  const byProviderId = new Map(ingested.map((movie) => [movie.providerId, toFilmRef(movie)]));
  const pick = (items: ProviderMovieSummary[]): RailFilm[] =>
    items
      .map((item) => byProviderId.get(item.providerId))
      .filter((ref): ref is FilmRef => Boolean(ref));

  return {
    trending: pick(groups[0]),
    nowPlaying: pick(groups[1]).map((film) => ({
      ...film,
      caption: film.year && film.year < new Date().getFullYear() - 1 ? 'Re-release' : undefined,
    })),
    canon: pick(groups[2]),
    upcoming: pick(groups[3]),
    genres: genres.data,
    degraded: trending.degraded || canon.degraded,
  };
}

/**
 * Just the genre list, for pages that only need the chip filter and would
 * otherwise pay for the full editorial-rails ingest (five provider calls
 * plus a local write) just to read one of its five fields.
 */
export async function getGenres(): Promise<ProviderGenre[]> {
  const result = await withProvider((p) => p.genres());
  return result.data;
}

/** Watchlists are personal, so this only uses friends who made theirs public. */
export async function getFriendsWantToWatch(userId: string, limit = 12): Promise<RailFilm[]> {
  const rows = await db
    .select({ movie: movies, count: sql<number>`count(distinct ${userMovieState.userId})::int` })
    .from(userMovieState)
    .innerJoin(movies, eq(movies.id, userMovieState.movieId))
    .innerJoin(follows, eq(follows.followingId, userMovieState.userId))
    .innerJoin(users, eq(users.id, userMovieState.userId))
    .where(and(eq(follows.followerId, userId), eq(userMovieState.inWatchlist, true), eq(users.showWatchlistPublicly, true)))
    .groupBy(movies.id)
    .orderBy(desc(sql`count(distinct ${userMovieState.userId})`), desc(movies.providerPopularity))
    .limit(limit);
  return rows.map((row) => ({
    ...toFilmRef(row.movie),
    reason: { kind: 'community_signal', label: `${row.count} ${row.count === 1 ? 'friend wants to watch' : 'friends want to watch'}` },
  }));
}

/** A small rail from the shared Movie Ideas already present in the viewer's clubs. */
export async function getPopularWithClubs(userId: string, limit = 12): Promise<RailFilm[]> {
  const rows = await db
    .select({ movie: movies, count: sql<number>`count(distinct ${clubQueueItems.clubId})::int` })
    .from(clubQueueItems)
    .innerJoin(movies, eq(movies.id, clubQueueItems.movieId))
    .innerJoin(clubMembers, and(eq(clubMembers.clubId, clubQueueItems.clubId), eq(clubMembers.userId, userId)))
    .where(and(eq(clubMembers.status, 'active'), isNull(clubQueueItems.removedAt)))
    .groupBy(movies.id)
    .orderBy(desc(sql`count(distinct ${clubQueueItems.clubId})`), desc(movies.providerPopularity))
    .limit(limit);
  return rows.map((row) => ({ ...toFilmRef(row.movie), reason: { kind: 'club_interest', count: row.count } }));
}

/* -------------------------------------------------------------------------- */
/* Social discovery — our own data, simple explainable heuristics              */
/* -------------------------------------------------------------------------- */

const RECENT_WINDOW_MS = 1000 * 60 * 60 * 24 * 45;

/**
 * The single most valuable discovery signal we have: what the people this user
 * actually follows have been logging lately.
 */
export async function getFriendsAreWatching(userId: string, limit = 12): Promise<RailFilm[]> {
  const since = new Date(Date.now() - RECENT_WINDOW_MS);
  const rows = await db
    .select({ movie: movies, count: sql<number>`count(distinct ${diaryEntries.userId})::int` })
    .from(diaryEntries)
    .innerJoin(movies, eq(movies.id, diaryEntries.movieId))
    .innerJoin(follows, eq(follows.followingId, diaryEntries.userId))
    .where(
      and(
        eq(follows.followerId, userId),
        isNull(diaryEntries.deletedAt),
        gte(diaryEntries.createdAt, since),
        sql`${diaryEntries.visibility} <> 'private'`,
      ),
    )
    .groupBy(movies.id)
    .orderBy(desc(sql`count(distinct ${diaryEntries.userId})`), desc(movies.providerPopularity))
    .limit(limit);

  return rows.map((row) => ({
    ...toFilmRef(row.movie),
    reason: { kind: 'friend_watched', count: row.count },
  }));
}

/**
 * Loved, not merely watched. A heart from someone whose taste you chose to
 * follow is the strongest recommendation in the product.
 */
export async function getFriendsLoved(userId: string, limit = 12): Promise<RailFilm[]> {
  const rows = await db
    .select({
      movie: movies,
      count: sql<number>`count(distinct ${userMovieState.userId})::int`,
      names: sql<string[]>`array_agg(distinct ${users.displayName})`,
    })
    .from(userMovieState)
    .innerJoin(movies, eq(movies.id, userMovieState.movieId))
    .innerJoin(follows, eq(follows.followingId, userMovieState.userId))
    .innerJoin(users, eq(users.id, userMovieState.userId))
    .where(
      and(
        eq(follows.followerId, userId),
        eq(userMovieState.liked, true),
        isNull(users.deletedAt),
        // Not something they have already seen themselves.
        sql`not exists (
          select 1 from nitrate.user_movie_state mine
          where mine.user_id = ${userId} and mine.movie_id = ${movies.id} and mine.watched
        )`,
      ),
    )
    .groupBy(movies.id)
    .orderBy(desc(sql`count(distinct ${userMovieState.userId})`), desc(movies.providerPopularity))
    .limit(limit);

  return rows.map((row) => ({
    ...toFilmRef(row.movie),
    reason: { kind: 'friend_loved', names: row.names.slice(0, row.count) },
  }));
}

/** Their own watchlist, surfaced where they are already browsing for something. */
export async function getWatchlistRail(userId: string, limit = 12): Promise<RailFilm[]> {
  const rows = await db
    .select({ movie: movies })
    .from(userMovieState)
    .innerJoin(movies, eq(movies.id, userMovieState.movieId))
    .where(and(eq(userMovieState.userId, userId), eq(userMovieState.inWatchlist, true)))
    .orderBy(desc(userMovieState.watchlistedAt))
    .limit(limit);
  return rows.map((row) => ({ ...toFilmRef(row.movie), reason: { kind: 'on_watchlist' } }));
}

export type TasteRail = { seed: FilmRef; films: RailFilm[]; continuation: RailContinuation };

/**
 * "Because you loved X." One highly-rated film from the viewer's own history,
 * expanded through the provider's recommendations — explainable in the heading,
 * and no model to train.
 */
export async function getBecauseYouLoved(userId: string, limit = 12): Promise<TasteRail | null> {
  const [seedRow] = await db
    .select({ movie: movies })
    .from(userMovieState)
    .innerJoin(movies, eq(movies.id, userMovieState.movieId))
    .where(
      and(
        eq(userMovieState.userId, userId),
        eq(userMovieState.watched, true),
        gte(userMovieState.rating, 9),
      ),
    )
    // Rotates daily rather than per request, so the rail is stable within a session.
    .orderBy(sql`md5(${movies.id}::text || ${new Date().toISOString().slice(0, 10)})`)
    .limit(1);

  if (!seedRow) return null;

  const { data: detail } = await withProvider((p) => p.getMovie(seedRow.movie.providerId));
  const candidates = usable(detail?.similar ?? []);
  if (!candidates.length) return null;

  const refs = await filmRefsFromSummaries(candidates.slice(0, limit));
  const seen = await watchedMovieIds(
    userId,
    refs.map((ref) => ref.id),
  );

  return {
    seed: toFilmRef(seedRow.movie),
    continuation: { source: 'similar', providerId: seedRow.movie.providerId, nextPage: 2 },
    films: refs.filter((ref) => !seen.has(ref.id)).map((film) => ({
      ...film,
      reason: { kind: 'similar_to_film', title: seedRow.movie.title },
    })),
  };
}

async function watchedMovieIds(userId: string, movieIds: string[]): Promise<Set<string>> {
  if (!movieIds.length) return new Set();
  const rows = await db
    .select({ movieId: userMovieState.movieId })
    .from(userMovieState)
    .where(
      and(
        eq(userMovieState.userId, userId),
        eq(userMovieState.watched, true),
        inArray(userMovieState.movieId, movieIds),
      ),
    );
  return new Set(rows.map((row) => row.movieId));
}

/**
 * Highest rated *here*, by members rather than the wider world — weighted so a
 * lone five-star log cannot top the list. Returns nothing until there is enough
 * activity for the answer to mean something, which is the honest behaviour for
 * a young product.
 */
export async function getCommunityTopFilms(limit = 12): Promise<RailFilm[]> {
  const rows = await db
    .select({ movie: movies })
    .from(movies)
    .where(gte(movies.ratingCount, 3))
    .orderBy(
      desc(
        sql`(${movies.ratingSum}::float / nullif(${movies.ratingCount}, 0)) * (${movies.ratingCount}::float / (${movies.ratingCount} + ${COMMUNITY_RANKING.minimumVotes}))
            + ${COMMUNITY_RANKING.prior} * (${COMMUNITY_RANKING.minimumVotes}::float / (${movies.ratingCount} + ${COMMUNITY_RANKING.minimumVotes}))`,
      ),
      desc(movies.ratingCount),
    )
    .limit(limit);

  return rows.map((row) => ({
    ...toFilmRef(row.movie),
    reason: {
      kind: 'community_signal',
      label: `${(row.movie.ratingSum / row.movie.ratingCount / 2).toFixed(1)} from ${row.movie.ratingCount} ${
        row.movie.ratingCount === 1 ? 'member' : 'members'
      }`,
    },
  }));
}

/** Films in a genre the viewer keeps returning to, that they have not seen. */
export async function getFromYourFavouriteGenre(
  userId: string,
  limit = 12,
): Promise<{ genre: string; films: RailFilm[] } | null> {
  const [top] = await db
    .select({
      genreId: movieGenres.genreId,
      name: genresTable.name,
      count: sql<number>`count(*)::int`,
    })
    .from(userMovieState)
    .innerJoin(movieGenres, eq(movieGenres.movieId, userMovieState.movieId))
    .innerJoin(genresTable, eq(genresTable.id, movieGenres.genreId))
    .where(and(eq(userMovieState.userId, userId), eq(userMovieState.watched, true)))
    .groupBy(movieGenres.genreId, genresTable.name)
    .orderBy(desc(sql`count(*)`))
    .limit(1);

  if (!top || top.count < 3) return null;

  const rows = await db
    .select({ movie: movies })
    .from(movies)
    .innerJoin(movieGenres, eq(movieGenres.movieId, movies.id))
    .where(
      and(
        eq(movieGenres.genreId, top.genreId),
        eq(movies.adult, false),
        gte(movies.providerVoteCount, 200),
        sql`not exists (
          select 1 from nitrate.user_movie_state ums
          where ums.user_id = ${userId} and ums.movie_id = ${movies.id} and ums.watched
        )`,
      ),
    )
    .orderBy(desc(movies.providerVoteCount), desc(movies.providerPopularity))
    .limit(limit);

  if (rows.length < 4) return null;
  return {
    genre: top.name,
    films: rows.map((row) => ({
      ...toFilmRef(row.movie),
      reason: { kind: 'favourite_genre', genre: top.name },
    })),
  };
}

export type PopularReview = {
  id: string;
  reviewText: string;
  containsSpoilers: boolean;
  rating: number | null;
  liked: boolean;
  likeCount: number;
  film: FilmRef;
  author: { id: string; username: string; displayName: string; avatarAssetId: string | null };
};

export async function getPopularReviews(viewer: Viewer, limit = 6): Promise<PopularReview[]> {
  const rows = await db
    .select({ entry: diaryEntries, movie: movies, author: users })
    .from(diaryEntries)
    .innerJoin(movies, eq(movies.id, diaryEntries.movieId))
    .innerJoin(users, eq(users.id, diaryEntries.userId))
    .where(
      and(
        isNull(diaryEntries.deletedAt),
        isNull(users.deletedAt),
        sql`${diaryEntries.reviewText} is not null and length(trim(${diaryEntries.reviewText})) > 40`,
        viewableSql(sql`${diaryEntries.visibility}`, sql`${diaryEntries.userId}`, viewer),
      ),
    )
    .orderBy(desc(diaryEntries.likeCount), desc(diaryEntries.createdAt))
    .limit(limit);

  return rows.map(({ entry, movie, author }) => ({
    id: entry.id,
    reviewText: entry.reviewText ?? '',
    containsSpoilers: entry.containsSpoilers,
    rating: entry.rating,
    liked: entry.liked,
    likeCount: entry.likeCount,
    film: toFilmRef(movie),
    author: {
      id: author.id,
      username: author.username,
      displayName: author.displayName,
      avatarAssetId: author.avatarAssetId,
    },
  }));
}

export type BrowseParams = {
  genreId?: string;
  decade?: number;
  sort?: 'popularity' | 'rating' | 'release_date';
  page?: number;
};

export async function browseFilms(params: BrowseParams) {
  const sort = params.sort ?? 'popularity';
  const { data, degraded } = await withProvider((p) =>
    p.discover({
      genreId: params.genreId,
      decade: params.decade,
      sortBy: sort,
      page: params.page ?? 1,
      // "Highest rated" is a promise about quality, not about arithmetic.
      minVotes: sort === 'rating' ? 2000 : undefined,
    }),
  );

  const results = usable(data.results);
  const ordered =
    sort === 'rating'
      ? [...results].sort(
          (a, b) =>
            bayesianAverage({ average: b.voteAverage, count: b.voteCount, ...PROVIDER_RANKING }) -
            bayesianAverage({ average: a.voteAverage, count: a.voteCount, ...PROVIDER_RANKING }),
        )
      : results;

  return {
    films: await filmRefsFromSummaries(ordered),
    page: data.page,
    totalPages: data.totalPages,
    degraded,
  };
}

export async function getExploreRailPage(
  continuation: RailContinuation,
  excludedIds: Set<string> = new Set(),
): Promise<{
  films: RailFilm[];
  continuation?: RailContinuation;
  degraded: boolean;
}> {
  const page = Math.min(Math.max(continuation.nextPage, 1), EXPLORE_MAX_RAIL_PAGE);
  if (continuation.source === 'hidden-gems') {
    const rows = await db
      .select({ movie: movies })
      .from(movies)
      .where(and(
        eq(movies.adult, false),
        isNotNull(movies.posterPath),
        gte(movies.providerVoteAverage, 7.2),
        gte(movies.providerVoteCount, 200),
        lte(movies.providerPopularity, 40),
      ))
      .orderBy(desc(movies.providerVoteAverage), asc(movies.providerPopularity))
      .limit(20)
      .offset((page - 1) * 20);
    const films = rows.map(({ movie }) => toFilmRef(movie)).filter((film) => !excludedIds.has(film.id));
    return {
      films,
      continuation: rows.length === 20 && page < EXPLORE_MAX_RAIL_PAGE ? { ...continuation, nextPage: page + 1 } : undefined,
      degraded: false,
    };
  }
  const result = await withProvider((provider) => {
    switch (continuation.source) {
      case 'trending': return provider.trending('week', page);
      case 'popular': return provider.popular(page);
      case 'top-rated': return provider.topRated(page);
      case 'now-playing': return provider.nowPlaying(page);
      case 'upcoming': return provider.upcoming(page);
      case 'canon': return provider.discover({ sortBy: 'rating', minVotes: 3000, page });
      case 'genre': return provider.discover({ genreId: continuation.genreId, sortBy: 'popularity', page });
      case 'decade': return provider.discover({ decade: continuation.decade, sortBy: 'popularity', page });
      case 'similar': return provider.similar(continuation.providerId ?? '', page);
      case 'hidden-gems': return provider.discover({ sortBy: 'rating', minVotes: 200, page });
    }
  });
  const usableResults = usable(result.data.results).filter((movie) => !excludedIds.has(movie.providerId));
  const ingested = await ensureMoviesFromSummaries(usableResults);
  const films = ingested
    .map(toFilmRef)
    .filter((film) => !excludedIds.has(film.id));
  const maxPage = Math.min(result.data.totalPages, EXPLORE_MAX_RAIL_PAGE);
  const nextPage = page + 1;

  return {
    films,
    continuation: nextPage <= maxPage ? { ...continuation, nextPage } : undefined,
    degraded: result.degraded,
  };
}

function stableNumber(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(index)) | 0;
  }
  return hash >>> 0;
}

async function moduleFromRail(input: {
  id: string;
  title: string;
  subtitle: string;
  continuation: RailContinuation;
  excludedIds: Set<string>;
}): Promise<ExploreModule | null> {
  const page = await getExploreRailPage(input.continuation, input.excludedIds);
  if (page.films.length < 4) return null;
  page.films.forEach((film) => input.excludedIds.add(film.id));
  return {
    id: input.id,
    type: 'poster_rail',
    title: input.title,
    subtitle: input.subtitle,
    films: page.films,
    continuation: page.continuation,
    degraded: page.degraded,
  };
}

async function settleExploreModule(
  recipe: Omit<Parameters<typeof moduleFromRail>[0], 'excludedIds'>,
  excludedIds: Set<string>,
): Promise<ExploreModule | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const source = moduleFromRail({ ...recipe, excludedIds: new Set(excludedIds) }).catch((error) => {
      console.warn('[explore] one continuation source failed:', error instanceof Error ? error.message : error);
      return null;
    });
    const timedOut = new Promise<null>((resolve) => {
      timeout = setTimeout(() => {
        console.warn(`[explore] continuation source ${recipe.continuation.source} exceeded its time budget.`);
        resolve(null);
      }, 4_500);
    });
    return await Promise.race([source, timedOut]);
  } catch (error) {
    console.warn('[explore] one continuation source failed:', error instanceof Error ? error.message : error);
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/** A bounded sequence of useful modules, stable for a calendar day. */
export async function getExploreModuleBatch(input: {
  userId: string | null;
  cursor: ExploreCursor;
  excludedIds: string[];
}): Promise<{ modules: ExploreModule[]; cursor: ExploreCursor | null; degraded: boolean }> {
  const batch = Math.min(Math.max(Math.floor(input.cursor.batch), 0), EXPLORE_MAX_BATCHES);
  if (batch >= EXPLORE_MAX_BATCHES) return { modules: [], cursor: null, degraded: false };
  const excluded = new Set(input.excludedIds);
  const genres = await getGenres();
  const genre = genres.length ? genres[stableNumber(`${input.cursor.seed}:${batch}`) % genres.length] : null;
  const decade = [2020, 2010, 2000, 1990, 1980, 1970][stableNumber(`${input.cursor.seed}:decade:${batch}`) % 6];

  const recipes: Array<Array<Omit<Parameters<typeof moduleFromRail>[0], 'excludedIds'>>> = [
    [
      { id: 'continue-popular-2', title: 'Popular now', subtitle: 'More films people keep coming back to.', continuation: { source: 'popular', nextPage: 2 } },
      { id: 'continue-hidden-1', title: 'Hidden gems', subtitle: 'Strongly rated films beyond the usual front row.', continuation: { source: 'hidden-gems', nextPage: 1 } },
    ],
    [
      ...(genre ? [{ id: `continue-genre-${genre.providerId}`, title: `${genre.name} to discover`, subtitle: 'A deeper shelf from this genre.', continuation: { source: 'genre' as const, genreId: genre.providerId, nextPage: 1 } }] : []),
      { id: `continue-decade-${decade}`, title: `${decade}s spotlight`, subtitle: 'Another way into the decade.', continuation: { source: 'decade', decade, nextPage: 1 } },
    ],
    [
      { id: 'continue-top-rated-2', title: 'Acclaimed films', subtitle: 'Highly rated with enough votes to mean it.', continuation: { source: 'top-rated', nextPage: 2 } },
      { id: 'continue-trending-2', title: 'Still trending', subtitle: 'More of what is moving through film culture this week.', continuation: { source: 'trending', nextPage: 2 } },
    ],
    [
      { id: 'continue-now-playing-2', title: 'More in cinemas', subtitle: 'Current releases beyond the opening shelf.', continuation: { source: 'now-playing', nextPage: 2 } },
      { id: 'continue-upcoming-1', title: 'Further ahead', subtitle: 'Upcoming releases worth keeping nearby.', continuation: { source: 'upcoming', nextPage: 1 } },
    ],
    [
      ...(genre ? [{ id: `continue-genre-late-${genre.providerId}`, title: `More ${genre.name.toLowerCase()}`, subtitle: 'One last turn through a different corner of the genre.', continuation: { source: 'genre' as const, genreId: genre.providerId, nextPage: 2 } }] : []),
      { id: 'continue-popular-4', title: 'Keep exploring', subtitle: 'A final broad shelf from the wider catalogue.', continuation: { source: 'popular', nextPage: 4 } },
    ],
  ];

  const modules: ExploreModule[] = [];
  if (batch === 0 && input.userId) {
    const [personal, clubFilms, friendFilms] = await Promise.all([
      getFromYourFavouriteGenre(input.userId, 30),
      getPopularWithClubs(input.userId, 20),
      getFriendsWantToWatch(input.userId, 20),
    ]);
    const films = (personal?.films ?? []).filter((film) => !excluded.has(film.id));
    if (personal && films.length >= 4) {
      films.forEach((film) => excluded.add(film.id));
      modules.push({
        id: 'continue-favourite-genre',
        type: 'poster_rail',
        title: `More ${personal.genre.toLowerCase()} for you`,
        subtitle: 'Unseen films shaped by what you return to.',
        films,
        showReason: false,
      });
    } else {
      const socialSeen = new Set<string>();
      const socialFilms = [...clubFilms, ...friendFilms]
        .filter((film) => !excluded.has(film.id) && !socialSeen.has(film.id) && Boolean(socialSeen.add(film.id)))
        .slice(0, 30);
      if (socialFilms.length >= 4) {
        socialFilms.forEach((film) => excluded.add(film.id));
        modules.push({
          id: 'continue-circle',
          type: 'poster_rail',
          title: 'Around your circle',
          subtitle: 'Movie Ideas and watchlists from people close to you.',
          films: socialFilms,
        });
      }
    }
  }

  const settledModules = await Promise.all(
    recipes[batch].map((recipe) => settleExploreModule(recipe, excluded)),
  );
  for (const feedModule of settledModules) {
    if (!feedModule || feedModule.type !== 'poster_rail') continue;
    const films = feedModule.films.filter((film) => !excluded.has(film.id));
    if (films.length < 4) continue;
    films.forEach((film) => excluded.add(film.id));
    modules.push({ ...feedModule, films });
  }

  return {
    modules: modules.slice(0, 3),
    cursor: batch + 1 < EXPLORE_MAX_BATCHES ? { batch: batch + 1, seed: input.cursor.seed } : null,
    degraded: modules.some((feedModule) => feedModule.type === 'poster_rail' && feedModule.degraded),
  };
}
