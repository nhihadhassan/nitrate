import Image from 'next/image';

import { posterUrl } from '@/lib/images';
import { cn } from '@/lib/utils';

/**
 * The cinematic band at the top of every club card.
 *
 * There is deliberately only **one** club image — `clubs.image_asset_id`, the
 * same square a club owner uploads in settings and the same one the club header
 * shows beside the name. A banner is a *crop* of it, not a second asset to
 * manage: nobody should have to keep two pictures in sync to make a card look
 * right.
 *
 * When a club has no image we still owe the grid something intentional, so we
 * fall back in two steps — a heavily scrimmed still of the next movie's poster
 * if there is one, then a restrained iris/ember wash with the club's initial.
 * Never an empty grey box.
 */
/**
 * The club's picture at identity size — a square thumbnail, the same asset the
 * card banner crops. Used wherever a club is named in a list rather than shown
 * as a card: the club header, the home sidebar.
 *
 * `className` carries the size so callers can be responsive; `sizes` should
 * describe the largest rendered box.
 */
export function ClubAvatar({
  name,
  imageAssetId,
  className,
  sizes = '48px',
}: {
  name: string;
  imageAssetId: string | null;
  className?: string;
  sizes?: string;
}) {
  return (
    <span
      className={cn(
        'relative block shrink-0 overflow-hidden rounded-md border border-line bg-surface',
        className,
      )}
    >
      {imageAssetId ? (
        <Image src={`/media/${imageAssetId}`} alt="" fill sizes={sizes} className="object-cover" unoptimized />
      ) : (
        <span className="club-cover-fallback flex h-full items-center justify-center font-display text-iris">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

export function ClubCover({
  name,
  imageAssetId,
  posterPath,
  className,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  priority,
  children,
}: {
  name: string;
  imageAssetId: string | null;
  posterPath?: string | null;
  className?: string;
  sizes?: string;
  priority?: boolean;
  children?: React.ReactNode;
}) {
  const poster = imageAssetId ? null : posterUrl(posterPath, 'lg');

  return (
    <div className={cn('club-cover relative shrink-0 overflow-hidden bg-canvas', className)}>
      {imageAssetId ? (
        <Image
          src={`/media/${imageAssetId}`}
          alt=""
          fill
          sizes={sizes}
          priority={priority}
          className="club-cover-media object-cover"
          unoptimized
        />
      ) : poster ? (
        /* Poster-derived: blurred and pushed back so it reads as atmosphere,
           not as a claim that this poster *is* the club. */
        <Image
          src={poster}
          alt=""
          fill
          sizes={sizes}
          className="scale-125 object-cover opacity-45 blur-xl saturate-[1.15]"
          unoptimized
        />
      ) : (
        <span
          aria-hidden
          className="club-cover-fallback absolute inset-0 flex items-center justify-center font-display text-5xl text-iris/45"
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}

      {/* Readability scrim. Sits under the card body so the seam disappears. */}
      <span aria-hidden className="club-cover-scrim absolute inset-0" />
      {children}
    </div>
  );
}
