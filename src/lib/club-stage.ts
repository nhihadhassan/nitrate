import type { ClubDashboardView } from '@/lib/club';

/**
 * The club's current stage, written for a phone.
 *
 * This is a *presenter*, not a second state machine: `kind` still comes from
 * `deriveClubDashboardView`, so the mobile card and the desktop hero can never
 * disagree about where the club is. What changes here is the words. The
 * desktop hero explains itself in sentences; a phone gets a label, a fact and
 * one action, and lets the artwork carry the rest.
 *
 * Nothing here invents data. Every string is either a fixed label, a count, or
 * something the club actually named.
 */
export type ClubStageCard = {
  kind: ClubDashboardView['kind'];
  /** The eyebrow: "September selection", "Movie night". */
  label: string;
  /** The one fact worth reading: a film title, or a count. */
  headline: string;
  /** A second line only where there is genuinely one — date, location. */
  meta: string | null;
  /** Exactly one primary action, or none when it is not the viewer's move. */
  action: { label: string; href: string } | null;
  /** Shown when the viewer is waiting on other people rather than acting. */
  waitingOn: string | null;
};

export type ClubStageInput = {
  view: ClubDashboardView;
  clubSlug: string;
  inviteCode: string;
  /** "September selection" — already cadence-aware. */
  selectionLabel: string | null;
  /** "September's film". */
  selectionMovieLabel: string | null;
  roundId: string | null;
  screeningId: string | null;
  ratingScreeningId: string | null;
  movieTitle: string | null;
  pickCount: number;
  readyMembers: number;
  participatingMembers: number;
  viewerHasPicked: boolean;
  canSpin: boolean;
  dateLabel: string | null;
  location: string | null;
  /** "Next movie selection in 12 days", when the club is between rounds. */
  nextSelectionLabel: string | null;
  rsvp: 'going' | 'maybe' | 'cant' | null;
};

const RSVP_LABEL: Record<'going' | 'maybe' | 'cant', string> = {
  going: 'Going',
  maybe: 'Maybe',
  cant: 'Can’t',
};

/**
 * Anchors into the mobile tree specifically. The desktop dashboard has its own
 * `#club-decision` / `#club-schedule` sections and both trees are in the DOM at
 * once, so the phone needs ids of its own — linking to the desktop ones lands
 * on an element that is `display: none` at this width and nothing happens.
 */
const DECISION_ANCHOR = 'club-decision-m';
const SCHEDULE_ANCHOR = 'club-schedule-m';

export function resolveClubStageCard(input: ClubStageInput): ClubStageCard {
  const club = `/club/${input.clubSlug}`;
  const selection = input.selectionLabel ?? 'Current selection';
  const picks = `${input.readyMembers} of ${input.participatingMembers} picks in`;

  switch (input.view.kind) {
    case 'join':
      return {
        kind: 'join',
        label: 'Movie Club',
        headline: 'Join this club',
        meta: null,
        action: { label: 'Join', href: `/join/${input.inviteCode}` },
        waitingOn: null,
      };

    case 'pick':
      return {
        kind: 'pick',
        label: selection,
        headline: picks,
        meta: null,
        action: { label: 'Pick your movie', href: `${club}/pick` },
        waitingOn: null,
      };

    // The viewer has picked; the round has not. Their move is over, so the
    // card leads with *their* status and demotes the count — otherwise this
    // reads identically to the card that was asking them to pick.
    case 'waiting':
      return {
        kind: 'waiting',
        label: selection,
        headline: 'Your pick is in',
        meta: picks,
        action: input.roundId ? { label: 'See the picks', href: `${club}/pick` } : null,
        waitingOn: 'Waiting on the rest of the club',
      };

    case 'wheel': {
      // The server refuses to spin fewer than two contenders, so offering the
      // action here would dead-end in an error toast.
      const spinnable = input.pickCount >= 2;
      return {
        kind: 'wheel',
        label: selection,
        headline: `${input.pickCount} ${input.pickCount === 1 ? 'pick' : 'picks'}`,
        meta: null,
        action:
          input.roundId && spinnable
            ? {
                label: input.canSpin ? 'Spin the wheel' : 'Open the wheel',
                href: `${club}/reveal/${input.roundId}`,
              }
            : null,
        waitingOn: !spinnable
          ? 'The wheel needs at least two picks'
          : input.canSpin
            ? null
            : 'Anyone with wheel access can spin',
      };
    }

    // Deliberately says nothing about which film won.
    case 'reveal':
      return {
        kind: 'reveal',
        label: selection,
        headline: 'The wheel has spun',
        meta: null,
        action: input.roundId
          ? { label: 'Watch the reveal', href: `${club}/reveal/${input.roundId}` }
          : null,
        waitingOn: null,
      };

    case 'vote':
      return {
        kind: 'vote',
        label: selection,
        headline: `${input.pickCount} ${input.pickCount === 1 ? 'pick' : 'picks'}`,
        meta: null,
        action: { label: 'Vote', href: `${club}#${DECISION_ANCHOR}` },
        waitingOn: null,
      };

    case 'schedule':
      return {
        kind: 'schedule',
        label: input.selectionMovieLabel ?? selection,
        headline: input.movieTitle ?? 'The film is chosen',
        meta: null,
        action: input.view.actionLabel
          ? { label: 'Plan movie night', href: `${club}#${SCHEDULE_ANCHOR}` }
          : null,
        waitingOn: input.view.actionLabel ? null : 'An admin is picking the date',
      };

    case 'screening':
      return {
        kind: 'screening',
        label: 'Movie night',
        headline: input.movieTitle ?? 'Movie night',
        meta: [input.dateLabel, input.location].filter(Boolean).join(' · ') || null,
        action: input.screeningId
          ? {
              label: input.rsvp ? RSVP_LABEL[input.rsvp] : 'RSVP',
              href: `${club}/screening/${input.screeningId}`,
            }
          : null,
        waitingOn: null,
      };

    case 'rate':
      return {
        kind: 'rate',
        label: 'After movie night',
        headline: input.movieTitle ?? 'Rate the film',
        meta: null,
        action: input.ratingScreeningId
          ? { label: 'Rate it', href: `${club}/screening/${input.ratingScreeningId}` }
          : null,
        waitingOn: null,
      };

    case 'new':
    default:
      return {
        kind: 'new',
        label: 'Movie Club',
        // Not `view.title`: for a club of one that reads "Invite your movie
        // people", which contradicts its own "Start picking" button. The
        // header already says how many members there are.
        headline: input.nextSelectionLabel ?? 'Choose the next movie',
        meta: null,
        action: input.view.actionLabel
          ? {
              label: input.view.actionLabel === 'Add a movie idea' ? 'Add a movie idea' : 'Start picking',
              href: input.view.actionLabel === 'Add a movie idea' ? `${club}/queue` : `${club}#${DECISION_ANCHOR}`,
            }
          : null,
        waitingOn: null,
      };
  }
}
