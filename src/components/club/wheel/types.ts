import type { PosterFilm } from '@/components/film/poster';

/** One pick on the wheel. The order is the server's, never the client's. */
export type WheelItem = {
  nominationId: string;
  movie: PosterFilm;
  nominatedBy?: { displayName: string };
};

/**
 * Every wheel presentation takes the same props, so the geometry can be
 * swapped without the surrounding experience knowing which one it is.
 *
 * `winnerIndex` is null until the server has committed a result. Passing a
 * number is what starts the animation — the component never picks.
 */
export type WheelPresentationProps = {
  items: WheelItem[];
  winnerIndex: number | null;
  spinning: boolean;
  onSettled?: () => void;
  /** Stage height in px; the caller sizes it to the viewport. */
  height?: number;
};
