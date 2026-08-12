'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { EmptyState, inputClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { filmHref } from '@/lib/links';
import { refreshMovieMetadataAction } from '@/server/actions/admin';

type MovieRow = {
  id: string;
  providerId: string;
  slug: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  runtime: number | null;
  detailsFetchedAt: string | null;
  watchCount: number;
};

export function MovieMetadataTools({ movies }: { movies: MovieRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [manualId, setManualId] = useState('');
  const [pending, startTransition] = useTransition();

  function refresh(providerId: string) {
    startTransition(async () => {
      const result = await refreshMovieMetadataAction(providerId);
      if (!result.ok) {
        toast({ message: result.error, tone: 'error' });
        return;
      }
      toast({ message: `Refreshed ${result.data.title}`, tone: 'success' });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form
        className="flex max-w-md gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (manualId.trim()) refresh(manualId.trim());
        }}
      >
        <input
          value={manualId}
          onChange={(event) => setManualId(event.target.value)}
          placeholder="Refresh by TMDB id"
          aria-label="Provider id"
          className={inputClass}
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          Refresh
        </Button>
      </form>

      {movies.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-dim">
                <th className="py-2 font-medium">Film</th>
                <th className="py-2 font-medium">Missing</th>
                <th className="py-2 text-right font-medium">Watches</th>
                <th className="py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {movies.map((movie) => (
                <tr key={movie.id} className="border-b border-line">
                  <td className="py-2.5">
                    <Link href={filmHref(movie)} className="font-medium hover:text-ember">
                      {movie.title}
                    </Link>
                    <span className="ml-1.5 text-xs text-dim tabular">{movie.year}</span>
                    <span className="block text-xs text-dim">TMDB {movie.providerId}</span>
                  </td>
                  <td className="py-2.5 text-xs text-muted">
                    {[
                      !movie.detailsFetchedAt && 'details',
                      !movie.posterPath && 'poster',
                      !movie.runtime && 'runtime',
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </td>
                  <td className="py-2.5 text-right tabular">{movie.watchCount}</td>
                  <td className="py-2.5 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => refresh(movie.providerId)}
                    >
                      Refresh
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="Metadata looks healthy"
          description="No films are missing details, artwork or runtime."
        />
      )}
    </div>
  );
}
