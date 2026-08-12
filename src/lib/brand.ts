/**
 * Application identity — the product, not any club inside it.
 *
 * This is deliberately the *only* place the product's name, tagline and
 * description live. A Movie Club is content: it has its own name, its own page
 * and its own members, and a club name must never leak into the application
 * shell, a page title, an email header or an Open Graph card. If you find
 * yourself wanting `BRAND.name` to change per club, you want the club's own
 * `name` field instead.
 *
 * Internal identifiers — the Postgres schema, the session cookie, localStorage
 * keys — deliberately do *not* read from here: renaming those would mean a data
 * migration and signing everyone out, for no user-visible benefit.
 *
 * Renaming the product? Follow `docs/RENAMING.md`. Editing this file covers
 * every screen and every email; four things live outside TypeScript and cannot
 * read it: the favicon letter, two source comments, and the npm package name.
 */
export const BRAND = {
  /** Full name. Used wherever there is room to say it properly. */
  name: 'Nitrate',
  /** For tight spots like the top navigation. Same word here — it is short. */
  short: 'Nitrate',
  /** Logo mark and favicons. */
  initials: 'N',
  /** The three layers the product is built on, in six words. */
  tagline: 'Your films. Their films. Our films.',
  description:
    'Nitrate is a film diary that gets better with people in it. Track what you watch, follow the taste you trust, and run a Movie Club that decides together.',
  /** One line for places that need to explain Movie Clubs specifically. */
  clubsPitch:
    'A Movie Club is a shared queue, a way to decide, a night in the calendar and a permanent record of everything you have watched together.',
} as const;

/** `Some Page · Nitrate` */
export const titleTemplate = `%s · ${BRAND.name}`;

/**
 * Page-title helper for routes that build titles outside Next's `metadata`
 * template (emails, share strings). Keeps the separator in one place.
 */
export function pageTitle(...parts: (string | null | undefined)[]): string {
  const segments = parts.filter((part): part is string => Boolean(part && part.trim()));
  return [...segments, BRAND.name].join(' · ');
}
