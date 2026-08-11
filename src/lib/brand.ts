/**
 * Single source of truth for the product's name.
 *
 * Everything user-facing reads from here rather than hardcoding a string, so a
 * rename is one edit instead of forty. Internal identifiers — the Postgres
 * schema, the session cookie, localStorage keys — deliberately do *not* use
 * these values: renaming those would mean a data migration and signing everyone
 * out, for no user-visible benefit.
 */
export const BRAND = {
  /** Full name. Used wherever there is room to say it properly. */
  name: 'Nhach Bule Dick Movie Club',
  /** For tight spots like the top navigation. */
  short: 'NBD Movie Club',
  /** Logo mark and favicons. */
  initials: 'NBD',
  tagline: 'Track what you watch. Decide together. Never argue about it again.',
  description:
    'A social film diary for our group: track the films you watch, keep a diary worth re-reading, and let the wheel decide what we watch next.',
} as const;

/** `Some Page · Nhach Bule Dick Movie Club` */
export const titleTemplate = `%s · ${BRAND.name}`;
