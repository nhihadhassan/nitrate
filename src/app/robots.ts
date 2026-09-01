import type { MetadataRoute } from 'next';

import { env } from '@/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/api/',
        '/dev/',
        '/settings/',
        '/notifications',
        '/onboarding',
        '/offline',
        '/search',
        '/watchlist',
        '/tonight',
        '/taste-circle',
        '/taste/',
        '/lists/new',
        '/lists/collaboration',
        '/clubs/new',
        '/join/',
        '/share/',
        '/network',
      ],
    },
    sitemap: new URL('/sitemap.xml', env.siteUrl).toString(),
    host: env.siteUrl,
  };
}
