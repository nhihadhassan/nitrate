import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const requested = Number((await params).size);
  const size = requested === 512 ? 512 : 192;
  const inset = Math.round(size * 0.2);
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ff5b2e',
          borderRadius: Math.round(size * 0.18),
        }}
      >
        <div
          style={{
            width: size - inset * 2,
            height: size - inset * 1.35,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#08090b',
            borderRadius: Math.round(size * 0.06),
            color: '#ff5b2e',
            fontFamily: 'Georgia',
            fontSize: Math.round(size * 0.42),
          }}
        >
          N
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
    },
  );
}
