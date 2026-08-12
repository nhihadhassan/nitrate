import 'server-only';

import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import type { FilmRef } from '@/lib/types';
import { db } from '@/server/db';
import { clubMembers, clubs, lists, movies, users } from '@/server/db/schema';
import { filmRefsFromSummaries } from '@/server/movies/catalog';
import { withProvider, type ProviderPerson } from '@/server/movies/provider';
import { viewableSql, type Viewer } from '@/server/privacy';

export type SearchResults = {
  /** Canonical local films — never provider ids, so every result links cleanly. */
  films: FilmRef[];
  people: ProviderPerson[];
  users: { id: string; username: string; displayName: string; avatarAssetId: string | null; filmCount: number }[];
  lists: {
    id: string;
    title: string;
    itemCount: number;
    ownerUsername: string;
    ownerDisplayName: string;
  }[];
  clubs: { id: string; name: string; slug: string; description: string | null; memberCount: number }[];
  degraded: boolean;
};

export type SearchOptions = {
  /** Cap per group. The palette wants a handful; the results page wants the page. */
  limit?: number;
};

/**
 * Global search. Films and people come from the provider (falling back to our
 * local catalogue if it is down); users, lists and clubs are local and privacy
 * filtered in SQL — a private list or club can never surface here.
 *
 * Film results are canonicalised on the way out, so picking one navigates
 * straight to a real page rather than through a redirect.
 */
export async function search(
  query: string,
  viewer: Viewer,
  options: SearchOptions = {},
): Promise<SearchResults> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { films: [], people: [], users: [], lists: [], clubs: [], degraded: false };
  }
  const limit = options.limit ?? 8;
  const term = `%${trimmed.toLowerCase()}%`;

  const [films, people, userRows, listRows, clubRows] = await Promise.all([
    withProvider((provider) => provider.searchMovies(trimmed, 1)),
    withProvider((provider) => provider.searchPeople(trimmed, 1)).catch(() => ({
      data: { results: [] as ProviderPerson[], page: 1, totalPages: 0, totalResults: 0 },
      degraded: true,
    })),

    db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarAssetId: users.avatarAssetId,
        filmCount: users.filmCount,
      })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          isNull(users.suspendedAt),
          sql`(lower(${users.username}) like ${term} or lower(${users.displayName}) like ${term})`,
          // Private profiles are not discoverable by strangers.
          viewer
            ? sql`(${users.profileVisibility} <> 'private' or ${users.id} = ${viewer.id})`
            : eq(users.profileVisibility, 'public'),
          viewer
            ? sql`not exists (
                select 1 from nitrate.blocks b
                where (b.blocker_id = ${viewer.id} and b.blocked_id = ${users.id})
                   or (b.blocker_id = ${users.id} and b.blocked_id = ${viewer.id})
              )`
            : undefined,
        ),
      )
      .orderBy(desc(users.filmCount))
      .limit(limit),

    db
      .select({
        id: lists.id,
        title: lists.title,
        itemCount: lists.itemCount,
        ownerUsername: users.username,
        ownerDisplayName: users.displayName,
      })
      .from(lists)
      .innerJoin(users, eq(users.id, lists.userId))
      .where(
        and(
          isNull(lists.deletedAt),
          isNull(users.deletedAt),
          sql`lower(${lists.title}) like ${term}`,
          viewableSql(sql`${lists.visibility}`, sql`${lists.userId}`, viewer),
        ),
      )
      .orderBy(desc(lists.likeCount))
      .limit(limit),

    db
      .select({
        id: clubs.id,
        name: clubs.name,
        slug: clubs.slug,
        description: clubs.description,
        memberCount: clubs.memberCount,
      })
      .from(clubs)
      .where(
        and(
          isNull(clubs.deletedAt),
          sql`lower(${clubs.name}) like ${term}`,
          // Public clubs, plus private ones the viewer already belongs to.
          viewer
            ? sql`(${clubs.visibility} = 'public' or exists (
                select 1 from ${clubMembers} cm
                where cm.club_id = ${clubs.id} and cm.user_id = ${viewer.id} and cm.status = 'active'
              ))`
            : eq(clubs.visibility, 'public'),
        ),
      )
      .orderBy(desc(clubs.memberCount))
      .limit(limit),
  ]);

  return {
    films: await filmRefsFromSummaries(
      films.data.results.filter((f) => !f.adult).slice(0, limit * 2),
    ),
    people: people.data.results.slice(0, limit),
    users: userRows,
    lists: listRows,
    clubs: clubRows,
    degraded: films.degraded,
  };
}

/** Local-catalogue lookup used by film browse pages that filter on our own data. */
export async function findLocalMovies(term: string, limit = 20) {
  const like = `%${term.trim().toLowerCase()}%`;
  return db
    .select()
    .from(movies)
    .where(sql`lower(${movies.title}) like ${like}`)
    .orderBy(desc(movies.watchCount), desc(movies.providerPopularity))
    .limit(limit);
}
