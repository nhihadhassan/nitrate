'use client';

import { createContext, useCallback, useContext, useMemo, useRef } from 'react';

import { normalizeExploreIds } from '@/lib/explore';

type ExploreSessionValue = {
  excludedIds: () => string[];
  acceptFilms: <T extends { id: string }>(films: T[]) => T[];
};

const ExploreSessionContext = createContext<ExploreSessionValue | null>(null);

export function ExploreSessionProvider({
  initialMovieIds,
  children,
}: {
  initialMovieIds: string[];
  children: React.ReactNode;
}) {
  const seenRef = useRef(new Set(normalizeExploreIds(initialMovieIds)));
  const excludedIds = useCallback(() => normalizeExploreIds([...seenRef.current]), []);
  const acceptFilms = useCallback(<T extends { id: string }>(films: T[]) => {
    const accepted: T[] = [];
    for (const film of films) {
      if (seenRef.current.has(film.id)) continue;
      seenRef.current.add(film.id);
      accepted.push(film);
    }
    return accepted;
  }, []);
  const value = useMemo(() => ({ excludedIds, acceptFilms }), [acceptFilms, excludedIds]);

  return <ExploreSessionContext.Provider value={value}>{children}</ExploreSessionContext.Provider>;
}

export function useExploreSession(): ExploreSessionValue | null {
  return useContext(ExploreSessionContext);
}
