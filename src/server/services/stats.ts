import 'server-only';

import { and, asc, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';

import type {
  ClubYearbook,
  PersonalRecap,
  PersonalStats,
  PosterStory,
  StatsScope,
  TasteComparison,
} from '@/lib/stats';
import { describeRatingShift, runtimeBandFor, tasteConfidenceForOverlap } from '@/lib/stats-logic';
import { db } from '@/server/db';
import {
  attendances,
  clubRatings,
  clubs,
  credits,
  diaryEntries,
  favoriteFilms,
  genres,
  movieGenres,
  movies,
  people,
  screenings,
  userMovieState,
  users,
} from '@/server/db/schema';
import { NotFoundError, PermissionError } from '@/server/errors';
import { getMembership } from '@/server/services/clubs';

function scopeWhere(scope: StatsScope): SQL | undefined {
  if (scope.kind === 'all-time') return undefined;
  if (scope.kind === 'month') {
    return sql`extract(year from ${diaryEntries.watchedDate}) = ${scope.year}
      and extract(month from ${diaryEntries.watchedDate}) = ${scope.month}`;
  }
  return sql`extract(year from ${diaryEntries.watchedDate}) = ${scope.year}`;
}

function scopeLabel(scope: StatsScope): string {
  if (scope.kind === 'all-time') return 'All time';
  if (scope.kind === 'month') {
    return new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(Date.UTC(scope.year, scope.month - 1, 1)),
    );
  }
  return String(scope.year);
}

function poster(row: {
  id: string;
  slug: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  watchedDate?: string;
  rating?: number | null;
}): PosterStory {
  return {
    movieId: row.id,
    slug: row.slug,
    title: row.title,
    year: row.year,
    posterPath: row.posterPath,
    watchedDate: row.watchedDate,
    rating: row.rating,
  };
}

export async function getPersonalStats(userId: string, scope: StatsScope): Promise<PersonalStats> {
  const scopeFilter = scopeWhere(scope);
  const entryFilter = and(eq(diaryEntries.userId, userId), isNull(diaryEntries.deletedAt), scopeFilter);

  const [entries, library, years, genreRows, peopleRows] = await Promise.all([
    db
      .select({
        id: movies.id,
        slug: movies.slug,
        title: movies.title,
        year: movies.year,
        posterPath: movies.posterPath,
        runtime: movies.runtime,
        language: movies.originalLanguage,
        communityRatingCount: movies.ratingCount,
        communityRatingSum: movies.ratingSum,
        watchedDate: diaryEntries.watchedDate,
        rating: diaryEntries.rating,
        rewatch: diaryEntries.isRewatch,
      })
      .from(diaryEntries)
      .innerJoin(movies, eq(movies.id, diaryEntries.movieId))
      .where(entryFilter)
      .orderBy(desc(diaryEntries.watchedDate), desc(diaryEntries.createdAt)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userMovieState)
      .where(and(eq(userMovieState.userId, userId), eq(userMovieState.watched, true))),
    db
      .select({ year: sql<number>`extract(year from ${diaryEntries.watchedDate})::int` })
      .from(diaryEntries)
      .where(and(eq(diaryEntries.userId, userId), isNull(diaryEntries.deletedAt)))
      .groupBy(sql`extract(year from ${diaryEntries.watchedDate})`)
      .orderBy(desc(sql`extract(year from ${diaryEntries.watchedDate})`)),
    db
      .select({ label: genres.name, count: sql<number>`count(*)::int` })
      .from(diaryEntries)
      .innerJoin(movieGenres, eq(movieGenres.movieId, diaryEntries.movieId))
      .innerJoin(genres, eq(genres.id, movieGenres.genreId))
      .where(entryFilter)
      .groupBy(genres.name)
      .orderBy(desc(sql`count(*)`))
      .limit(8),
    db
      .select({
        label: people.name,
        kind: credits.kind,
        job: credits.job,
        count: sql<number>`count(*)::int`,
      })
      .from(diaryEntries)
      .innerJoin(credits, eq(credits.movieId, diaryEntries.movieId))
      .innerJoin(people, eq(people.id, credits.personId))
      .where(
        and(
          entryFilter,
          sql`((${credits.kind} = 'crew' and ${credits.job} = 'Director') or (${credits.kind} = 'cast' and ${credits.sortOrder} < 8))`,
        ),
      )
      .groupBy(people.name, credits.kind, credits.job)
      .orderBy(desc(sql`count(*)`))
      .limit(24),
  ]);

  const unique = new Set(entries.map((entry) => entry.id));
  const ratings = entries.map((entry) => entry.rating).filter((value): value is number => value !== null);
  const ranked = (values: Array<string | number | null>, order?: string[]) => {
    const counts = new Map<string, number>();
    for (const value of values) {
      const key = value == null || value === '' ? 'Unknown' : String(value);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const result = [...counts].map(([label, count]) => ({ label, count }));
    return order
      ? result.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label))
      : result.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  };

  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = Array.from({ length: 12 }, (_, index) =>
    new Intl.DateTimeFormat('en-CA', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2020, index, 1))),
  );
  const difference = (entry: (typeof entries)[number]) => {
    if (entry.rating == null || entry.communityRatingCount < 3) return null;
    const community = entry.communityRatingSum / entry.communityRatingCount;
    return { ...poster(entry), difference: entry.rating - community, communityRating: community };
  };
  const outliers = entries
    .map(difference)
    .filter((value): value is NonNullable<ReturnType<typeof difference>> => Boolean(value))
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
    .slice(0, 8);

  const chronological = [...entries].sort((a, b) => a.watchedDate.localeCompare(b.watchedDate));
  const midpoint = Math.floor(chronological.length / 2);
  const firstHalf = chronological.slice(0, midpoint);
  const secondHalf = chronological.slice(midpoint);
  const halfAverage = (rows: typeof entries) => {
    const values = rows.map((row) => row.rating).filter((value): value is number => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  const firstAverage = halfAverage(firstHalf);
  const secondAverage = halfAverage(secondHalf);
  const tasteChanges: string[] = [];
  const ratingShift = describeRatingShift(firstAverage, secondAverage, entries.length);
  if (ratingShift) tasteChanges.push(ratingShift);
  if (entries.length >= 8 && entries.filter((entry) => entry.rewatch).length >= 2) {
    tasteChanges.push('Rewatches became a meaningful part of this period rather than an occasional return.');
  }
  if (!tasteChanges.length) tasteChanges.push('There is not enough contrast yet for a meaningful taste-change claim.');

  return {
    scope,
    scopeLabel: scopeLabel(scope),
    viewingCount: entries.length,
    uniqueFilms: unique.size,
    libraryTotal: library[0]?.count ?? 0,
    runtimeMinutes: entries.reduce((sum, entry) => sum + (entry.runtime ?? 0), 0),
    ratedCount: ratings.length,
    averageRating: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null,
    rewatches: entries.filter((entry) => entry.rewatch).length,
    newToYou: entries.filter((entry) => !entry.rewatch).length,
    latestViewings: entries.slice(0, 24).map(poster),
    topGenres: genreRows,
    topDirectors: peopleRows.filter((row) => row.kind === 'crew').slice(0, 8).map(({ label, count }) => ({ label, count })),
    topActors: peopleRows.filter((row) => row.kind === 'cast').slice(0, 8).map(({ label, count }) => ({ label, count })),
    decades: ranked(entries.map((entry) => entry.year == null ? null : `${Math.floor(entry.year / 10) * 10}s`)),
    languages: ranked(entries.map((entry) => entry.language?.toUpperCase() ?? null)),
    runtimeBands: ranked(entries.map((entry) => runtimeBandFor(entry.runtime)), ['Under 90 min', '90–120 min', '121–150 min', 'Over 150 min', 'Unknown']),
    activityByWeekday: ranked(entries.map((entry) => weekdays[new Date(`${entry.watchedDate}T12:00:00Z`).getUTCDay()]), weekdays),
    activityByMonth: ranked(entries.map((entry) => months[Number(entry.watchedDate.slice(5, 7)) - 1]), months),
    opinionOutliers: outliers,
    tasteChanges,
    availableYears: years.map((row) => row.year),
  };
}

export async function getDiaryAnniversaries(userId: string, today = new Date()) {
  const monthDay = today.toISOString().slice(5, 10);
  const currentYear = today.getUTCFullYear();
  const rows = await db
    .select({
      id: movies.id,
      slug: movies.slug,
      title: movies.title,
      year: movies.year,
      posterPath: movies.posterPath,
      watchedDate: diaryEntries.watchedDate,
      rating: diaryEntries.rating,
    })
    .from(diaryEntries)
    .innerJoin(movies, eq(movies.id, diaryEntries.movieId))
    .where(
      and(
        eq(diaryEntries.userId, userId),
        isNull(diaryEntries.deletedAt),
        sql`to_char(${diaryEntries.watchedDate}, 'MM-DD') = ${monthDay}`,
        sql`extract(year from ${diaryEntries.watchedDate}) < ${currentYear}`,
      ),
    )
    .orderBy(desc(diaryEntries.watchedDate))
    .limit(8);
  return rows.map((row) => ({
    ...poster(row),
    yearsAgo: currentYear - Number(row.watchedDate.slice(0, 4)),
  }));
}

export async function getPersonalRecap(userId: string, year: number): Promise<PersonalRecap> {
  const [owner] = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  if (!owner) throw new NotFoundError('That profile no longer exists.');
  const stats = await getPersonalStats(userId, { kind: 'year', year });
  const highestRated = [...stats.latestViewings]
    .filter((film) => film.rating != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 6);
  const [clubContribution] = await db.execute<{ screenings: number; picks: number; ratings: number }>(sql`
    select
      count(distinct a.screening_id) filter (where a.attended)::int as screenings,
      count(distinct n.id)::int as picks,
      count(distinct cr.id)::int as ratings
    from nitrate.users u
    left join nitrate.attendances a on a.user_id = u.id and a.attended
      and extract(year from a.created_at) = ${year}
    left join nitrate.nominations n on n.nominated_by_user_id = u.id
      and extract(year from n.created_at) = ${year}
    left join nitrate.club_ratings cr on cr.user_id = u.id
      and extract(year from cr.created_at) = ${year}
    where u.id = ${userId}
    group by u.id
  `);
  const currentYear = new Date().getFullYear();
  return {
    owner,
    year,
    title: year === currentYear ? `${year} so far` : `${owner.displayName} in ${year}`,
    sparse: stats.viewingCount < 5,
    stats,
    openingFilm: stats.latestViewings.length ? stats.latestViewings[stats.latestViewings.length - 1] : null,
    highestRated,
    collage: stats.latestViewings.slice(0, 18),
    clubContribution: {
      screenings: Number(clubContribution?.screenings ?? 0),
      picks: Number(clubContribution?.picks ?? 0),
      ratings: Number(clubContribution?.ratings ?? 0),
    },
    closingLine:
      stats.viewingCount === 0
        ? 'The year is still waiting for its first frame.'
        : stats.viewingCount < 5
          ? 'A small year on paper can still hold the film that stayed.'
          : `${stats.uniqueFilms} films, remembered as one year of your taste.`,
  };
}

export async function getTasteComparison(leftId: string, rightId: string): Promise<TasteComparison> {
  if (leftId === rightId) throw new PermissionError('Choose another person to compare with.');
  const profiles = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(users)
    .where(and(inArray(users.id, [leftId, rightId]), isNull(users.deletedAt)));
  const left = profiles.find((profile) => profile.id === leftId);
  const right = profiles.find((profile) => profile.id === rightId);
  if (!left || !right) throw new NotFoundError('One of those profiles no longer exists.');
  const states = await db
    .select({
      userId: userMovieState.userId,
      rating: userMovieState.rating,
      liked: userMovieState.liked,
      watched: userMovieState.watched,
      id: movies.id,
      slug: movies.slug,
      title: movies.title,
      year: movies.year,
      posterPath: movies.posterPath,
    })
    .from(userMovieState)
    .innerJoin(movies, eq(movies.id, userMovieState.movieId))
    .where(and(inArray(userMovieState.userId, [leftId, rightId]), eq(userMovieState.watched, true)));
  const byMovie = new Map<string, { film: PosterStory; left?: (typeof states)[number]; right?: (typeof states)[number] }>();
  for (const state of states) {
    const item = byMovie.get(state.id) ?? { film: poster(state) };
    if (state.userId === leftId) item.left = state;
    else item.right = state;
    byMovie.set(state.id, item);
  }
  const shared = [...byMovie.values()].filter((item) => item.left?.rating != null && item.right?.rating != null);
  const agreements = shared
    .filter((item) => Math.abs(item.left!.rating! - item.right!.rating!) <= 1)
    .sort((a, b) => Math.max(b.left!.rating!, b.right!.rating!) - Math.max(a.left!.rating!, a.right!.rating!))
    .slice(0, 8)
    .map((item) => ({ ...item.film, leftRating: item.left!.rating!, rightRating: item.right!.rating! }));
  const disagreements = shared
    .filter((item) => Math.abs(item.left!.rating! - item.right!.rating!) >= 4)
    .sort((a, b) => Math.abs(b.left!.rating! - b.right!.rating!) - Math.abs(a.left!.rating! - a.right!.rating!))
    .slice(0, 8)
    .map((item) => ({ ...item.film, leftRating: item.left!.rating!, rightRating: item.right!.rating! }));
  const favourites = await db
    .select({ userId: favoriteFilms.userId, movieId: favoriteFilms.movieId })
    .from(favoriteFilms)
    .where(inArray(favoriteFilms.userId, [leftId, rightId]));
  const leftFavs = new Set(favourites.filter((item) => item.userId === leftId).map((item) => item.movieId));
  const rightFavs = new Set(favourites.filter((item) => item.userId === rightId).map((item) => item.movieId));
  const confidence = tasteConfidenceForOverlap(shared.length);
  const recommend = (from: 'left' | 'right', to: 'left' | 'right') =>
    [...byMovie.values()]
      .filter((item) => {
        const source = item[from];
        return source && (source.liked || (source.rating ?? 0) >= 8) && !item[to];
      })
      .slice(0, 8)
      .map((item) => item.film);
  return {
    left,
    right,
    sharedRatingCount: shared.length,
    confidence,
    confidenceLabel:
      confidence === 'established'
        ? `Established comparison from ${shared.length} shared ratings`
        : confidence === 'emerging'
          ? `Emerging comparison from ${shared.length} shared ratings`
          : `Limited comparison from ${shared.length} shared ratings`,
    sharedFavourites: [...byMovie.values()].filter((item) => leftFavs.has(item.film.movieId) && rightFavs.has(item.film.movieId)).map((item) => item.film),
    agreements,
    disagreements,
    recommendationsForLeft: recommend('right', 'left'),
    recommendationsForRight: recommend('left', 'right'),
  };
}

export async function getClubYearbook(
  clubId: string,
  year: number | null,
  viewerId: string | null,
): Promise<ClubYearbook> {
  const [club] = await db.select().from(clubs).where(and(eq(clubs.id, clubId), isNull(clubs.deletedAt))).limit(1);
  if (!club) throw new NotFoundError('That club no longer exists.');
  const membership = await getMembership(clubId, viewerId);
  if (club.visibility === 'private' && membership?.status !== 'active') throw new PermissionError('This yearbook is private.');
  const rows = await db
    .select({ screening: screenings, movie: movies })
    .from(screenings)
    .innerJoin(movies, eq(movies.id, screenings.movieId))
    .where(
      and(
        eq(screenings.clubId, clubId),
        eq(screenings.status, 'completed'),
        year ? sql`extract(year from ${screenings.completedAt}) = ${year}` : undefined,
      ),
    )
    .orderBy(asc(screenings.completedAt));
  const screeningIds = rows.map((row) => row.screening.id);
  const [attendanceRows, ratingRows, genreRows, memberRows] = await Promise.all([
    screeningIds.length
      ? db.select({ screeningId: attendances.screeningId, count: sql<number>`count(*) filter (where ${attendances.attended})::int` }).from(attendances).where(inArray(attendances.screeningId, screeningIds)).groupBy(attendances.screeningId)
      : Promise.resolve([]),
    screeningIds.length
      ? db.select({ screeningId: clubRatings.screeningId, average: sql<number>`avg(${clubRatings.rating})::float`, viewerRated: sql<boolean>`bool_or(${clubRatings.userId} = ${viewerId})` }).from(clubRatings).where(inArray(clubRatings.screeningId, screeningIds)).groupBy(clubRatings.screeningId)
      : Promise.resolve([]),
    screeningIds.length
      ? db
          .select({ label: genres.name, count: sql<number>`count(*)::int` })
          .from(screenings)
          .innerJoin(movieGenres, eq(movieGenres.movieId, screenings.movieId))
          .innerJoin(genres, eq(genres.id, movieGenres.genreId))
          .where(inArray(screenings.id, screeningIds))
          .groupBy(genres.name)
          .orderBy(desc(sql`count(*)`))
          .limit(8)
      : Promise.resolve([]),
    db.execute<{ display_name: string; picks: number; attended: number }>(sql`
      select u.display_name,
        count(distinct n.id) filter (where nr.id is not null and ${year ? sql`extract(year from n.created_at) = ${year}` : sql`true`})::int as picks,
        count(distinct a.screening_id) filter (where a.attended and ${year ? sql`extract(year from s.completed_at) = ${year}` : sql`true`})::int as attended
      from nitrate.club_members cm
      join nitrate.users u on u.id = cm.user_id
      left join nitrate.nominations n on n.nominated_by_user_id = u.id
      left join nitrate.selection_rounds nr on nr.id = n.round_id and nr.club_id = cm.club_id
      left join nitrate.attendances a on a.user_id = u.id
      left join nitrate.screenings s on s.id = a.screening_id and s.club_id = cm.club_id
      where cm.club_id = ${clubId} and cm.status = 'active'
      group by u.display_name order by lower(u.display_name)
    `),
  ]);
  const attendance = new Map(attendanceRows.map((row) => [row.screeningId, row.count]));
  const ratings = new Map(ratingRows.map((row) => [row.screeningId, row]));
  const ratingsWithheld = club.blindRatingsEnabled && (!membership || membership.status !== 'active');
  return {
    club: { id: club.id, slug: club.slug, name: club.name, visibility: club.visibility },
    year,
    title: year ? `${club.name} in ${year}` : `${club.name}, all time`,
    screenings: rows.map(({ screening, movie }) => {
      const rating = ratings.get(screening.id);
      const canSee = !club.blindRatingsEnabled || Boolean(rating?.viewerRated);
      return {
        ...poster({ ...movie, watchedDate: screening.completedAt?.toISOString().slice(0, 10) }),
        screeningId: screening.id,
        attendeeCount: attendance.get(screening.id) ?? 0,
        groupRating: canSee ? rating?.average ?? null : null,
      };
    }),
    totalRuntimeMinutes: rows.reduce((sum, row) => sum + (row.movie.runtime ?? 0), 0),
    uniqueFilms: new Set(rows.map((row) => row.movie.id)).size,
    memberStories: memberRows.map((row) => ({ displayName: row.display_name, picks: Number(row.picks), attended: Number(row.attended) })),
    topGenres: genreRows.map((row) => ({ label: row.label, count: Number(row.count) })),
    collage: rows.slice(-18).reverse().map((row) => poster(row.movie)),
    ratingsWithheld,
  };
}
