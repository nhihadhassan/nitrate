import type { Metadata } from 'next';
import Link from 'next/link';

import { ImportWizard } from '@/components/import/import-wizard';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/primitives';
import { BRAND } from '@/lib/brand';
import { loginHref, signupHref } from '@/lib/links';
import { getCurrentUser } from '@/server/auth/session';
import { getBatch, getLatestBatch } from '@/server/import/letterboxd';

export const metadata: Metadata = {
  title: 'Import your Letterboxd history',
  description:
    'Bring over your films, diary entries, ratings, reviews, watchlist and lists. Your history arrives intact, matched against the film database, with nothing overwritten.',
};
export const dynamic = 'force-dynamic';
/** Matching slices are server actions invoked from this route, and each row
 *  costs a provider round trip. Give them room beyond the default. */
export const maxDuration = 60;

/**
 * Import lives at a public URL on purpose.
 *
 * A decade of someone's diary is a lot to ask them to abandon, and carrying it
 * over is the strongest argument this product has. Signed out, this route used
 * to bounce to a bare sign-in form that explained nothing about what was on the
 * other side of it. Now the offer comes first, and auth books the return trip.
 */
export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <ImportPitch />;

  const { batch: batchParam } = await searchParams;
  const activeId = batchParam ?? (await getLatestBatch(user.id))?.id ?? null;
  const active =
    activeId && batchParam ? await getBatch(user.id, activeId).catch(() => null) : null;

  return (
    <ImportWizard
      initialBatch={
        active
          ? {
              id: active.batch.id,
              status: active.batch.status,
              counts: active.counts,
              totals: active.batch.totals,
              rows: active.rows.map(({ row, movie }) => ({
                id: row.id,
                kind: row.kind,
                rawTitle: row.rawTitle,
                rawYear: row.rawYear,
                matchStatus: row.matchStatus,
                confidence: row.matchConfidence,
                error: row.error,
                candidates:
                  (row.candidates as {
                    providerId: string;
                    title: string;
                    year: number | null;
                    posterPath: string | null;
                  }[]) ?? [],
                matched: movie
                  ? {
                      title: movie.title,
                      year: movie.year,
                      posterPath: movie.posterPath,
                      slug: movie.slug,
                    }
                  : null,
              })),
            }
          : null
      }
    />
  );
}

const WHAT_TRANSFERS: [string, string][] = [
  ['Films', 'Everything you have marked as watched, matched against the film database.'],
  ['Diary entries', 'With the dates you actually watched them, rewatches included.'],
  ['Ratings', 'Half-stars intact — a 3½ stays a 3½.'],
  ['Reviews', 'Your writing, attached to the right entry.'],
  ['Watchlist', 'What you still mean to get to.'],
  ['Lists', 'Titles, descriptions and order preserved.'],
];

const STEPS: [string, string][] = [
  ['Export from Letterboxd', 'Settings → Data → Export your data. Letterboxd emails you a .zip.'],
  ['Drop the file here', 'We read the CSVs inside it. Nothing is sent anywhere else.'],
  [
    'Check the matches',
    'Anything ambiguous is shown to you with the candidates, so a remake never gets logged as the original.',
  ],
  [
    'Confirm, and it lands',
    'Your diary, ratings and lists appear on your profile. Nothing you already logged here is overwritten.',
  ],
];

function ImportPitch() {
  return (
    <Container size="narrow" className="py-14 pb-24 sm:py-20">
      <p className="eyebrow">Coming from Letterboxd?</p>
      <h1 className="mt-3 text-balance text-4xl leading-[1.05] sm:text-5xl">
        Import your Letterboxd history
      </h1>
      <p className="mt-4 max-w-xl text-[1.0625rem] leading-relaxed text-muted">
        Bring over your films, diary entries, ratings, reviews, watchlist and lists. Years of
        watching should not be the thing standing between you and somewhere better to keep it.
      </p>

      <div className="mt-8 flex flex-wrap gap-2.5">
        <Button asChild variant="primary" size="lg">
          <Link href={signupHref('/import')}>Create an account and import</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href={loginHref('/import')}>I already have an account</Link>
        </Button>
      </div>
      <p className="mt-3 text-xs text-dim">
        You land straight back here once you are signed in.
      </p>

      <section className="mt-14">
        <h2 className="eyebrow mb-4">What comes across</h2>
        <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {WHAT_TRANSFERS.map(([title, description]) => (
            <li key={title}>
              <p className="font-medium">{title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted">{description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="eyebrow mb-4">How it works</h2>
        <ol className="space-y-4">
          {STEPS.map(([title, description], index) => (
            <li key={title} className="flex gap-4">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line font-display text-sm tabular">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-medium">{title}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-muted">{description}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 rounded-lg border border-line bg-surface/50 p-5">
        <h2 className="font-display text-lg">Then what?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {BRAND.clubsPitch} That is the part a film diary on its own does not do, and the reason
          this exists.
        </p>
        <Link
          href="/clubs"
          className="mt-3 inline-block text-sm text-muted underline underline-offset-2 hover:text-ember"
        >
          See how Movie Clubs work
        </Link>
      </section>
    </Container>
  );
}
