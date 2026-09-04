import Link from 'next/link';

import { Poster } from '@/components/film/poster';
import { Button } from '@/components/ui/button';
import { inlineSelectionLabel } from '@/lib/club-cadence';
import { pluralize } from '@/lib/utils';

export type Contender = {
  nominationId: string;
  pitch: string | null;
  nominatedBy: { id: string; username: string; displayName: string; avatarAssetId: string | null };
  movie: { slug: string; title: string; year: number | null; posterPath: string | null; runtime: number | null };
};

export function WheelPanel({
  clubSlug,
  roundId,
  contenders,
  canSpin,
  allMembersPicked,
  spun = false,
  selectionMovieLabel = 'This selection’s movie',
}: {
  clubId: string;
  clubSlug?: string;
  roundId: string;
  contenders: Contender[];
  spun?: boolean;
  canSpin: boolean;
  allMembersPicked: boolean;
  selectionMovieLabel?: string;
}) {
  const href = clubSlug ? `/club/${clubSlug}/reveal/${roundId}` : '#club-decision';
  return (
    <div className="signature-surface rounded-2xl border border-iris/25 p-5" data-pointer-light>
      <div className="flex items-center gap-3">
        <div className="flex -space-x-3">
          {contenders.slice(0, 5).map((contender) => <div key={contender.nominationId} className="w-12 shrink-0"><Poster film={contender.movie} size="xs" linked={false} /></div>)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-iris">{spun ? 'The wheel has been spun' : allMembersPicked ? 'The picks are in' : 'Movie Club picks'}</p>
          <p className="mt-1 text-sm text-muted">{spun ? `Tap to reveal ${inlineSelectionLabel(selectionMovieLabel)}.` : `${pluralize(contenders.length, 'movie')} in. One movie night.`}</p>
        </div>
        <Button asChild variant="iris" size="lg"><Link href={href}>{spun ? 'Reveal result' : canSpin && allMembersPicked ? 'Open the wheel' : 'View picks'}</Link></Button>
      </div>
    </div>
  );
}
