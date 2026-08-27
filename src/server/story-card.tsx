import 'server-only';

import { ImageResponse } from 'next/og';

import type { PosterStory } from '@/lib/stats';
import { posterUrl } from '@/lib/images';

export function storyCard(input: {
  eyebrow: string;
  title: string;
  subtitle: string;
  metrics: Array<{ label: string; value: string }>;
  posters: PosterStory[];
}) {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#08090b', color: '#f4f4f5', padding: 64, fontFamily: 'Arial' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 690, zIndex: 2 }}>
          <div style={{ color: '#ff5b2e', fontSize: 18, letterSpacing: 4, textTransform: 'uppercase' }}>{input.eyebrow}</div>
          <div style={{ marginTop: 24, fontFamily: 'Georgia', fontSize: 68, lineHeight: 1.02 }}>{input.title}</div>
          <div style={{ marginTop: 20, color: '#a1a7b0', fontSize: 24, lineHeight: 1.35 }}>{input.subtitle}</div>
          <div style={{ display: 'flex', gap: 34, marginTop: 'auto' }}>
            {input.metrics.slice(0, 4).map((metric) => (
              <div key={metric.label} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontFamily: 'Georgia', fontSize: 42 }}>{metric.value}</div>
                <div style={{ marginTop: 5, color: '#787f8a', fontSize: 15, textTransform: 'uppercase', letterSpacing: 2 }}>{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'absolute', right: 42, top: 42, bottom: 42, width: 430, display: 'flex', flexWrap: 'wrap', gap: 10, transform: 'rotate(2deg)' }}>
          {input.posters.slice(0, 6).map((poster) => (
            <div key={poster.movieId} style={{ width: 132, height: 198, display: 'flex', background: '#15171b', overflow: 'hidden', borderRadius: 7 }}>
              {poster.posterPath ? (
                // ImageResponse renders remote artwork directly; next/image is not available in this renderer.
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={posterUrl(poster.posterPath, 'md') ?? ''} width="132" height="198" style={{ objectFit: 'cover' }} />
              ) : null}
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 64, bottom: 28, color: '#565c66', fontSize: 15, letterSpacing: 3 }}>NITRATE</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
