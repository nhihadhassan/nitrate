/**
 * The club lifecycle, as a value.
 *
 * A Movie Club is one repeating loop — queue, nominate, decide, reveal,
 * schedule, RSVP, watch, rate, discuss, remember — and the single most useful
 * thing a dashboard can do is answer "where are we, whose move is it, and
 * what happens next?" before anyone has to read a page. The strip at the top
 * of the club page and the round banner underneath both derive their copy
 * from here, so they can never disagree.
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
    // 'draft' is part of the DB enum but unreachable in practice — every
    // round is created directly into 'nominations_open'. It falls through to
    // the same default as no round at all.
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
  /** Whether the viewer holds an admin or owner role in this club. */
  isAdmin: boolean;
  /** Picking is still open — the deadline has not passed and it has not been closed early. */
  pickingOpen: boolean;
  /** Every active member has hit their pick limit, or an admin closed picks early. */
  picksReady: boolean;
  /** The viewer has used all their picks for the current round. */
  hasPicked: boolean;
  /** The viewer has already cast a vote in the current round. */
  hasVoted: boolean;
  /** The viewer has already RSVP'd to the upcoming screening. */
  hasRsvpd: boolean;
  /** Status of the movie-night availability poll for the current round, if any. */
  pollStatus?: 'open' | 'closed' | 'cancelled' | null;
  /** The viewer has marked their availability on at least one poll option. */
  hasRespondedToPoll?: boolean;
  /** At least one member has responded to the poll. */
  pollHasResponses?: boolean;
  /** A wheel outcome exists for this viewer's current round. */
  wheelSpun?: boolean;
  /** The viewer has completed their personal wheel reveal. */
  wheelRevealed?: boolean;
};

export type ClubState = {
  stage: ClubStage;
  /** What is happening, in one sentence a member can act on. */
  headline: string;
  /** The viewer's own next action, in a few words — or null if it is not their move. */
  youNeedTo: string | null;
  /** What happens after this stage, and who does it. */
  next: string;
};

/** Screening night counts as "watching" from four hours before it starts. */
const WATCH_WINDOW_MS = 1000 * 60 * 60 * 4;

export function resolveClubState(input: ClubStageInput): ClubState {
  const {
    roundStatus,
    roundMode,
    msUntilScreening,
    awaitingViewerRating,
    isAdmin,
    pickingOpen,
    picksReady,
    hasPicked,
    hasVoted,
    hasRsvpd,
    pollStatus = null,
    hasRespondedToPoll = false,
    pollHasResponses = false,
    wheelSpun = false,
    wheelRevealed = false,
  } = input;

  if (awaitingViewerRating) {
    return {
      stage: 'rate',
      headline: 'The film is watched — rate it to see how everyone scored it.',
      youNeedTo: 'Rate it',
      next: 'Everyone’s score reveals the moment you rate it.',
    };
  }

  if (msUntilScreening !== null) {
    if (msUntilScreening <= WATCH_WINDOW_MS) {
      return {
        stage: 'watch',
        headline: 'Tonight is the night. Press play.',
        youNeedTo: null,
        next: 'Rate it afterwards to see the group average.',
      };
    }
    return {
      stage: 'rsvp',
      headline: 'The night is booked. Say whether you are coming.',
      youNeedTo: hasRsvpd ? null : 'RSVP',
      next: 'Movie night happens once the date arrives.',
    };
  }

  switch (roundStatus) {
    case 'nominations_open': {
      if (!pickingOpen) {
        return {
          stage: 'nominate',
          headline: 'The pick deadline has passed.',
          youNeedTo: isAdmin ? 'Continue with the picks in, or extend the deadline' : null,
          next: isAdmin ? 'Continue once you are ready, or give it more time.' : 'An admin will continue or extend the deadline.',
        };
      }
      if (roundMode === 'wheel' && picksReady) {
        return {
          stage: 'nominate',
          headline: 'Everyone has picked. The wheel is ready.',
          youNeedTo: 'Spin the wheel',
          next: 'Any member can spin — no re-rolls.',
        };
      }
      return {
        stage: 'nominate',
        headline:
          roundMode === 'wheel'
            ? 'Everyone is choosing a movie. The wheel decides when the picks are in.'
            : 'Everyone is choosing a movie. Voting starts when the picks are in.',
        youNeedTo: hasPicked ? null : 'Pick your movie',
        next:
          roundMode === 'wheel'
            ? 'Any member can spin once the picks are in.'
            : 'An admin opens voting once the picks are in.',
      };
    }
    case 'voting_open':
      return {
        stage: 'decide',
        headline: 'Voting is open. Pick the one you actually want.',
        youNeedTo: hasVoted ? null : 'Cast your vote',
        next: 'An admin closes voting to reveal the winner.',
      };
    case 'winner_selected':
      if (roundMode === 'wheel' && wheelSpun && !wheelRevealed) {
        return {
          stage: 'reveal',
          headline: 'The wheel has been spun. Reveal your club’s pick.',
          youNeedTo: 'Reveal the result',
          next: 'Your reveal is personal — the rest of the club can keep planning movie night.',
        };
      }
      if (pollStatus === 'open') {
        return {
          stage: 'reveal',
          headline: 'We have a winner. Now find a time that works for everyone.',
          youNeedTo: !hasRespondedToPoll
            ? 'Mark your availability'
            : isAdmin && pollHasResponses
              ? 'Confirm a time'
              : null,
          next: isAdmin
            ? 'Confirm the strongest time once responses are in.'
            : 'An admin confirms the final time once responses are in.',
        };
      }
      return {
        stage: 'reveal',
        headline: 'We have a winner.',
        youNeedTo: isAdmin ? 'Schedule movie night' : null,
        next: isAdmin ? 'Pick a date to lock it in.' : 'An admin schedules movie night next.',
      };
    case 'screening_scheduled':
      return {
        stage: 'schedule',
        headline: 'The screening is set. Watch this space.',
        youNeedTo: null,
        next: 'Movie night happens once the date arrives.',
      };
    default:
      break;
  }

  if (input.hasCompletedScreening) {
    return {
      stage: 'discuss',
      headline: 'Last film is in the books. Talk about it, or start the next round.',
      youNeedTo: null,
      next: isAdmin ? 'Choose the next movie when you are ready.' : 'An admin can choose the next movie.',
    };
  }

  return {
    stage: 'queue',
    headline: 'Nothing is being chosen right now. Save ideas, or choose the next movie.',
    youNeedTo: null,
    next: isAdmin ? 'Choose the next movie to start a round.' : 'Save ideas — an admin will choose the next movie.',
  };
}

export type ClubDashboardView = {
  kind: 'join' | 'rate' | 'screening' | 'pick' | 'wheel' | 'reveal' | 'vote' | 'schedule' | 'new' | 'waiting';
  eyebrow: string;
  title: string;
  detail: string | null;
  actionLabel: string | null;
};

export function deriveClubDashboardView(input: {
  isMember: boolean;
  isAdmin: boolean;
  state: ClubState;
  roundStatus: ClubStageInput['roundStatus'];
  roundMode: ClubStageInput['roundMode'];
  picksReady: boolean;
  picksRemaining: number;
  readyMembers: number;
  memberCount: number;
  winnerTitle?: string | null;
  upcomingTitle?: string | null;
  wheelSpun?: boolean;
  wheelRevealed?: boolean;
  selectionMovieLabel?: string;
  nextSelectionLabel?: string;
}): ClubDashboardView {
  if (!input.isMember) return { kind: 'join', eyebrow: 'Movie Club', title: 'Watch with this group', detail: 'Join to see picks, votes and movie nights.', actionLabel: 'Join club' };
  if (input.state.stage === 'rate') return { kind: 'rate', eyebrow: 'After movie night', title: 'How was it?', detail: 'Rate the film to reveal the group score.', actionLabel: 'Rate the film' };
  if (input.upcomingTitle) return { kind: 'screening', eyebrow: 'Next movie night', title: input.upcomingTitle, detail: input.state.youNeedTo === 'RSVP' ? 'Let everyone know if you are coming.' : 'The night is set.', actionLabel: input.state.youNeedTo === 'RSVP' ? 'RSVP' : 'Open movie night' };
  if (input.roundStatus === 'nominations_open') {
    if (input.roundMode === 'wheel' && input.picksReady) return { kind: 'wheel', eyebrow: 'The picks are in', title: 'Spin the wheel', detail: `${input.readyMembers} of ${input.memberCount} members ready`, actionLabel: 'Spin the wheel' };
    if (input.picksRemaining > 0) return { kind: 'pick', eyebrow: 'Your turn', title: 'Pick our next movie', detail: `${input.picksRemaining} ${input.picksRemaining === 1 ? 'pick' : 'picks'} left`, actionLabel: 'Choose a movie' };
    return { kind: 'waiting', eyebrow: 'Picking movies', title: 'Your pick is in', detail: `${input.readyMembers} of ${input.memberCount} members ready`, actionLabel: null };
  }
  if (input.roundMode === 'wheel' && input.roundStatus === 'winner_selected' && input.wheelSpun && !input.wheelRevealed) {
    const selection = input.selectionMovieLabel ?? 'this selection’s movie';
    return { kind: 'reveal', eyebrow: 'The wheel has spoken', title: `Reveal ${selection.startsWith('This ') ? `this ${selection.slice(5)}` : selection}`, detail: 'Your reveal is ready when you are.', actionLabel: 'Reveal the movie' };
  }
  if (input.roundStatus === 'voting_open') return { kind: 'vote', eyebrow: input.state.youNeedTo ? 'Your turn' : 'Voting now', title: 'Time to vote', detail: input.state.youNeedTo ? 'Choose the film you want to watch.' : 'Your vote is in.', actionLabel: input.state.youNeedTo ? 'Vote now' : null };
  if (input.roundStatus === 'winner_selected') return { kind: 'schedule', eyebrow: 'We have a winner', title: input.winnerTitle ? `We're watching ${input.winnerTitle}` : 'Choose a date', detail: input.isAdmin ? 'Set the night or ask when everyone is free.' : 'An admin is choosing the date.', actionLabel: input.isAdmin ? 'Choose a date' : null };
  return { kind: 'new', eyebrow: input.memberCount > 1 ? 'Ready when you are' : 'Your club is ready', title: input.memberCount > 1 ? input.nextSelectionLabel ?? 'Pick the next movie' : 'Invite your movie people', detail: input.isAdmin ? 'Start a round when the group is ready.' : 'Add a Movie Idea while you wait.', actionLabel: input.isAdmin ? 'Start picking' : 'Add a movie idea' };
}
