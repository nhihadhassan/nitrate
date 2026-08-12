/**
 * Single source of truth for the product's name.
 *
 * Everything user-facing reads from here rather than hardcoding a string, so a
 * rename is one edit instead of forty. Internal identifiers — the Postgres
 * schema, the session cookie, localStorage keys — deliberately do *not* use
 * these values: renaming those would mean a data migration and signing everyone
 * out, for no user-visible benefit.
 *
 * Renaming the product? Follow `docs/RENAMING.md`. Editing this file covers
 * every screen and every email, but four things live outside TypeScript and
 * cannot read it: the favicon letter, two source comments, the npm package
 * name, and the `EMAIL_FROM` environment variable.
 */
export const BRAND = {
  /** Full name. Used wherever there is room to say it properly. */
  name: 'Rachad Julijan Diyack Movie Club',
  /** For tight spots like the top navigation. */
  short: 'RJD Movie Club',
  /** Logo mark and favicons. */
  initials: 'RJD',
  tagline: 'Track what you watch. Decide together. Never argue about it again.',
  description:
    'A social film diary for our group: track the films you watch, keep a diary worth re-reading, and let the wheel decide what we watch next.',
} as const;

/** `Some Page · Rachad Julijan Diyack Movie Club` */
export const titleTemplate = `%s · ${BRAND.name}`;
