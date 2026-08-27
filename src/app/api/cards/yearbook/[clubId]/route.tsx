import { requireUser } from '@/server/auth/session';
import { getClubYearbook } from '@/server/services/stats';
import { storyCard } from '@/server/story-card';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const user = await requireUser();
  const yearValue = new URL(request.url).searchParams.get('year');
  const yearbook = await getClubYearbook((await params).clubId, yearValue ? Number(yearValue) : null, user.id);
  return storyCard({
    eyebrow: yearbook.title,
    title: `${yearbook.uniqueFilms} films, watched together.`,
    subtitle: yearbook.ratingsWithheld ? 'Ratings stay with the people who took part.' : 'A year of picks, screenings, and shared reactions.',
    metrics: [
      { label: 'movie nights', value: String(yearbook.screenings.length) },
      { label: 'hours', value: String(Math.round(yearbook.totalRuntimeMinutes / 60)) },
      { label: 'members', value: String(yearbook.memberStories.length) },
    ],
    posters: yearbook.collage,
  });
}
