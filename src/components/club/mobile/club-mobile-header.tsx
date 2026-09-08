import { ClubCover } from '@/components/club/club-cover';

/**
 * The club header on a phone.
 *
 * The desktop header stacks an avatar, a name, a visibility badge, an avatar
 * stack, a description and an interest list before you reach any content — on
 * a 390px screen that is most of the viewport spent on chrome. Here the club's
 * own group photo *is* the header: the picture the club already uploaded,
 * cropped to a band, with the name and the two facts that actually change how
 * you read the page.
 *
 * Same asset as everywhere else (`clubs.image_asset_id`); no second image to
 * keep in sync.
 */
export function ClubMobileHeader({
  name,
  imageAssetId,
  memberCount,
  cadenceLabel,
  posterPath,
  coverSeed,
  posterPaths,
}: {
  name: string;
  imageAssetId: string | null;
  memberCount: number;
  cadenceLabel: string;
  /** Club id — picks one of the three built-in covers when there is no photo. */
  coverSeed: string;
  /** Falls back to the next film's artwork when a club has no photo yet. */
  posterPath?: string | null;
  /** The club's own film artwork, for the mosaic fallback. */
  posterPaths?: string[];
}) {
  return (
    <ClubCover
      name={name}
      imageAssetId={imageAssetId}
      posterPath={posterPath}
      coverSeed={coverSeed}
      posterPaths={posterPaths}
      className="-mx-4 h-48"
      sizes="100vw"
      priority
    >
      <div className="absolute inset-x-0 bottom-0 p-4 pb-5">
        {/* Club names run long — "Rachad Julijan Diyack Movie Club" is three
            lines at 375px — so the display size steps down and the name is
            clamped rather than allowed to fill the band. */}
        <h1
          className="font-display text-[1.5rem] leading-[1.08] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] xs:text-[1.75rem]"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {name}
        </h1>
        <p className="mt-1.5 text-sm text-white/75 drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
          {memberCount} {memberCount === 1 ? 'member' : 'members'} · {cadenceLabel}
        </p>
      </div>
    </ClubCover>
  );
}
