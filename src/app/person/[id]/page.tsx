import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';

import { PosterCard, PosterGrid } from '@/components/film/poster';
import { Container, EmptyState } from '@/components/ui/primitives';
import { profileUrl } from '@/lib/images';
import { truncate } from '@/lib/utils';
import { filmRefsFromSummaries } from '@/server/movies/catalog';
import { withProvider } from '@/server/movies/provider';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const { data } = await withProvider((p) => p.getPerson(id)).catch(() => ({ data: null }));
  if (!data) return { title: 'Person' };
  return { title: data.name, description: data.biography ? truncate(data.biography, 160) : undefined };
}

export default async function PersonPage({ params }: Params) {
  const { id } = await params;
  const { data: person, degraded } = await withProvider((p) => p.getPerson(id));
  if (!person) notFound();

  // Filmographies link like everything else: canonical slugs, resolved once.
  const filmography = await filmRefsFromSummaries(
    (person.knownFor ?? []).filter((film) => !film.adult),
  );

  const photo = profileUrl(person.profilePath, 'md');

  return (
    <Container size="wide" className="py-8 pb-20">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <div className="relative aspect-[2/3] w-32 shrink-0 overflow-hidden rounded-md bg-surface sm:w-40">
          {photo ? (
            <Image src={photo} alt="" fill sizes="160px" className="object-cover" priority />
          ) : (
            <span className="flex h-full items-center justify-center text-xs text-dim">No photo</span>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-4xl leading-tight sm:text-5xl">{person.name}</h1>
          {person.knownForDepartment ? (
            <p className="mt-1.5 text-sm text-muted">{person.knownForDepartment}</p>
          ) : null}
        </div>
      </header>

      {person.biography ? (
        <p className="mt-6 max-w-3xl whitespace-pre-line text-[0.9375rem] leading-relaxed text-muted">
          {truncate(person.biography, 900)}
        </p>
      ) : null}

      {degraded ? (
        <p className="mt-6 rounded-md border border-amber/30 bg-amber/[0.07] px-3 py-2 text-xs text-amber">
          Showing what we already had — the film database is unreachable right now.
        </p>
      ) : null}

      <section className="mt-10">
        <h2 className="eyebrow mb-3">Known for</h2>
        {filmography.length ? (
          <PosterGrid>
            {filmography.map((film) => (
              <PosterCard key={film.id} film={film} />
            ))}
          </PosterGrid>
        ) : (
          <EmptyState
            title="No credits found"
            description={
              degraded
                ? 'The film database is unreachable right now, so we cannot load a filmography.'
                : 'We do not have a filmography for this person yet.'
            }
          />
        )}
      </section>
    </Container>
  );
}
