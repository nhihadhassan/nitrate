import { NextResponse } from 'next/server';

import { clubHref, filmHref, listHref, personHref, userHref } from '@/lib/links';
import { getCurrentUser } from '@/server/auth/session';
import { consumeRateLimit } from '@/server/rate-limit';
import { search } from '@/server/services/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Backs the quick-search palette. Everything it returns is already a
 * destination — canonical film slugs included — so choosing a result navigates
 * straight there instead of bouncing through a resolver.
 *
 * Grouped rather than flattened: "is this a film or a person?" is the first
 * question a reader asks, and answering it in the markup beats guessing.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) {
    return NextResponse.json({ groups: [], degraded: false });
  }

  const user = await getCurrentUser();
  try {
    await consumeRateLimit('search', user?.id ?? 'anon');
  } catch {
    return NextResponse.json({ groups: [], degraded: false, rateLimited: true }, { status: 429 });
  }

  const viewer = user ? { id: user.id, role: user.role } : null;
  const results = await search(query, viewer, { limit: 5 });

  const groups = [
    {
      key: 'films',
      label: 'Films',
      items: results.films.slice(0, 6).map((film) => ({
        id: film.id,
        href: filmHref(film),
        title: film.title,
        subtitle: film.year ? String(film.year) : null,
        imagePath: film.posterPath,
        shape: 'poster' as const,
      })),
    },
    {
      key: 'members',
      label: 'Members',
      items: results.users.slice(0, 4).map((person) => ({
        id: person.id,
        href: userHref(person),
        title: person.displayName,
        subtitle: `@${person.username}`,
        imagePath: person.avatarAssetId ? `/media/${person.avatarAssetId}` : null,
        shape: 'avatar' as const,
      })),
    },
    {
      key: 'people',
      label: 'Cast & crew',
      items: results.people.slice(0, 4).map((person) => ({
        id: person.providerId,
        href: personHref(person),
        title: person.name,
        subtitle: person.knownForDepartment,
        imagePath: person.profilePath,
        shape: 'profile' as const,
      })),
    },
    {
      key: 'clubs',
      label: 'Clubs',
      items: results.clubs.slice(0, 3).map((club) => ({
        id: club.id,
        href: clubHref(club),
        title: club.name,
        subtitle: `${club.memberCount} ${club.memberCount === 1 ? 'member' : 'members'}`,
        imagePath: null,
        shape: 'none' as const,
      })),
    },
    {
      key: 'lists',
      label: 'Lists',
      items: results.lists.slice(0, 3).map((list) => ({
        id: list.id,
        href: listHref(list),
        title: list.title,
        subtitle: `${list.itemCount} films · ${list.ownerDisplayName}`,
        imagePath: null,
        shape: 'none' as const,
      })),
    },
  ].filter((group) => group.items.length > 0);

  return NextResponse.json(
    { groups, degraded: results.degraded },
    { headers: { 'cache-control': 'private, max-age=20' } },
  );
}
