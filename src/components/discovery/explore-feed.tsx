'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { PosterRail } from '@/components/film/poster-rail';
import { useExploreSession } from '@/components/discovery/explore-session';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/ui/primitives';
import { appendUniqueExploreFilms, normalizeExploreIds, type ExploreCursor, type ExploreModule } from '@/lib/explore';
import { loadExploreModulesAction } from '@/server/actions/discovery';

export function ExploreFeed({ initialSeenIds, seed }: { initialSeenIds: string[]; seed: string }) {
  const [modules, setModules] = useState<ExploreModule[]>([]);
  const [cursor, setCursor] = useState<ExploreCursor | null>({ batch: 0, seed });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seenRef = useRef(new Set(normalizeExploreIds(initialSeenIds)));
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const exploreSession = useExploreSession();

  const loadMore = useCallback(async () => {
    if (!cursor || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    const result = await loadExploreModulesAction({
      cursor,
      excludedMovieIds: normalizeExploreIds([
        ...(exploreSession?.excludedIds() ?? []),
        ...seenRef.current,
      ]),
    });
    loadingRef.current = false;
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    const accepted = result.data.modules.flatMap((feedModule): ExploreModule[] => {
      if (feedModule.type !== 'poster_rail') return [feedModule];
      const sessionFilms = exploreSession ? exploreSession.acceptFilms(feedModule.films) : feedModule.films;
      const films = appendUniqueExploreFilms([], sessionFilms.filter((film) => !seenRef.current.has(film.id)));
      if (films.length < 4) return [];
      films.forEach((film) => seenRef.current.add(film.id));
      return [{ ...feedModule, films }];
    });
    setModules((current) => [...current, ...accepted]);
    setCursor(result.data.cursor);
  }, [cursor, exploreSession]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !cursor || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: '700px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, error, loadMore]);

  return (
    <div className="space-y-12 sm:space-y-14">
      {modules.map((feedModule) => feedModule.type === 'poster_rail' ? (
        <section key={feedModule.id} className="motion-safe:animate-[nitrate-rise_220ms_cubic-bezier(0.22,1,0.36,1)_both]">
          <SectionHeading title={feedModule.title} subtitle={feedModule.subtitle} />
          <PosterRail
            label={feedModule.title}
            films={feedModule.films}
            continuation={feedModule.continuation}
            showReason={feedModule.showReason}
            showFeedback={feedModule.showFeedback}
            excludedMovieIds={[...seenRef.current]}
          />
          {feedModule.degraded ? (
            <p className="mt-2 text-xs text-amber">This shelf is using the local catalogue right now.</p>
          ) : null}
        </section>
      ) : null)}

      <div ref={sentinelRef} data-explore-sentinel className="min-h-6" aria-hidden="true" />
      <div aria-live="polite" className="min-h-8 text-center">
        {loading ? <ExploreSkeleton /> : null}
        {error ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted">Explore paused while loading the next shelves.</p>
            <Button variant="outline" onClick={() => void loadMore()}>Try again</Button>
          </div>
        ) : null}
        {!cursor && modules.length ? <p className="text-sm text-dim">You reached the end of today’s shelves.</p> : null}
      </div>
    </div>
  );
}

function ExploreSkeleton() {
  return (
    <div role="status" className="space-y-3 text-left">
      <span className="sr-only">Loading more discovery shelves</span>
      <div className="h-6 w-40 animate-pulse rounded-sm bg-surface-strong motion-reduce:animate-none" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="aspect-[2/3] w-28 shrink-0 animate-pulse rounded-sm bg-surface-strong motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}
