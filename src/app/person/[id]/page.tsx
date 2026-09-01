import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';

import { PosterCard, PosterGrid } from '@/components/film/poster';
import { FilmmakerFollowButton } from '@/components/discovery/filmmaker-follow-button';
import { JsonLd } from '@/components/seo/json-ld';
import { Container, EmptyState } from '@/components/ui/primitives';
import { env } from '@/env';
import { profileUrl } from '@/lib/images';
import { truncate } from '@/lib/utils';
import { filmRefsFromSummaries } from '@/server/movies/catalog';
import { withProvider } from '@/server/movies/provider';
import { getCurrentUser } from '@/server/auth/session';
import { getPersonFollowState } from '@/server/services/discovery';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const { data } = await withProvider((p) => p.getPerson(id)).catch(() => ({ data: null }));
  if (!data) return { title: 'Person' };
  const image = profileUrl(data.profilePath, 'md');
  return {
    title: data.name,
    description: data.biography
      ? truncate(data.biography, 160)
      : `Films and credits for ${data.name} on Nitrate.`,
    alternates: { canonical: `/person/${encodeURIComponent(id)}` },
    openGraph: { title: data.name, images: image ? [image] : undefined },
    twitter: { card: image ? 'summary_large_image' : 'summary', images: image ? [image] : undefined },
  };
}

export default async function PersonPage({ params }: Params) {
  const { id } = await params;
  const { data: person, degraded } = await withProvider((p) => p.getPerson(id));
  if (!person) notFound();

  const user = await getCurrentUser();

  // Filmographies link like everything else: canonical slugs, resolved once.
  const filmography = await filmRefsFromSummaries(
    (person.knownFor ?? []).filter((film) => !film.adult),
  );
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = await filmRefsFromSummaries(
    (person.knownFor ?? []).filter((film) => !film.adult && film.releaseDate && film.releaseDate >= today),
  );
  const followed = user ? await getPersonFollowState(user.id, id) : false;

  const photo = profileUrl(person.profilePath, 'md');

  return (
    <Container size="wide" className="py-8 pb-20">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: person.name,
          url: new URL(`/person/${encodeURIComponent(id)}`, env.siteUrl).toString(),
          image: photo ?? undefined,
          description: person.biography ? truncate(person.biography, 500) : undefined,
          jobTitle: person.knownForDepartment ?? undefined,
        }}
      />
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
          {user ? <div className="mt-4"><FilmmakerFollowButton providerId={id} initialFollowed={followed} /></div> : null}
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

      {upcoming.length ? (
        <section className="mt-10 border-y border-line py-7">
          <h2 className="eyebrow mb-1">Known upcoming work</h2>
          <p className="mb-4 text-xs text-dim">Release dates can move. Nitrate does not send unreliable release alerts.</p>
          <PosterGrid>
            {upcoming.map((film) => <PosterCard key={film.id} film={film} size="sm" />)}
          </PosterGrid>
        </section>
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
