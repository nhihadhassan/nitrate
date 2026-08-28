import { NextResponse } from 'next/server';

import { storyCard } from '@/server/story-card';
import { syntheticCurationState } from '@/test-fixtures/curation';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (process.env.ALLOW_SYNTHETIC_FIXTURES !== 'true') return new NextResponse(null, { status: 404 });
  const fixture = syntheticCurationState(new URL(request.url).searchParams.get('state') ?? 'normal');
  if (fixture.unavailable) return new NextResponse(null, { status: 404 });
  return storyCard({
    eyebrow: 'A shared list on Nitrate',
    title: fixture.title,
    subtitle: fixture.description,
    metrics: [
      { label: 'films', value: String(fixture.itemCount) },
      { label: 'editors', value: String(fixture.editors.filter((editor) => editor.status !== 'pending').length) },
    ],
    posters: fixture.items.slice(0, 18).map((item) => ({
      movieId: item.id,
      slug: item.id,
      title: item.title,
      year: item.year,
      posterPath: null,
    })),
  });
}
