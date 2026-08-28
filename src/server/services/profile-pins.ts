import 'server-only';

import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/server/db';
import { diaryEntries, lists, movies, profilePins } from '@/server/db/schema';
import { PermissionError, ValidationError } from '@/server/errors';
import { viewableSql, type Viewer } from '@/server/privacy';

type PinType = 'review' | 'list';

export async function setProfilePin(
  userId: string,
  targetType: PinType,
  targetId: string,
  pinned: boolean,
) {
  if (!pinned) {
    await db
      .delete(profilePins)
      .where(
        and(
          eq(profilePins.userId, userId),
          eq(profilePins.targetType, targetType),
          eq(profilePins.targetId, targetId),
        ),
      );
    return;
  }

  if (targetType === 'review') {
    const [row] = await db
      .select({ id: diaryEntries.id })
      .from(diaryEntries)
      .where(
        and(
          eq(diaryEntries.id, targetId),
          eq(diaryEntries.userId, userId),
          isNull(diaryEntries.deletedAt),
          sql`${diaryEntries.reviewText} is not null`,
          sql`${diaryEntries.visibility} <> 'private'`,
        ),
      )
      .limit(1);
    if (!row) throw new PermissionError('Only your visible reviews can be pinned.');
  } else {
    const [row] = await db
      .select({ id: lists.id })
      .from(lists)
      .where(
        and(
          eq(lists.id, targetId),
          eq(lists.userId, userId),
          isNull(lists.deletedAt),
          sql`${lists.visibility} <> 'private'`,
        ),
      )
      .limit(1);
    if (!row) throw new PermissionError('Only your visible lists can be pinned.');
  }

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(profilePins)
      .where(
        and(
          eq(profilePins.userId, userId),
          eq(profilePins.targetType, targetType),
          eq(profilePins.targetId, targetId),
        ),
      )
      .limit(1);
    if (existing) return;
    const [{ count, max }] = await tx
      .select({
        count: sql<number>`count(*)::int`,
        max: sql<number>`coalesce(max(${profilePins.position}), 0)::int`,
      })
      .from(profilePins)
      .where(eq(profilePins.userId, userId));
    if (count >= 6) throw new ValidationError('You can pin up to six reviews and lists.');
    await tx.insert(profilePins).values({ userId, targetType, targetId, position: max + 1 });
  });
}

export async function isProfilePinned(userId: string, targetType: PinType, targetId: string) {
  const [row] = await db
    .select({ id: profilePins.id })
    .from(profilePins)
    .where(
      and(
        eq(profilePins.userId, userId),
        eq(profilePins.targetType, targetType),
        eq(profilePins.targetId, targetId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function getProfilePins(userId: string, viewer: Viewer) {
  const pins = await db
    .select()
    .from(profilePins)
    .where(eq(profilePins.userId, userId))
    .orderBy(asc(profilePins.position));
  const result: Array<{
    id: string;
    type: PinType;
    position: number;
    title: string;
    href: string;
    subtitle: string | null;
  }> = [];
  for (const pin of pins) {
    if (pin.targetType === 'review') {
      const [row] = await db
        .select({ entry: diaryEntries, movie: movies })
        .from(diaryEntries)
        .innerJoin(movies, eq(movies.id, diaryEntries.movieId))
        .where(
          and(
            eq(diaryEntries.id, pin.targetId),
            isNull(diaryEntries.deletedAt),
            viewableSql(sql`${diaryEntries.visibility}`, sql`${diaryEntries.userId}`, viewer),
          ),
        )
        .limit(1);
      if (row) {
        result.push({
          id: pin.id,
          type: 'review',
          position: pin.position,
          title: row.movie.title,
          href: `/review/${row.entry.id}`,
          subtitle: row.entry.reviewText,
        });
      }
    } else {
      const [row] = await db
        .select()
        .from(lists)
        .where(
          and(
            eq(lists.id, pin.targetId),
            isNull(lists.deletedAt),
            viewableSql(sql`${lists.visibility}`, sql`${lists.userId}`, viewer),
          ),
        )
        .limit(1);
      if (row) {
        result.push({
          id: pin.id,
          type: 'list',
          position: pin.position,
          title: row.title,
          href: `/list/${row.id}`,
          subtitle: row.description,
        });
      }
    }
  }
  return result;
}
