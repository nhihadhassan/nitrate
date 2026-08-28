import { requireUser } from '@/server/auth/session';
import { getPersonalRecap } from '@/server/services/stats';
import { storyCard } from '@/server/story-card';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ year: string }> }) {
  const user = await requireUser();
  const year = Number((await params).year);
  const recap = await getPersonalRecap(user.id, year);
  return storyCard({
    eyebrow: recap.title,
    title: `${recap.stats.uniqueFilms} films shaped the year.`,
    subtitle: recap.closingLine,
    metrics: [
      { label: 'viewings', value: String(recap.stats.viewingCount) },
      { label: 'hours', value: String(Math.round(recap.stats.runtimeMinutes / 60)) },
      { label: 'rewatches', value: String(recap.stats.rewatches) },
      { label: 'club nights', value: String(recap.clubContribution.screenings) },
    ],
    posters: recap.collage,
  });
}
