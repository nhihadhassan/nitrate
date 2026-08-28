import 'server-only';

import { and, asc, eq, inArray } from 'drizzle-orm';

import { db } from '@/server/db';
import { movies, ownershipCopies, type OwnershipFormat } from '@/server/db/schema';
import { NotFoundError } from '@/server/errors';

export type OwnershipInput = {
  format: OwnershipFormat;
  edition?: string | null;
  notes?: string | null;
  purchasedOn?: string | null;
};

export async function getOwnershipForMovie(userId: string, movieId: string) {
  return db.select().from(ownershipCopies)
    .where(and(eq(ownershipCopies.userId, userId), eq(ownershipCopies.movieId, movieId)))
    .orderBy(asc(ownershipCopies.createdAt));
}

export async function getOwnershipMap(userId: string, movieIds: string[]) {
  if (!movieIds.length) return new Map<string, Array<typeof ownershipCopies.$inferSelect>>();
  const rows = await db.select().from(ownershipCopies)
    .where(and(eq(ownershipCopies.userId, userId), inArray(ownershipCopies.movieId, movieIds)));
  const result = new Map<string, Array<typeof ownershipCopies.$inferSelect>>();
  for (const row of rows) result.set(row.movieId, [...(result.get(row.movieId) ?? []), row]);
  return result;
}

export async function addOwnershipCopy(userId: string, movieId: string, input: OwnershipInput) {
  const [copy] = await db.insert(ownershipCopies).values({
    userId,
    movieId,
    format: input.format,
    edition: input.edition?.trim() || null,
    notes: input.notes?.trim() || null,
    purchasedOn: input.purchasedOn || null,
  }).returning();
  return copy;
}

export async function updateOwnershipCopy(userId: string, copyId: string, input: OwnershipInput) {
  const [copy] = await db.update(ownershipCopies).set({
    format: input.format,
    edition: input.edition?.trim() || null,
    notes: input.notes?.trim() || null,
    purchasedOn: input.purchasedOn || null,
    updatedAt: new Date(),
  }).where(and(eq(ownershipCopies.id, copyId), eq(ownershipCopies.userId, userId))).returning();
  if (!copy) throw new NotFoundError('That copy is no longer in your library.');
  return copy;
}

export async function removeOwnershipCopy(userId: string, copyId: string) {
  const [copy] = await db.delete(ownershipCopies)
    .where(and(eq(ownershipCopies.id, copyId), eq(ownershipCopies.userId, userId)))
    .returning({ id: ownershipCopies.id, movieId: ownershipCopies.movieId });
  if (!copy) throw new NotFoundError('That copy is no longer in your library.');
  return copy;
}

export async function searchOwnedMovies(userId: string) {
  return db.select({ copy: ownershipCopies, movie: movies }).from(ownershipCopies)
    .innerJoin(movies, eq(movies.id, ownershipCopies.movieId))
    .where(eq(ownershipCopies.userId, userId))
    .orderBy(asc(movies.title), asc(ownershipCopies.createdAt));
}
