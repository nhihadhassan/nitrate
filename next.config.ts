import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org', pathname: '/t/p/**' },
    ],
    // Poster aspect ratios we actually render, so Next generates a tight set.
    deviceSizes: [340, 480, 640, 828, 1080, 1280, 1920],
    imageSizes: [64, 92, 120, 154, 185, 230, 300],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: {
    // Server Actions receive image uploads (already downscaled client-side).
    serverActions: { bodySizeLimit: '4mb' },
  },
  async rewrites() {
    // `/@username` is the canonical profile URL, but `@` is reserved for
    // parallel-route slots in the App Router, so the pages live under /u/.
    return [
      { source: '/@:username', destination: '/u/:username' },
      { source: '/@:username/:path*', destination: '/u/:username/:path*' },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
