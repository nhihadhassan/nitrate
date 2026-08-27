import 'server-only';

import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';

import {
  AUTO_UNLOCK_DAYS,
  NETWORK_SURFACES,
  consecutiveEligibleDays,
  surfaceAvailable,
  surfaceEligible,
  type NetworkMetrics,
  type NetworkSurface,
  type ProductFlagMode,
} from '@/lib/network';
import { db } from '@/server/db';
import {
  blocks,
  clubs,
  diaryEntries,
  listItems,
  lists,
  moderationActions,
  movies,
  networkEligibilityDaily,
  productFlags,
  screenings,
  users,
} from '@/server/db/schema';
import { PermissionError } from '@/server/errors';
import { getPeopleRecommendations } from '@/server/services/discovery';

const DAY_MS = 86_400_000;

export async function collectNetworkMetrics(): Promise<NetworkMetrics> {
  const [profileRows, listRows, clubRows, activityRows] = await Promise.all([
    db.execute<{ eligible: number }>(sql`
      select count(*)::int as eligible from (
        select u.id from nitrate.users u
        join nitrate.user_movie_state ums on ums.user_id = u.id and ums.rating is not null
        where u.profile_visibility = 'public' and u.deleted_at is null and u.suspended_at is null
        group by u.id having count(*) >= 15
      ) eligible_profiles
    `),
    db.execute<{ lists: number; creators: number }>(sql`
      select count(*)::int as lists, count(distinct user_id)::int as creators from (
        select l.id, l.user_id from nitrate.lists l
        join nitrate.list_items li on li.list_id = l.id
        join nitrate.users u on u.id = l.user_id
        where l.visibility = 'public' and l.deleted_at is null and u.deleted_at is null and u.suspended_at is null
        group by l.id, l.user_id having count(li.id) >= 10
      ) substantial
    `),
    db.execute<{ clubs: number }>(sql`
      select count(*)::int as clubs from (
        select c.id from nitrate.clubs c
        join nitrate.club_members cm on cm.club_id = c.id and cm.status = 'active'
        join nitrate.screenings s on s.club_id = c.id and s.status = 'completed' and s.completed_at >= now() - interval '180 days'
        where c.visibility = 'public' and c.deleted_at is null
        group by c.id having count(distinct cm.user_id) >= 3 and count(distinct s.id) >= 2
      ) active_public_clubs
    `),
    db.execute<{ mau: number; contributions: number; contributors: number }>(sql`
      with active as (
        select distinct user_id from nitrate.analytics_events
        where user_id is not null and created_at >= now() - interval '30 days'
      ), public_contributions as (
        select user_id, id::text as item from nitrate.diary_entries
        where visibility = 'public' and deleted_at is null and created_at >= now() - interval '90 days'
        union all
        select ums.user_id, ums.id::text as item from nitrate.user_movie_state ums
        join nitrate.users u on u.id = ums.user_id
        where ums.rating is not null and ums.rated_at >= now() - interval '90 days'
          and u.profile_visibility = 'public' and u.deleted_at is null and u.suspended_at is null
      )
      select (select count(*) from active)::int as mau,
             count(*)::int as contributions,
             count(distinct user_id)::int as contributors
      from public_contributions
    `),
  ]);
  return {
    eligiblePublicProfiles: profileRows[0]?.eligible ?? 0,
    substantialPublicLists: listRows[0]?.lists ?? 0,
    substantialListCreators: listRows[0]?.creators ?? 0,
    activePublicClubs: clubRows[0]?.clubs ?? 0,
    monthlyActiveUsers: activityRows[0]?.mau ?? 0,
    publicContributions90d: activityRows[0]?.contributions ?? 0,
    publicContributors90d: activityRows[0]?.contributors ?? 0,
  };
}

export async function evaluateNetworkEligibility(now = new Date()) {
  const metrics = await collectNetworkMetrics();
  const today = now.toISOString().slice(0, 10);
  const since = new Date(now.getTime() - 6 * DAY_MS).toISOString().slice(0, 10);
  const decisions = [];
  for (const surface of NETWORK_SURFACES) {
    const eligible = surfaceEligible(surface, metrics);
    await db.insert(networkEligibilityDaily).values({ surface, day: today, eligible, metrics })
      .onConflictDoUpdate({ target: [networkEligibilityDaily.surface, networkEligibilityDaily.day], set: { eligible, metrics, createdAt: now } });
    await db.insert(productFlags).values({ key: surface, metrics, evaluatedAt: now }).onConflictDoNothing();
    const [flag] = await db.select().from(productFlags).where(eq(productFlags.key, surface)).limit(1);
    const days = await db.select({ day: networkEligibilityDaily.day, eligible: networkEligibilityDaily.eligible })
      .from(networkEligibilityDaily).where(and(eq(networkEligibilityDaily.surface, surface), gte(networkEligibilityDaily.day, since)))
      .orderBy(desc(networkEligibilityDaily.day));
    const streak = consecutiveEligibleDays(days, today);
    const unlock = flag.mode === 'auto' && !flag.unlockedAt && streak >= AUTO_UNLOCK_DAYS;
    await db.update(productFlags).set({
      metrics, evaluatedAt: now, updatedAt: now,
      eligibleSince: eligible ? (flag.eligibleSince ?? today) : null,
      unlockedAt: unlock ? now : flag.unlockedAt,
    }).where(eq(productFlags.key, surface));
    decisions.push({ surface, eligible, streak, available: surfaceAvailable({ mode: flag.mode, unlockedAt: unlock ? now : flag.unlockedAt, consecutiveEligibleDays: streak }) });
  }
  return { metrics, decisions };
}

export async function setNetworkFlagMode(
  surface: NetworkSurface,
  mode: ProductFlagMode,
  adminUserId: string,
) {
  return db.transaction(async (tx) => {
    const [flag] = await tx
      .insert(productFlags)
      .values({ key: surface, mode, updatedByUserId: adminUserId })
      .onConflictDoUpdate({
        target: productFlags.key,
        set: { mode, updatedByUserId: adminUserId, updatedAt: new Date() },
      })
      .returning();
    await tx.insert(moderationActions).values({
      actorUserId: adminUserId,
      action: 'set_network_flag',
      subjectType: 'user',
      subjectId: adminUserId,
      metadata: { surface, mode },
    });
    return flag;
  });
}

export async function getNetworkStatuses() {
  const flags = await db.select().from(productFlags).where(inArray(productFlags.key, [...NETWORK_SURFACES]));
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 6 * DAY_MS).toISOString().slice(0, 10);
  const history = await db.select().from(networkEligibilityDaily).where(gte(networkEligibilityDaily.day, since)).orderBy(desc(networkEligibilityDaily.day));
  return NETWORK_SURFACES.map((surface) => {
    const flag = flags.find((row) => row.key === surface) ?? { key: surface, mode: 'auto' as const, unlockedAt: null, eligibleSince: null, evaluatedAt: null, metrics: {}, updatedByUserId: null, updatedAt: new Date() };
    const streak = consecutiveEligibleDays(history.filter((row) => row.surface === surface), today);
    return { ...flag, streak, available: surfaceAvailable({ mode: flag.mode, unlockedAt: flag.unlockedAt, consecutiveEligibleDays: streak }), eligibleToday: history.some((row) => row.surface === surface && row.day === today && row.eligible) };
  });
}

export async function requireNetworkSurface(surface: NetworkSurface) {
  const status = (await getNetworkStatuses()).find((row) => row.key === surface)!;
  if (!status.available) throw new PermissionError('This Network surface is still evidence-gated.');
  return status;
}

export async function getNetworkPeople(viewerId: string) {
  await requireNetworkSurface('people');
  return getPeopleRecommendations(viewerId, 40, { includeTaste: true });
}

export async function getCommunityLists(viewerId: string | null, limit = 48) {
  await requireNetworkSurface('community_lists');
  return db.select({ list: lists, owner: { username: users.username, displayName: users.displayName }, itemCount: sql<number>`count(${listItems.id})::int` })
    .from(lists).innerJoin(users, eq(users.id, lists.userId)).innerJoin(listItems, eq(listItems.listId, lists.id))
    .where(and(eq(lists.visibility, 'public'), isNull(lists.deletedAt), isNull(users.deletedAt), isNull(users.suspendedAt), viewerId ? sql`not exists (select 1 from ${blocks} b where (b.blocker_id = ${viewerId} and b.blocked_id = ${users.id}) or (b.blocker_id = ${users.id} and b.blocked_id = ${viewerId}))` : undefined))
    .groupBy(lists.id, users.username, users.displayName).having(sql`count(${listItems.id}) >= 10`)
    .orderBy(desc(lists.likeCount), desc(lists.updatedAt)).limit(limit);
}

export async function getPublicClubDiscovery(viewerId: string | null, limit = 40) {
  await requireNetworkSurface('public_clubs');
  return db.select({ club: clubs, recentScreenings: sql<number>`count(distinct ${screenings.id})::int` })
    .from(clubs).innerJoin(screenings, and(eq(screenings.clubId, clubs.id), eq(screenings.status, 'completed'), gte(screenings.completedAt, new Date(Date.now() - 180 * DAY_MS))))
    .innerJoin(users, eq(users.id, clubs.ownerId))
    .where(and(eq(clubs.visibility, 'public'), isNull(clubs.deletedAt), isNull(users.suspendedAt), viewerId ? sql`not exists (select 1 from ${blocks} b where (b.blocker_id = ${viewerId} and b.blocked_id = ${users.id}) or (b.blocker_id = ${users.id} and b.blocked_id = ${viewerId}))` : undefined))
    .groupBy(clubs.id).having(sql`count(distinct ${screenings.id}) >= 2 and ${clubs.memberCount} >= 3`)
    .orderBy(desc(clubs.memberCount), desc(sql`count(distinct ${screenings.id})`)).limit(limit);
}

export async function getCommunityTrends() {
  await requireNetworkSurface('community_trends');
  const rows = await db.select({ movie: movies, logs: sql<number>`count(${diaryEntries.id})::int`, contributors: sql<number>`count(distinct ${diaryEntries.userId})::int`, average: sql<number>`avg(${diaryEntries.rating})::float` })
    .from(movies).innerJoin(diaryEntries, eq(diaryEntries.movieId, movies.id))
    .innerJoin(users, eq(users.id, diaryEntries.userId))
    .where(and(eq(diaryEntries.visibility,'public'),isNull(diaryEntries.deletedAt),gte(diaryEntries.createdAt,new Date(Date.now()-90*DAY_MS)),eq(users.profileVisibility,'public'),isNull(users.deletedAt),isNull(users.suspendedAt)))
    .groupBy(movies.id).having(sql`count(distinct ${diaryEntries.userId}) >= 3`)
    .orderBy(desc(sql`count(${movies.id})`)).limit(24);
  return { windowDays: 90 as const, minimumContributorsPerFilm: 3 as const, rows };
}
