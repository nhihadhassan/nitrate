/**
 * Which built-in cover a club gets when it has not uploaded a photo.
 *
 * There are three (see `.club-cover-default-*` in globals.css). The choice is
 * derived from the club's own id so it is stable: a club's header keeps the
 * same identity between visits and between devices, without storing anything.
 *
 * A real uploaded image always wins — this is only the fallback.
 */
export const DEFAULT_CLUB_COVERS = [
  'club-cover-default-1',
  'club-cover-default-2',
  'club-cover-default-3',
] as const;

export type DefaultClubCover = (typeof DEFAULT_CLUB_COVERS)[number];

export function defaultClubCover(seed: string): DefaultClubCover {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 9973;
  }
  return DEFAULT_CLUB_COVERS[hash % DEFAULT_CLUB_COVERS.length];
}
