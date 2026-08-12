/** Shared client-safe shapes. Server types live next to their schema. */

/**
 * A film, reduced to what it takes to show and link one.
 *
 * `slug` is always the *canonical* local slug — never a provider id. Server
 * code produces these through `toFilmRef` / `filmRefsFromSummaries`, so any
 * component holding a `FilmRef` can link with `filmHref` and be certain the URL
 * resolves on the first request.
 */
export type FilmRef = {
  id: string;
  slug: string;
  title: string;
  year: number | null;
  posterPath: string | null;
};

export type UserRef = {
  id: string;
  username: string;
  displayName: string;
  avatarAssetId: string | null;
};

export type Visibility = 'public' | 'followers' | 'private';

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: 'Anyone',
  followers: 'Followers only',
  private: 'Only me',
};

export const VISIBILITY_HINTS: Record<Visibility, string> = {
  public: 'Shown on your profile and in feeds.',
  followers: 'Only people who follow you can see this.',
  private: 'Kept entirely to yourself.',
};

export type RsvpStatus = 'going' | 'maybe' | 'cant';

export const RSVP_LABELS: Record<RsvpStatus, string> = {
  going: 'Going',
  maybe: 'Maybe',
  cant: "Can't make it",
};

export type RoundStatus =
  | 'draft'
  | 'nominations_open'
  | 'voting_open'
  | 'winner_selected'
  | 'screening_scheduled'
  | 'completed'
  | 'cancelled';

export const ROUND_STATUS_LABELS: Record<RoundStatus, string> = {
  draft: 'Draft',
  nominations_open: 'Picking movies',
  voting_open: 'Voting open',
  winner_selected: 'Winner selected',
  screening_scheduled: 'Screening scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const REPORT_CATEGORY_LABELS = {
  spam: 'Spam or scam',
  harassment: 'Harassment or bullying',
  hate_speech: 'Hate speech',
  sexual_content: 'Sexual content',
  violence: 'Violence or threats',
  self_harm: 'Self-harm',
  spoilers: 'Unmarked spoilers',
  misinformation: 'Misinformation',
  impersonation: 'Impersonation',
  other: 'Something else',
} as const;

export type ReportCategory = keyof typeof REPORT_CATEGORY_LABELS;

export type ReportSubjectType = 'user' | 'review' | 'comment' | 'list' | 'club' | 'club_post';
