/**
 * Every internal URL the product can produce, in one place.
 *
 * The rule this file exists to enforce: **a film is always linked by its
 * canonical slug**. Before this existed, discovery rails linked by raw TMDB id
 * (`/film/278`), which only worked because the film page silently ingested and
 * redirected — so the first render carried a "Film not found" title, share
 * cards were wrong, and any surface that forgot the redirect dead-ended.
 *
 * The fix is architectural rather than per-page: provider results are turned
 * into canonical local records *before* they reach a component
 * (`ensureMoviesFromSummaries`), and components link through `filmHref`. If you
 * are about to write a template literal starting with `/film/`, use this
 * instead.
 */

/** The minimum a component needs to render and link a film. */
export type FilmLinkable = { slug: string };

export function filmHref(film: FilmLinkable): string {
  return `/film/${encodeURIComponent(film.slug)}`;
}

export function personHref(person: { providerId: string }): string {
  return `/person/${encodeURIComponent(person.providerId)}`;
}

export function userHref(user: { username: string }): string {
  return `/@${encodeURIComponent(user.username)}`;
}

export function userSectionHref(
  user: { username: string },
  section: 'films' | 'diary' | 'reviews' | 'lists' | 'likes' | 'clubs' | 'followers' | 'following',
): string {
  return `${userHref(user)}/${section}`;
}

export function listHref(list: { id: string }): string {
  return `/list/${list.id}`;
}

export function reviewHref(entry: { id: string }): string {
  return `/review/${entry.id}`;
}

export function clubHref(club: { slug: string }): string {
  return `/club/${encodeURIComponent(club.slug)}`;
}

export function screeningHref(club: { slug: string }, screening: { id: string }): string {
  return `${clubHref(club)}/screening/${screening.id}`;
}

/** Sends someone through auth and back to where they were trying to go. */
export function loginHref(next?: string): string {
  return next ? `/login?next=${encodeURIComponent(next)}` : '/login';
}

export function signupHref(next?: string): string {
  return next ? `/signup?next=${encodeURIComponent(next)}` : '/signup';
}
