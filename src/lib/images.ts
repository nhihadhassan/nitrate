/**
 * TMDB serves artwork from a public CDN; only metadata lookups need a key.
 * Sizes are chosen to match the grid breakpoints we actually render.
 */
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export type PosterSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type BackdropSize = 'sm' | 'md' | 'lg';

const POSTER_SIZES: Record<PosterSize, string> = {
  xs: 'w92',
  sm: 'w154',
  md: 'w342',
  lg: 'w500',
  xl: 'w780',
};

const BACKDROP_SIZES: Record<BackdropSize, string> = {
  sm: 'w780',
  md: 'w1280',
  lg: 'original',
};

export function posterUrl(path: string | null | undefined, size: PosterSize = 'md'): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${POSTER_SIZES[size]}${path}`;
}

export function backdropUrl(path: string | null | undefined, size: BackdropSize = 'md'): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${BACKDROP_SIZES[size]}${path}`;
}

export function profileUrl(path: string | null | undefined, size: 'sm' | 'md' = 'sm'): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size === 'sm' ? 'w185' : 'h632'}${path}`;
}

export function avatarUrl(assetId: string | null | undefined): string | null {
  return assetId ? `/media/${assetId}` : null;
}

/**
 * Deterministic hue per user so the placeholder avatar is stable and personal
 * without needing an upload.
 */
export function hueFromString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 360;
  }
  return hash;
}
