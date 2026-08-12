/**
 * The club lifecycle, as a value.
 *
 * A Movie Club is one repeating loop — queue, nominate, decide, reveal,
 * schedule, RSVP, watch, rate, discuss, remember — and the single most useful
 * thing a dashboard can do is answer "where are we, and whose move is it?"
 * before anyone has to read a page. Both the strip at the top of the club page
 * and the copy under it derive from here, so they can never disagree.
 */

export type ClubStage =
  | 'queue'
  | 'nominate'
  | 'decide'
  | 'reveal'
  | 'schedule'
  | 'rsvp'
  | 'watch'
  | 'rate'
  | 'discuss';

export const CLUB_STAGES: { key: ClubStage; label: string }[] = [
  { key: 'queue', label: 'Ideas' },
  { key: 'nominate', label: 'Pick' },
  { key: 'decide', label: 'Decide' },
  { key: 'reveal', label: 'Reveal' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'rsvp', label: 'RSVP' },
  { key: 'watch', label: 'Watch' },
  { key: 'rate', label: 'Rate' },
  { key: 'discuss', label: 'Discuss' },
];

export type ClubStageInput = {
  roundStatus:
    | 'draft'
    | 'nominations_open'
    | 'voting_open'
    | 'winner_selected'
    | 'screening_scheduled'
    | 'completed'
    | 'cancelled'
    | null;
  roundMode: 'vote' | 'wheel' | null;
  /** Milliseconds until the next scheduled screening; null when none. */
  msUntilScreening: number | null;
  /** A finished screening the viewer has not rated yet. */
  awaitingViewerRating: boolean;
  /** A finished screening with ratings in and a discussion open. */
  hasCompletedScreening: boolean;
};

export type ClubState = {
  stage: ClubStage;
  /** What is happening, in one sentence a member can act on. */
  headline: string;
};

/** Screening night counts as "watching" from four hours before it starts. */
const WATCH_WINDOW_MS = 1000 * 60 * 60 * 4;

export function resolveClubState(input: ClubStageInput): ClubState {
  const { roundStatus, roundMode, msUntilScreening, awaitingViewerRating } = input;

  if (awaitingViewerRating) {
    return { stage: 'rate', headline: 'The film is watched — rate it to see how everyone scored it.' };
  }

  if (msUntilScreening !== null) {
    if (msUntilScreening <= WATCH_WINDOW_MS) {
      return { stage: 'watch', headline: 'Tonight is the night. Press play.' };
    }
    return { stage: 'rsvp', headline: 'The night is booked. Say whether you are coming.' };
  }

  switch (roundStatus) {
    case 'nominations_open':
      return {
        stage: 'nominate',
        headline:
          roundMode === 'wheel'
            ? 'Everyone is choosing a movie. The wheel decides when the picks are in.'
            : 'Everyone is choosing a movie. Voting starts when the picks are in.',
      };
    case 'voting_open':
      return { stage: 'decide', headline: 'Voting is open. Pick the one you actually want.' };
    case 'winner_selected':
      return { stage: 'reveal', headline: 'We have a winner. An admin picks a date next.' };
    case 'screening_scheduled':
      return { stage: 'schedule', headline: 'The screening is set. Watch this space.' };
    case 'draft':
      return { stage: 'nominate', headline: 'A round is being set up.' };
    default:
      break;
  }

  if (input.hasCompletedScreening) {
    return {
      stage: 'discuss',
      headline: 'Last film is in the books. Talk about it, or start the next round.',
    };
  }

  return {
    stage: 'queue',
    headline: 'Nothing is being chosen right now. Save ideas, or choose the next movie.',
  };
}
