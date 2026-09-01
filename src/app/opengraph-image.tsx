import { ImageResponse } from 'next/og';

export const alt = 'Nitrate: Your films. Their films. Our films.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const POSTERS = ['#fa5b31', '#806fee', '#d4a94f', '#3f8d76', '#a4474f', '#5678a4'];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#090a0c',
          color: '#f1f0ed',
          padding: '72px 78px 64px',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div
            style={{
              width: 54,
              height: 54,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              background: '#fa5b31',
              color: '#090a0c',
              fontFamily: 'Arial, sans-serif',
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            N
          </div>
          <div style={{ display: 'flex', fontSize: 48, letterSpacing: -1 }}>Nitrate</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ display: 'flex', maxWidth: 880, fontSize: 74, lineHeight: 1.03 }}>
            Your films. Their films. Our films.
          </div>
          <div
            style={{
              display: 'flex',
              maxWidth: 780,
              color: '#a6abb3',
              fontFamily: 'Arial, sans-serif',
              fontSize: 25,
              lineHeight: 1.35,
            }}
          >
            Track what you watch, discover through people and choose movie night together.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 13, height: 106 }}>
          {POSTERS.map((color, index) => (
            <div
              key={color}
              style={{
                width: index === 0 ? 72 : 58,
                height: index === 0 ? 106 : 88,
                display: 'flex',
                borderRadius: 4,
                background: color,
                opacity: 0.72,
              }}
            />
          ))}
          <div style={{ display: 'flex', flex: 1, height: 1, marginBottom: 9, background: '#2a2e35' }} />
          <div
            style={{
              display: 'flex',
              marginBottom: 2,
              color: '#757b85',
              fontFamily: 'Arial, sans-serif',
              fontSize: 19,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            A film diary for people and Movie Clubs
          </div>
        </div>
      </div>
    ),
    size,
  );
}
