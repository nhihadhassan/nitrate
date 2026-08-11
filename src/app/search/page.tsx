import type { Metadata } from 'next';
import Link from 'next/link';

import { SearchField } from '@/components/search/search-field';
import { PosterCard, PosterGrid } from '@/components/film/poster';
import { Container, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { UserChip } from '@/components/user/avatar';
import { pluralize } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { search } from '@/server/services/search';

export const metadata: Metadata = { title: 'Search' };
export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const user = await getCurrentUser();
  const viewer = user ? { id: user.id, role: user.role } : null;

  const results = query.length >= 2 ? await search(query, viewer) : null;

  return (
    <Container size="wide" className="py-8">
      <h1 className="text-3xl sm:text-4xl">Search</h1>
      <div className="mt-4 max-w-xl">
        <SearchField initialQuery={query} />
      </div>

      {!results ? (
        <div className="mt-10">
          <EmptyState
            title="Find films, people, lists and clubs"
            description="Type at least two characters. Film results come from TMDB; everything else is from Nitrate."
          />
        </div>
      ) : (
        <div className="mt-10 space-y-12">
          {results.degraded ? (
            <p className="rounded-md border border-amber/30 bg-amber/[0.07] px-3 py-2 text-xs text-amber">
              Film search is running on our local catalogue — the film database is unreachable.
            </p>
          ) : null}

          {results.films.length ? (
            <section>
              <SectionHeading title="Films" subtitle={`${results.films.length} results`} />
              <PosterGrid>
                {results.films.map((film) => (
                  <PosterCard
                    key={film.providerId}
                    film={{
                      slug: film.providerId,
                      title: film.title,
                      year: film.year,
                      posterPath: film.posterPath,
                    }}
                  />
                ))}
              </PosterGrid>
            </section>
          ) : null}

          {results.users.length ? (
            <section>
              <SectionHeading title="People on Nitrate" />
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

          {results.people.length ? (
            <section>
              <SectionHeading title="Cast & crew" />
              <ul className="flex flex-wrap gap-2">
                {results.people.map((person) => (
                  <li key={person.providerId}>
                    <Link
                      href={`/person/${person.providerId}`}
                      className="inline-block rounded-md border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-text"
                    >
                      {person.name}
                      {person.knownForDepartment ? (
                        <span className="ml-1.5 text-xs text-dim">{person.knownForDepartment}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {results.lists.length ? (
            <section>
              <SectionHeading title="Lists" />
              <ul className="space-y-2">
                {results.lists.map((list) => (
                  <li key={list.id}>
                    <Link
                      href={`/list/${list.id}`}
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

          {results.clubs.length ? (
            <section>
              <SectionHeading title="Clubs" />
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.clubs.map((club) => (
                  <li key={club.id}>
                    <Link
                      href={`/club/${club.slug}`}
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

          {!results.films.length &&
          !results.users.length &&
          !results.people.length &&
          !results.lists.length &&
          !results.clubs.length ? (
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
