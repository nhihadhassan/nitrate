import 'server-only';

import { PassThrough, Readable } from 'node:stream';
import archiver from 'archiver';
import { and, asc, count, eq, gt, isNull } from 'drizzle-orm';

import { csvRow, NITRATE_EXPORT_VERSION, toLetterboxdRating, type ExportManifestV1 } from '@/lib/export';
import { db } from '@/server/db';
import {
  attendances,
  clubMembers,
  clubQueueItems,
  clubRatings,
  diaryEntries,
  diaryEntryTags,
  favoriteFilms,
  listItems,
  lists,
  movies,
  nominations,
  ownershipCopies,
  tags,
  userMovieState,
  users,
  votes,
} from '@/server/db/schema';
import { NotFoundError } from '@/server/errors';

export const EXPORT_BATCH_SIZE = 250;

type ExportProfile = {
  id: string; email: string; username: string; displayName: string; bio: string | null;
  location: string | null; websiteUrl: string | null; pronouns: string | null;
  timezone: string; watchRegion: string | null; createdAt: Date;
};

type Page<T> = (cursor: string | null) => Promise<T[]>;

async function* cursorRows<T extends { id: string }>(page: Page<T>): AsyncGenerator<T> {
  let cursor: string | null = null;
  while (true) {
    const rows = await page(cursor);
    if (!rows.length) return;
    for (const row of rows) yield row;
    cursor = rows.at(-1)!.id;
    if (rows.length < EXPORT_BATCH_SIZE) return;
  }
}

function jsonArrayStream<T>(rows: AsyncIterable<T>): Readable {
  return Readable.from((async function* () {
    yield '[\n';
    let first = true;
    for await (const row of rows) {
      yield `${first ? '' : ',\n'}${JSON.stringify(row)}`;
      first = false;
    }
    yield '\n]\n';
  })());
}

function csvStream<T>(header: string[], rows: AsyncIterable<T>, map: (row: T) => unknown[]): Readable {
  return Readable.from((async function* () {
    yield csvRow(header);
    for await (const row of rows) yield csvRow(map(row));
  })());
}

async function profileFor(userId: string): Promise<ExportProfile> {
  const [profile] = await db.select({
    id: users.id, email: users.email, username: users.username, displayName: users.displayName,
    bio: users.bio, location: users.location, websiteUrl: users.websiteUrl, pronouns: users.pronouns,
    timezone: users.timezone, watchRegion: users.watchRegion, createdAt: users.createdAt,
  }).from(users).where(and(eq(users.id, userId), isNull(users.deletedAt))).limit(1);
  if (!profile) throw new NotFoundError('Account not found.');
  return profile;
}

function diaryRows(userId: string) {
  return cursorRows(async (cursor) => db.select({
    id: diaryEntries.id, watchedDate: diaryEntries.watchedDate, rating: diaryEntries.rating,
    liked: diaryEntries.liked, reviewText: diaryEntries.reviewText, containsSpoilers: diaryEntries.containsSpoilers,
    isRewatch: diaryEntries.isRewatch, visibility: diaryEntries.visibility, source: diaryEntries.source,
    viewingContext: diaryEntries.viewingContext, screeningId: diaryEntries.screeningId,
    movie: { id: movies.id, provider: movies.provider, providerId: movies.providerId, imdbId: movies.imdbId,
      title: movies.title, year: movies.year, runtime: movies.runtime },
  }).from(diaryEntries).innerJoin(movies, eq(movies.id, diaryEntries.movieId))
    .where(and(eq(diaryEntries.userId, userId), isNull(diaryEntries.deletedAt), cursor ? gt(diaryEntries.id, cursor) : undefined))
    .orderBy(asc(diaryEntries.id)).limit(EXPORT_BATCH_SIZE));
}

function stateRows(userId: string) {
  return cursorRows(async (cursor) => db.select({
    id: userMovieState.id, watched: userMovieState.watched, watchedAt: userMovieState.watchedAt,
    liked: userMovieState.liked, likedAt: userMovieState.likedAt, rating: userMovieState.rating,
    ratedAt: userMovieState.ratedAt, inWatchlist: userMovieState.inWatchlist,
    watchlistedAt: userMovieState.watchlistedAt, watchlistNote: userMovieState.note,
    movie: { id: movies.id, provider: movies.provider, providerId: movies.providerId, imdbId: movies.imdbId,
      title: movies.title, year: movies.year, runtime: movies.runtime },
  }).from(userMovieState).innerJoin(movies, eq(movies.id, userMovieState.movieId))
    .where(and(eq(userMovieState.userId, userId), cursor ? gt(userMovieState.id, cursor) : undefined))
    .orderBy(asc(userMovieState.id)).limit(EXPORT_BATCH_SIZE));
}

function ownershipRows(userId: string) {
  return cursorRows(async (cursor) => db.select({
    id: ownershipCopies.id, format: ownershipCopies.format, edition: ownershipCopies.edition,
    notes: ownershipCopies.notes, purchasedOn: ownershipCopies.purchasedOn, createdAt: ownershipCopies.createdAt,
    movie: { id: movies.id, provider: movies.provider, providerId: movies.providerId, imdbId: movies.imdbId,
      title: movies.title, year: movies.year, runtime: movies.runtime },
  }).from(ownershipCopies).innerJoin(movies, eq(movies.id, ownershipCopies.movieId))
    .where(and(eq(ownershipCopies.userId, userId), cursor ? gt(ownershipCopies.id, cursor) : undefined))
    .orderBy(asc(ownershipCopies.id)).limit(EXPORT_BATCH_SIZE));
}

function listRows(userId: string) {
  return cursorRows(async (cursor) => db.select({
    id: listItems.id, listId: lists.id, title: lists.title, description: lists.description,
    visibility: lists.visibility, ranked: lists.isRanked, position: listItems.position,
    note: listItems.note, createdAt: listItems.createdAt,
    movie: { id: movies.id, provider: movies.provider, providerId: movies.providerId, imdbId: movies.imdbId,
      title: movies.title, year: movies.year, runtime: movies.runtime },
  }).from(listItems).innerJoin(lists, eq(lists.id, listItems.listId)).innerJoin(movies, eq(movies.id, listItems.movieId))
    .where(and(eq(lists.userId, userId), isNull(lists.deletedAt), cursor ? gt(listItems.id, cursor) : undefined))
    .orderBy(asc(listItems.id)).limit(EXPORT_BATCH_SIZE));
}

async function simpleSections(userId: string) {
  const [favourites, entryTags, memberships, queue, nominationsByUser, userVotes, ratings, attendance] = await Promise.all([
    db.select({ position: favoriteFilms.position, movieId: favoriteFilms.movieId }).from(favoriteFilms).where(eq(favoriteFilms.userId, userId)).orderBy(asc(favoriteFilms.position)),
    db.select({ entryId: diaryEntryTags.diaryEntryId, name: tags.name }).from(diaryEntryTags).innerJoin(tags, eq(tags.id, diaryEntryTags.tagId)).innerJoin(diaryEntries, eq(diaryEntries.id, diaryEntryTags.diaryEntryId)).where(and(eq(diaryEntries.userId, userId), isNull(diaryEntries.deletedAt))),
    db.select({ id: clubMembers.id, clubId: clubMembers.clubId, role: clubMembers.role, status: clubMembers.status, joinedAt: clubMembers.joinedAt }).from(clubMembers).where(eq(clubMembers.userId, userId)),
    db.select({ id: clubQueueItems.id, clubId: clubQueueItems.clubId, movieId: clubQueueItems.movieId, note: clubQueueItems.note, createdAt: clubQueueItems.createdAt, removedAt: clubQueueItems.removedAt }).from(clubQueueItems).where(eq(clubQueueItems.addedByUserId, userId)),
    db.select({ id: nominations.id, roundId: nominations.roundId, movieId: nominations.movieId, pitch: nominations.pitch, createdAt: nominations.createdAt, withdrawnAt: nominations.withdrawnAt }).from(nominations).where(eq(nominations.nominatedByUserId, userId)),
    db.select({ id: votes.id, roundId: votes.roundId, nominationId: votes.nominationId, createdAt: votes.createdAt }).from(votes).where(eq(votes.userId, userId)),
    db.select({ id: clubRatings.id, screeningId: clubRatings.screeningId, rating: clubRatings.rating, createdAt: clubRatings.createdAt }).from(clubRatings).where(eq(clubRatings.userId, userId)),
    db.select({ id: attendances.id, screeningId: attendances.screeningId, rsvp: attendances.rsvp, attended: attendances.attended, respondedAt: attendances.respondedAt, confirmedAt: attendances.confirmedAt }).from(attendances).where(eq(attendances.userId, userId)),
  ]);
  return { favourites, entryTags, memberships, queue, nominations: nominationsByUser, votes: userVotes, ratings, attendance };
}

async function recordCount(table: 'diary' | 'state' | 'ownership' | 'lists', userId: string): Promise<number> {
  const query = table === 'diary'
    ? db.select({ value: count() }).from(diaryEntries).where(and(eq(diaryEntries.userId, userId), isNull(diaryEntries.deletedAt)))
    : table === 'state'
      ? db.select({ value: count() }).from(userMovieState).where(eq(userMovieState.userId, userId))
      : table === 'ownership'
        ? db.select({ value: count() }).from(ownershipCopies).where(eq(ownershipCopies.userId, userId))
        : db.select({ value: count() }).from(listItems).innerJoin(lists, eq(lists.id, listItems.listId)).where(and(eq(lists.userId, userId), isNull(lists.deletedAt)));
  const [row] = await query;
  return row?.value ?? 0;
}

export async function createAccountExport(userId: string): Promise<{ stream: PassThrough; filename: string }> {
  const [profile, simple, diaryCount, stateCount, ownershipCount, listCount] = await Promise.all([
    profileFor(userId), simpleSections(userId), recordCount('diary', userId), recordCount('state', userId),
    recordCount('ownership', userId), recordCount('lists', userId),
  ]);
  const output = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', (error) => output.destroy(error));
  archive.pipe(output);

  const generatedAt = new Date().toISOString();
  archive.append(JSON.stringify({ schemaVersion: NITRATE_EXPORT_VERSION, exportedAt: generatedAt, profile, sections: {
    favourites: simple.favourites, tags: simple.entryTags, clubMemberships: simple.memberships,
    clubContributions: { movieIdeas: simple.queue, nominations: simple.nominations, votes: simple.votes },
    clubRatings: simple.ratings, attendance: simple.attendance,
    streamedFiles: ['data/diary.json', 'data/film-state.json', 'data/lists.json', 'data/ownership.json'],
  } }, null, 2), { name: 'nitrate.json' });
  archive.append(jsonArrayStream(diaryRows(userId)), { name: 'data/diary.json' });
  archive.append(jsonArrayStream(stateRows(userId)), { name: 'data/film-state.json' });
  archive.append(jsonArrayStream(listRows(userId)), { name: 'data/lists.json' });
  archive.append(jsonArrayStream(ownershipRows(userId)), { name: 'data/ownership.json' });

  archive.append(csvStream(['Date', 'Name', 'Year', 'Rating', 'Liked', 'Rewatch', 'Review', 'Tags', 'Viewing Context'], diaryRows(userId), (row) => [row.watchedDate, row.movie.title, row.movie.year, row.rating === null ? '' : row.rating / 2, row.liked, row.isRewatch, row.reviewText, '', row.viewingContext]), { name: 'csv/diary.csv' });
  archive.append(csvStream(['Name', 'Year', 'Watched', 'Rating', 'Liked', 'Watchlist', 'Private Watchlist Note'], stateRows(userId), (row) => [row.movie.title, row.movie.year, row.watched, row.rating === null ? '' : row.rating / 2, row.liked, row.inWatchlist, row.watchlistNote]), { name: 'csv/films.csv' });
  archive.append(csvStream(['Name', 'Year', 'Format', 'Edition', 'Purchase Date', 'Notes'], ownershipRows(userId), (row) => [row.movie.title, row.movie.year, row.format, row.edition, row.purchasedOn, row.notes]), { name: 'csv/ownership.csv' });
  archive.append(csvStream(['Name', 'Year', 'Letterboxd URI', 'Rating', 'Watched Date', 'Rewatch', 'Tags', 'Review'], diaryRows(userId), (row) => [row.movie.title, row.movie.year, '', toLetterboxdRating(row.rating), row.watchedDate, row.isRewatch, '', row.reviewText]), { name: 'letterboxd/diary.csv' });
  archive.append(csvStream(['Name', 'Year', 'Letterboxd URI'], (async function* () { for await (const row of stateRows(userId)) if (row.inWatchlist) yield row; })(), (row) => [row.movie.title, row.movie.year, '']), { name: 'letterboxd/watchlist.csv' });

  const files: ExportManifestV1['files'] = [
    { path: 'nitrate.json', format: 'json', records: 1, description: 'Versioned profile and private account index.' },
    { path: 'data/diary.json', format: 'json', records: diaryCount, description: 'Complete personal diary, ratings, reviews and viewing context.' },
    { path: 'data/film-state.json', format: 'json', records: stateCount, description: 'Watched, ratings, favourites and watchlist state.' },
    { path: 'data/lists.json', format: 'json', records: listCount, description: 'Lists owned by the exporting member and their items.' },
    { path: 'data/ownership.json', format: 'json', records: ownershipCount, description: 'Private physical and digital ownership copies.' },
    { path: 'csv/diary.csv', format: 'csv', records: diaryCount, description: 'Human-readable diary.' },
    { path: 'csv/films.csv', format: 'csv', records: stateCount, description: 'Human-readable film library.' },
    { path: 'csv/ownership.csv', format: 'csv', records: ownershipCount, description: 'Human-readable ownership library.' },
    { path: 'letterboxd/diary.csv', format: 'csv', records: diaryCount, description: 'Letterboxd-compatible diary fields where concepts map safely.' },
  ];
  const manifest: ExportManifestV1 = { schemaVersion: NITRATE_EXPORT_VERSION, product: 'Nitrate', generatedAt,
    userId: profile.id, username: profile.username, files, privacy: { otherPeoplePrivateDataIncluded: false, clubDiscussionsIncluded: false },
    batching: { strategy: 'cursor', batchSize: EXPORT_BATCH_SIZE } };
  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
  void archive.finalize();
  return { stream: output, filename: `nitrate-${profile.username}-${generatedAt.slice(0, 10)}.zip` };
}
