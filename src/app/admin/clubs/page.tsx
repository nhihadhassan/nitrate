import Link from 'next/link';

import { Badge, EmptyState } from '@/components/ui/primitives';
import { formatDateOnly } from '@/lib/utils';
import { adminListClubs } from '@/server/actions/admin';

export const dynamic = 'force-dynamic';

export default async function AdminClubsPage() {
  const clubs = await adminListClubs();

  if (!clubs.length) {
    return <EmptyState title="No clubs yet" description="Clubs will appear here as they are created." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-dim">
            <th className="py-2 font-medium">Club</th>
            <th className="py-2 font-medium">Owner</th>
            <th className="py-2 font-medium">Visibility</th>
            <th className="py-2 text-right font-medium">Members</th>
            <th className="py-2 text-right font-medium">Screenings</th>
            <th className="py-2 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {clubs.map((club) => (
            <tr key={club.id} className="border-b border-line">
              <td className="py-2.5">
                <Link href={`/club/${club.slug}`} className="font-medium hover:text-iris">
                  {club.name}
                </Link>
              </td>
              <td className="py-2.5">
                <Link href={`/@${club.ownerUsername}`} className="text-muted hover:text-ember">
                  @{club.ownerUsername}
                </Link>
              </td>
              <td className="py-2.5">
                <Badge tone={club.visibility === 'public' ? 'iris' : 'neutral'}>
                  {club.visibility}
                </Badge>
              </td>
              <td className="py-2.5 text-right tabular">{club.memberCount}</td>
              <td className="py-2.5 text-right tabular">{club.screeningCount}</td>
              <td className="py-2.5 text-xs text-dim tabular">
                {formatDateOnly(club.createdAt.toISOString().slice(0, 10))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
