import type { MetadataRoute } from 'next';
import { and, desc, eq, gte, isNotNull, isNull, or } from 'drizzle-orm';

import { env } from '@/env';
import { db } from '@/server/db';
import { clubs, diaryEntries, lists, movies, users } from '@/server/db/schema';

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: '/', changeFrequency: 'daily', priority: 1 },
  { url: '/explore', changeFrequency: 'daily', priority: 0.9 },
  { url: '/films', changeFrequency: 'daily', priority: 0.8 },
  { url: '/clubs', changeFrequency: 'weekly', priority: 0.7 },
  { url: '/import', changeFrequency: 'monthly', priority: 0.5 },
  { url: '/guidelines', changeFrequency: 'monthly', priority: 0.3 },
  { url: '/privacy', changeFrequency: 'monthly', priority: 0.3 },
  { url: '/terms', changeFrequency: 'monthly', priority: 0.3 },
];

function absolute(path: string): string {
  return new URL(path, env.siteUrl).toString();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = STATIC_ROUTES.map((route) => ({ ...route, url: absolute(route.url) }));

  try {
    const [filmRows, profileRows, listRows, reviewRows, clubRows] = await Promise.all([
      db
        .select({ slug: movies.slug, updatedAt: movies.updatedAt })
        .from(movies)
        .where(
          and(
            eq(movies.adult, false),
            or(gte(movies.providerVoteCount, 100), gte(movies.watchCount, 1)),
          ),
        )
        .orderBy(desc(movies.updatedAt))
        .limit(10_000),
      db
        .select({ username: users.username, updatedAt: users.updatedAt })
        .from(users)
        .where(
          and(
            eq(users.profileVisibility, 'public'),
            isNull(users.deletedAt),
            isNull(users.suspendedAt),
            gte(users.filmCount, 1),
          ),
        )
        .orderBy(desc(users.updatedAt))
        .limit(5_000),
      db
        .select({ id: lists.id, updatedAt: lists.updatedAt })
        .from(lists)
        .where(
          and(eq(lists.visibility, 'public'), isNull(lists.deletedAt), gte(lists.itemCount, 1)),
        )
        .orderBy(desc(lists.updatedAt))
        .limit(5_000),
      db
        .select({ id: diaryEntries.id, updatedAt: diaryEntries.updatedAt })
        .from(diaryEntries)
        .innerJoin(users, eq(users.id, diaryEntries.userId))
        .where(
          and(
            eq(diaryEntries.visibility, 'public'),
            isNotNull(diaryEntries.reviewText),
            isNull(diaryEntries.deletedAt),
            isNull(users.deletedAt),
            isNull(users.suspendedAt),
          ),
        )
        .orderBy(desc(diaryEntries.updatedAt))
        .limit(5_000),
      db
        .select({ slug: clubs.slug, updatedAt: clubs.updatedAt })
        .from(clubs)
        .where(
          and(eq(clubs.visibility, 'public'), isNull(clubs.deletedAt), gte(clubs.memberCount, 2)),
        )
        .orderBy(desc(clubs.updatedAt))
        .limit(2_000),
    ]);

    return [
      ...staticRoutes,
      ...filmRows.map((row) => ({
        url: absolute(`/film/${encodeURIComponent(row.slug)}`),
        lastModified: row.updatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      })),
      ...profileRows.map((row) => ({
        url: absolute(`/@${encodeURIComponent(row.username)}`),
        lastModified: row.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      })),
      ...listRows.map((row) => ({
        url: absolute(`/list/${row.id}`),
        lastModified: row.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      })),
      ...reviewRows.map((row) => ({
        url: absolute(`/review/${row.id}`),
        lastModified: row.updatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.4,
      })),
      ...clubRows.map((row) => ({
        url: absolute(`/club/${encodeURIComponent(row.slug)}`),
        lastModified: row.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      })),
    ];
  } catch (error) {
    console.error('[sitemap] dynamic public routes unavailable', error);
    return staticRoutes;
  }
}
