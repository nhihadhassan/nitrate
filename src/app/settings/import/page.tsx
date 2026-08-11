import type { Metadata } from 'next';

import { ImportWizard } from '@/components/import/import-wizard';
import { requireUser } from '@/server/auth/session';
import { getBatch, getLatestBatch } from '@/server/import/letterboxd';

export const metadata: Metadata = { title: 'Import from Letterboxd' };
export const dynamic = 'force-dynamic';

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  const user = await requireUser();
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
                candidates: (row.candidates as {
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
