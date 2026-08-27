import { NextResponse } from 'next/server';

import { getListDetail } from '@/server/services/lists';
import { storyCard } from '@/server/story-card';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const detail = await getListDetail(listId, null);
    if (detail.list.visibility !== 'public') return new NextResponse(null, { status: 404 });
    const response = await storyCard({
      eyebrow: `A list by ${detail.owner.displayName}`,
      title: detail.list.title,
      subtitle: detail.list.description ?? `${detail.items.length} films curated on Nitrate.`,
      metrics: [
        { label: 'films', value: String(detail.items.length) },
        { label: 'likes', value: String(detail.list.likeCount) },
      ],
      posters: detail.items.slice(0, 18).map((item) => ({
        movieId: item.movie.id,
        slug: item.movie.slug,
        title: item.movie.title,
        year: item.movie.year,
        posterPath: item.movie.posterPath,
      })),
    });
    response.headers.set('Content-Disposition', `attachment; filename="nitrate-list-${detail.list.slug}.png"`);
    response.headers.set('X-Robots-Tag', 'noindex');
    return response;
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
