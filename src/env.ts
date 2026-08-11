import 'server-only';

/**
 * Environment access. Values are read lazily so that a production build never
 * fails just because a runtime-only secret is absent from the build container.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example for the full list.`,
    );
  }
  return value;
}

export const env = {
  get databaseUrl() {
    return required('DATABASE_URL');
  },
  get directDatabaseUrl() {
    return process.env.DIRECT_DATABASE_URL || required('DATABASE_URL');
  },
  get sessionSecret() {
    return required('SESSION_SECRET');
  },
  get tmdbApiKey() {
    return process.env.TMDB_API_KEY?.trim() || null;
  },
  get resendApiKey() {
    return process.env.RESEND_API_KEY?.trim() || null;
  },
  get emailFrom() {
    return process.env.EMAIL_FROM?.trim() || 'Nitrate <onboarding@resend.dev>';
  },
  get cronSecret() {
    return process.env.CRON_SECRET?.trim() || null;
  },
  get movieProvider() {
    const explicit = process.env.MOVIE_PROVIDER?.trim();
    if (explicit === 'offline' || explicit === 'tmdb') return explicit;
    return process.env.TMDB_API_KEY?.trim() ? 'tmdb' : 'offline';
  },
  get siteUrl() {
    return (
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : 'http://localhost:3000')
    );
  },
  get isProduction() {
    return process.env.NODE_ENV === 'production';
  },
};

/** True when the app has everything it needs to talk to a database. */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.SESSION_SECRET);
}
