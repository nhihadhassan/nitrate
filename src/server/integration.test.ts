import { randomUUID } from 'node:crypto';

import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { db } from '@/server/db';
import {
  blocks,
  clubs,
  diaryEntries,
  follows,
  movies,
  userMovieState,
  users,
  type Club,
  type Movie,
  type User,
} from '@/server/db/schema';
import {
  addToQueue,
  castVote,
  closeVoting,
  completeScreening,
  confirmAttendance,
  createClub,
  getClubIntelligence,
  getClubQueue,
  getClubRatings,
  getRoundNominations,
  joinClubByCode,
  nominate,
  openVoting,
  postDiscussion,
  requireMembership,
  scheduleScreening,
  setRsvp,
  startRound,
  submitClubRating,
  viewerHasSeenScreeningFilm,
} from '@/server/services/clubs';
import { getHomeFeed } from '@/server/services/feed';
import { logFilm, updateFilmState } from '@/server/services/films';
import { getDiary, getProfileStats } from '@/server/services/profile';
import { search } from '@/server/services/search';

/**
 * End-to-end checks against the real database.
 *
 * These cover the things unit tests cannot: multi-table transactions, unique
 * constraints, the club state machine as the server actually enforces it, and —
 * most importantly — that privacy filtering happens in SQL rather than in the UI.
 * Everything is namespaced and torn down at the end.
 */

const RUN = Boolean(process.env.DATABASE_URL);
const suite = RUN ? describe : describe.skip;

const tag = randomUUID().slice(0, 8);
const created: { userIds: string[]; movieIds: string[]; clubIds: string[] } = {
  userIds: [],
  movieIds: [],
  clubIds: [],
};

async function makeUser(name: string): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({
      email: `${name}-${tag}@nitrate.test`,
      username: `${name}_${tag}`,
      displayName: name,
      passwordHash: 'test',
    })
    .returning();
  created.userIds.push(user.id);
  return user;
}

async function makeMovie(title: string, year: number): Promise<Movie> {
  const [movie] = await db
    .insert(movies)
    .values({
      provider: 'test',
      providerId: `${title}-${tag}`,
      slug: `${title.toLowerCase().replace(/\W+/g, '-')}-${tag}`,
      title,
      year,
      runtime: 100,
    })
    .returning();
  created.movieIds.push(movie.id);
  return movie;
}

suite('nitrate integration', () => {
  let alex: User;
  let maya: User;
  let noor: User;
  let heat: Movie;
  let stalker: Movie;
  let club: Club;

  beforeAll(async () => {
    [alex, maya, noor] = await Promise.all([makeUser('alex'), makeUser('maya'), makeUser('noor')]);
    [heat, stalker] = await Promise.all([makeMovie('Heat', 1995), makeMovie('Stalker', 1979)]);
  }, 60_000);

  afterAll(async () => {
    for (const id of created.clubIds) await db.delete(clubs).where(eq(clubs.id, id));
    for (const id of created.userIds) await db.delete(users).where(eq(users.id, id));
    for (const id of created.movieIds) await db.delete(movies).where(eq(movies.id, id));
  }, 60_000);

  /* ---------------------------------------------------------------------- */
  /* Personal tracking                                                      */
  /* ---------------------------------------------------------------------- */

  it('logging a film updates diary, state and film aggregates together', async () => {
    await updateFilmState(alex.id, heat.id, { inWatchlist: true });

    const result = await logFilm({
      userId: alex.id,
      movieId: heat.id,
      watchedDate: '2024-03-01',
      rating: 8,
      liked: true,
      reviewText: 'Still the best shootout ever filmed.',
      containsSpoilers: false,
      visibility: 'public',
      tags: ['crime', 'rewatchable'],
    });

    expect(result.created).toBe(true);
    // Logging clears the watchlist and reports it, so the UI can offer an undo.
    expect(result.removedFromWatchlist).toBe(true);

    const [state] = await db
      .select()
      .from(userMovieState)
      .where(and(eq(userMovieState.userId, alex.id), eq(userMovieState.movieId, heat.id)));

    expect(state.watched).toBe(true);
    expect(state.rating).toBe(8);
    expect(state.liked).toBe(true);
    expect(state.inWatchlist).toBe(false);
    expect(state.logCount).toBe(1);

    const [film] = await db.select().from(movies).where(eq(movies.id, heat.id));
    expect(film.ratingCount).toBe(1);
    expect(film.ratingSum).toBe(8);
    expect(film.watchCount).toBe(1);
    expect(film.likeCount).toBe(1);
    expect(film.ratingHistogram['8']).toBe(1);
  });

  it('keeps historical ratings when a rewatch is rated differently', async () => {
    await logFilm({
      userId: alex.id,
      movieId: heat.id,
      watchedDate: '2025-06-14',
      rating: 10,
      liked: true,
      reviewText: null,
      containsSpoilers: false,
      visibility: 'public',
      tags: [],
    });

    const entries = await db
      .select()
      .from(diaryEntries)
      .where(and(eq(diaryEntries.userId, alex.id), eq(diaryEntries.movieId, heat.id)))
      .orderBy(diaryEntries.watchedDate);

    expect(entries).toHaveLength(2);
    // The old entry keeps the old opinion; only current state moves.
    expect(entries[0].rating).toBe(8);
    expect(entries[1].rating).toBe(10);
    expect(entries[1].isRewatch).toBe(true);

    const [state] = await db
      .select()
      .from(userMovieState)
      .where(and(eq(userMovieState.userId, alex.id), eq(userMovieState.movieId, heat.id)));
    expect(state.rating).toBe(10);
    expect(state.logCount).toBe(2);

    // One vote per person, not per viewing.
    const [film] = await db.select().from(movies).where(eq(movies.id, heat.id));
    expect(film.ratingCount).toBe(1);
    expect(film.ratingSum).toBe(10);
  });

  it('computes profile statistics from real data', async () => {
    const stats = await getProfileStats(alex.id);
    expect(stats.filmCount).toBe(1);
    expect(stats.diaryCount).toBe(2);
    expect(stats.rewatchCount).toBe(1);
    expect(stats.averageRating).toBe(10);
  });

  /* ---------------------------------------------------------------------- */
  /* Privacy                                                                */
  /* ---------------------------------------------------------------------- */

  it('never leaks a private diary entry to another viewer', async () => {
    await logFilm({
      userId: alex.id,
      movieId: stalker.id,
      watchedDate: '2025-01-02',
      rating: 9,
      liked: false,
      reviewText: 'Kept this one to myself.',
      containsSpoilers: false,
      visibility: 'private',
      tags: [],
    });

    const own = await getDiary(alex.id, { id: alex.id, role: 'member' });
    const stranger = await getDiary(alex.id, { id: maya.id, role: 'member' });
    const anonymous = await getDiary(alex.id, null);

    expect(own.some((row) => row.movie.id === stalker.id)).toBe(true);
    expect(stranger.some((row) => row.movie.id === stalker.id)).toBe(false);
    expect(anonymous.some((row) => row.movie.id === stalker.id)).toBe(false);
  });

  it('shows followers-only entries to followers and nobody else', async () => {
    await db.insert(follows).values({ followerId: maya.id, followingId: alex.id });
    await logFilm({
      userId: alex.id,
      movieId: stalker.id,
      watchedDate: '2025-02-02',
      rating: 9,
      liked: false,
      reviewText: 'For the followers.',
      containsSpoilers: false,
      visibility: 'followers',
      tags: [],
    });

    const follower = await getDiary(alex.id, { id: maya.id, role: 'member' });
    const nonFollower = await getDiary(alex.id, { id: noor.id, role: 'member' });

    expect(follower.some((row) => row.entry.visibility === 'followers')).toBe(true);
    expect(nonFollower.some((row) => row.entry.visibility === 'followers')).toBe(false);
  });

  it('hides blocked users from the feed in both directions', async () => {
    const before = await getHomeFeed({ id: maya.id, role: 'member' }, { scope: 'following' });
    expect(before.some((item) => item.actor.id === alex.id)).toBe(true);

    await db.insert(blocks).values({ blockerId: alex.id, blockedId: maya.id });

    const after = await getHomeFeed({ id: maya.id, role: 'member' }, { scope: 'following' });
    expect(after.some((item) => item.actor.id === alex.id)).toBe(false);

    await db
      .delete(blocks)
      .where(and(eq(blocks.blockerId, alex.id), eq(blocks.blockedId, maya.id)));
  });

  it('keeps private profiles out of search for strangers', async () => {
    await db.update(users).set({ profileVisibility: 'private' }).where(eq(users.id, noor.id));

    const asStranger = await search(`noor_${tag}`, { id: maya.id, role: 'member' });
    expect(asStranger.users.some((u) => u.id === noor.id)).toBe(false);

    const asSelf = await search(`noor_${tag}`, { id: noor.id, role: 'member' });
    expect(asSelf.users.some((u) => u.id === noor.id)).toBe(true);

    await db.update(users).set({ profileVisibility: 'public' }).where(eq(users.id, noor.id));
  }, 30_000);

  /* ---------------------------------------------------------------------- */
  /* Clubs                                                                  */
  /* ---------------------------------------------------------------------- */

  it('runs a full club cycle from nomination to permanent history', async () => {
    club = await createClub({
      ownerId: alex.id,
      name: `Test Club ${tag}`,
      description: 'Integration club',
      visibility: 'private',
      timezone: 'Europe/London',
      interests: ['Horror'],
      imageAssetId: null,
    });
    created.clubIds.push(club.id);

    // Join by the club's standing invite code, twice — the second is a no-op.
    await joinClubByCode(club.inviteCode, maya.id);
    const second = await joinClubByCode(club.inviteCode, maya.id);
    expect(second.alreadyMember).toBe(true);

    await joinClubByCode(club.inviteCode, noor.id);

    const [row] = await db.select().from(clubs).where(eq(clubs.id, club.id));
    expect(row.memberCount).toBe(3);

    // Queue carries group context.
    await addToQueue(club.id, maya.id, stalker.id, 'Long but worth it');
    await updateFilmState(noor.id, stalker.id, { inWatchlist: true });
    const queue = await getClubQueue(club.id);
    expect(queue).toHaveLength(1);
    expect(queue[0].onWatchlistCount).toBe(1);
    expect(queue[0].watchedByCount).toBe(1); // alex logged Stalker earlier

    // Nomination round.
    const round = await startRound({
      clubId: club.id,
      userId: alex.id,
      title: 'Round one',
      nominationLimitPerMember: 1,
      nominationsCloseAt: null,
      votingCloseAt: null,
    });
    expect(round.status).toBe('nominations_open');

    await nominate({ roundId: round.id, userId: alex.id, movieId: heat.id, pitch: 'Obviously' });
    await nominate({ roundId: round.id, userId: maya.id, movieId: stalker.id, pitch: 'Slow burn' });

    // A member cannot exceed their nomination allowance.
    const third = await makeMovie('Alien', 1979);
    await expect(
      nominate({ roundId: round.id, userId: alex.id, movieId: third.id, pitch: null }),
    ).rejects.toThrow(/nominations/i);

    // Duplicate nominations are rejected with an explanation.
    await expect(
      nominate({ roundId: round.id, userId: noor.id, movieId: heat.id, pitch: null }),
    ).rejects.toThrow(/already nominated/i);

    // Voting cannot be skipped: no votes before it opens.
    const nominationsBefore = await getRoundNominations(round.id, alex.id);
    expect(nominationsBefore.totalsVisible).toBe(false);
    await expect(
      castVote(round.id, alex.id, nominationsBefore.nominations[0].id),
    ).rejects.toThrow(/not open/i);

    await openVoting(round.id, alex.id);

    const nominationsOpen = await getRoundNominations(round.id, alex.id);
    const heatNomination = nominationsOpen.nominations.find((n) => n.movie.id === heat.id)!;
    const stalkerNomination = nominationsOpen.nominations.find((n) => n.movie.id === stalker.id)!;

    // Totals are hidden while voting is open — the client is never sent them.
    expect(nominationsOpen.totalsVisible).toBe(false);
    expect(heatNomination.voteCount).toBe(0);

    await castVote(round.id, alex.id, heatNomination.id);
    await castVote(round.id, maya.id, heatNomination.id);
    await castVote(round.id, noor.id, stalkerNomination.id);
    // Changing your mind moves the vote rather than adding one.
    await castVote(round.id, noor.id, heatNomination.id);
    await castVote(round.id, noor.id, stalkerNomination.id);

    const result = await closeVoting(round.id, alex.id);
    expect(result.winner?.movie.id).toBe(heat.id);
    expect(result.winner?.voteCount).toBe(2);

    const revealed = await getRoundNominations(round.id, alex.id);
    expect(revealed.totalsVisible).toBe(true);
    expect(revealed.nominations[0].voteCount).toBe(2);

    // Schedule, RSVP, complete.
    const screening = await scheduleScreening({
      clubId: club.id,
      userId: alex.id,
      movieId: heat.id,
      roundId: round.id,
      scheduledAt: new Date(Date.now() + 86_400_000),
      timezone: 'Europe/London',
      location: "Alex's flat",
      watchLink: null,
      notes: null,
    });

    await setRsvp(screening.id, maya.id, 'going');
    await setRsvp(screening.id, noor.id, 'cant');

    // A member cannot complete a screening; only admins can.
    await expect(completeScreening(screening.id, maya.id)).rejects.toThrow(/admin/i);

    await completeScreening(screening.id, alex.id);

    const [clubAfter] = await db.select().from(clubs).where(eq(clubs.id, club.id));
    expect(clubAfter.screeningCount).toBe(1);

    // Blind ratings: nothing is revealed until the viewer commits.
    await submitClubRating(screening.id, alex.id, 9);
    const beforeMayaRates = await getClubRatings(screening.id, maya.id);
    expect(beforeMayaRates.revealed).toBe(false);
    expect(beforeMayaRates.average).toBeNull();
    expect(beforeMayaRates.spread).toHaveLength(0);
    expect(beforeMayaRates.count).toBe(1);

    await submitClubRating(screening.id, maya.id, 7);
    const afterMayaRates = await getClubRatings(screening.id, maya.id);
    expect(afterMayaRates.revealed).toBe(true);
    expect(afterMayaRates.average).toBe(8);
    expect(afterMayaRates.spread).toHaveLength(2);

    // Discussion, with the spoiler gate keyed off having seen the film.
    await confirmAttendance(screening.id, maya.id, true);
    expect(await viewerHasSeenScreeningFilm(screening, maya.id)).toBe(true);
    expect(await viewerHasSeenScreeningFilm(screening, noor.id)).toBe(false);

    await postDiscussion({
      clubId: club.id,
      screeningId: screening.id,
      parentId: null,
      userId: maya.id,
      body: 'The diner scene still holds.',
      containsSpoilers: false,
    });

    const [{ value: posts }] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(diaryEntries)
      .where(eq(diaryEntries.userId, alex.id));
    expect(posts).toBeGreaterThan(0);
  }, 120_000);

  it('refuses club actions from non-members', async () => {
    const outsider = await makeUser('outsider');
    await expect(requireMembership(club.id, outsider.id)).rejects.toThrow(/not a member/i);
    await expect(addToQueue(club.id, outsider.id, heat.id, null)).rejects.toThrow(/not a member/i);
  }, 30_000);

  it('will not open a second round while one is live', async () => {
    await startRound({
      clubId: club.id,
      userId: alex.id,
      title: 'Round two',
      nominationLimitPerMember: 2,
      nominationsCloseAt: null,
      votingCloseAt: null,
    });

    await expect(
      startRound({
        clubId: club.id,
        userId: alex.id,
        title: 'Round three',
        nominationLimitPerMember: 1,
        nominationsCloseAt: null,
        votingCloseAt: null,
      }),
    ).rejects.toThrow(/already has a round/i);
  }, 30_000);

  it('produces explainable club suggestions', async () => {
    const intelligence = await getClubIntelligence(club.id);
    // Stalker is on noor's watchlist and in the queue.
    expect(
      intelligence.fromTheQueue.some((s) => s.movie.id === stalker.id),
    ).toBe(true);
  }, 30_000);

  /* ---------------------------------------------------------------------- */
  /* Import idempotency                                                     */
  /* ---------------------------------------------------------------------- */

  it('is safe to re-run an import', async () => {
    const externalKey = `letterboxd:${tag}-heat`;
    const payload = {
      userId: noor.id,
      movieId: heat.id,
      watchedDate: '2023-05-05',
      rating: 7,
      liked: false,
      reviewText: 'Imported once.',
      containsSpoilers: false,
      visibility: 'public' as const,
      tags: [],
      source: 'import' as const,
      externalKey,
    };

    const first = await logFilm(payload);
    const second = await logFilm(payload);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.entry.id).toBe(first.entry.id);

    const [{ value: count }] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(diaryEntries)
      .where(and(eq(diaryEntries.userId, noor.id), eq(diaryEntries.externalKey, externalKey)));
    expect(count).toBe(1);
  }, 30_000);
});
