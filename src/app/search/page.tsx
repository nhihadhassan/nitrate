import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { PosterCard, PosterGrid } from '@/components/film/poster';
import { RecommendationContext } from '@/components/discovery/recommendation-context';
import { SearchField } from '@/components/search/search-field';
import { Container, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { UserChip } from '@/components/user/avatar';
import { profileUrl } from '@/lib/images';
import { clubHref, listHref, personHref } from '@/lib/links';
import { cn, pluralize } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { search } from '@/server/services/search';
import { getMovieRecommendationContext } from '@/server/services/discovery';

export const metadata: Metadata = { title: 'Search' };
export const dynamic = 'force-dynamic';

const SCOPES = [
  { key: 'all', label: 'Everything' },
  { key: 'films', label: 'Films' },
  { key: 'people', label: 'Cast & crew' },
  { key: 'members', label: 'Members' },
  { key: 'lists', label: 'Lists' },
  { key: 'clubs', label: 'Clubs' },
] as const;

type Scope = (typeof SCOPES)[number]['key'];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q, type } = await searchParams;
  const query = (q ?? '').trim();
  const scope = (SCOPES.find((s) => s.key === type)?.key ?? 'all') as Scope;
  const user = await getCurrentUser();
  const viewer = user ? { id: user.id, role: user.role } : null;

  // A scoped search can afford a longer list; "everything" needs to stay skimmable.
  const results = query.length >= 2 ? await search(query, viewer, { limit: scope === 'all' ? 8 : 24 }) : null;
  const filmContext = user && results
    ? await getMovieRecommendationContext(user.id, results.films.map((film) => film.id))
    : new Map();

  const show = (section: Scope) => scope === 'all' || scope === section;
  const total = results
    ? results.films.length +
      results.people.length +
      results.users.length +
      results.lists.length +
      results.clubs.length
    : 0;

  return (
    <Container size="wide" className="py-8 pb-20">
      <h1 className="text-3xl sm:text-4xl">Search</h1>
      <div className="mt-4 max-w-xl">
        <SearchField initialQuery={query} scope={scope} />
      </div>

      {query.length >= 2 ? (
        <nav
          aria-label="Filter results"
          className="mobile-tabs -mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 text-xs sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          {SCOPES.map((option) => (
            <Link
              key={option.key}
              href={{ pathname: '/search', query: { q: query, ...(option.key === 'all' ? {} : { type: option.key }) } }}
              aria-current={scope === option.key ? 'true' : undefined}
              className={cn(
                'flex min-h-10 shrink-0 items-center rounded-md border px-3 transition-colors',
                scope === option.key
                  ? 'border-ember/40 bg-ember/10 text-ember'
                  : 'border-line text-muted hover:text-text',
              )}
            >
              {option.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {!results ? (
        <div className="mt-10">
          <EmptyState
            title="Find films, people, lists and clubs"
            description="Type at least two characters. Films and cast come from TMDB; members, lists and clubs are from here."
          />
        </div>
      ) : (
        <div className="mt-8 space-y-12">
          {results.degraded ? (
            <p className="rounded-md border border-amber/30 bg-amber/[0.07] px-3 py-2 text-xs text-amber">
              Film search is running on our local catalogue — the film database is unreachable.
            </p>
          ) : null}

          {show('films') && results.films.length ? (
            <section>
              <SectionHeading title="Films" subtitle={pluralize(results.films.length, 'result')} />
              <PosterGrid>
                {results.films.map((film) => (
                  <PosterCard
                    key={film.id}
                    film={film}
                    footer={<RecommendationContext reasons={filmContext.get(film.id) ?? []} />}
                  />
                ))}
              </PosterGrid>
            </section>
          ) : null}

          {show('members') && results.users.length ? (
            <section>
              <SectionHeading title="Members" />
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.users.map((person) => (
                  <li key={person.id} className="rounded-lg border border-line p-3">
                    <UserChip user={person} size="md" showUsername />
                    <p className="mt-2 text-xs text-dim">{pluralize(person.filmCount, 'film')}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {show('people') && results.people.length ? (
            <section>
              <SectionHeading title="Cast &amp; crew" />
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {results.people.map((person) => {
                  const photo = profileUrl(person.profilePath, 'sm');
                  return (
                    <li key={person.providerId}>
                      <Link
                        href={personHref(person)}
                        className="flex items-center gap-3 rounded-lg border border-line p-2 transition-colors hover:border-line-strong"
                      >
                        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-surface">
                          {photo ? (
                            <Image src={photo} alt="" fill sizes="48px" className="object-cover" />
                          ) : (
                            <span className="flex h-full items-center justify-center text-xs text-dim">
                              —
                            </span>
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{person.name}</span>
                          {person.knownForDepartment ? (
                            <span className="block truncate text-xs text-dim">
                              {person.knownForDepartment}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {show('lists') && results.lists.length ? (
            <section>
              <SectionHeading title="Lists" />
              <ul className="space-y-2">
                {results.lists.map((list) => (
                  <li key={list.id}>
                    <Link
                      href={listHref(list)}
                      className="flex items-baseline justify-between gap-3 rounded-md border border-line px-3 py-2 transition-colors hover:border-line-strong"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{list.title}</span>
                        <span className="text-xs text-dim">by {list.ownerDisplayName}</span>
                      </span>
                      <span className="shrink-0 text-xs text-dim tabular">
                        {pluralize(list.itemCount, 'film')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {show('clubs') && results.clubs.length ? (
            <section>
              <SectionHeading title="Clubs" />
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.clubs.map((club) => (
                  <li key={club.id}>
                    <Link
                      href={clubHref(club)}
                      className="block rounded-lg border border-line p-3 transition-colors hover:border-iris/40"
                    >
                      <p className="font-display text-lg leading-tight">{club.name}</p>
                      {club.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted">{club.description}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-dim">{pluralize(club.memberCount, 'member')}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {total === 0 ? (
            <EmptyState
              title={`Nothing matched “${query}”`}
              description="Try the original title, add a year, or check the spelling."
            />
          ) : null}
        </div>
      )}
    </Container>
  );
}
