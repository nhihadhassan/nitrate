import { describe, expect, it } from 'vitest';

import { deriveClubDashboardView, resolveClubState, screeningHasPassed } from './club';
import { resolveClubStageCard, type ClubStageInput } from './club-stage';

const HOUR = 60 * 60 * 1000;

const stateInput = (msUntilScreening: number, isAdmin = true) => ({
  roundStatus: 'screening_scheduled' as const,
  roundMode: 'wheel' as const,
  msUntilScreening,
  awaitingViewerRating: false,
  hasCompletedScreening: false,
  isAdmin,
  pickingOpen: false,
  picksReady: true,
  hasPicked: true,
  hasVoted: false,
  hasRsvpd: true,
});

function card(overrides: Partial<ClubStageInput> = {}) {
  const msUntilScreening = -72 * HOUR;
  const state = resolveClubState(stateInput(msUntilScreening));
  return resolveClubStageCard({
    view: deriveClubDashboardView({
      isMember: true,
      isAdmin: true,
      state,
      roundStatus: 'screening_scheduled',
      roundMode: 'wheel',
      picksReady: true,
      picksRemaining: 0,
      readyMembers: 4,
      memberCount: 5,
      upcomingTitle: 'Sinners',
      screeningPast: screeningHasPassed(msUntilScreening),
    }),
    clubSlug: 'velvet',
    inviteCode: 'abc123',
    selectionLabel: 'September selection',
    selectionMovieLabel: 'September’s film',
    roundId: 'round-1',
    screeningId: 'screening-1',
    ratingScreeningId: null,
    movieTitle: 'Sinners',
    pickCount: 5,
    readyMembers: 4,
    participatingMembers: 5,
    viewerHasPicked: true,
    canSpin: true,
    dateLabel: 'Sat Sept 5, 8:00 PM',
    location: null,
    rsvp: 'going',
    nextSelectionLabel: null,
    screeningPast: true,
    ...overrides,
  });
}

/**
 * A screening row stays `scheduled` until a human confirms it, so a night that
 * came and went is indistinguishable from an upcoming one by status alone.
 * Before this, the club sat on "Tonight is the night. Press play." forever and
 * kept offering Going / Maybe / Can't for an evening days in the past.
 */
describe('a booked night that has already happened', () => {
  it('is still in progress during the film', () => {
    expect(screeningHasPassed(-2 * HOUR)).toBe(false);
    expect(resolveClubState(stateInput(-2 * HOUR)).stage).toBe('watch');
    expect(resolveClubState(stateInput(-2 * HOUR)).headline).toContain('Tonight');
  });

  it('stops calling itself tonight once the evening is over', () => {
    expect(screeningHasPassed(-72 * HOUR)).toBe(true);
    const state = resolveClubState(stateInput(-72 * HOUR));
    expect(state.headline).toBe('Movie night has passed.');
    expect(state.headline).not.toContain('Press play');
  });

  it('asks an admin to close it, and tells everyone else who will', () => {
    expect(resolveClubState(stateInput(-72 * HOUR, true)).youNeedTo).toBe('Mark it watched');
    expect(resolveClubState(stateInput(-72 * HOUR, false)).youNeedTo).toBeNull();
  });

  it('never offers an RSVP on the club card', () => {
    expect(card().action?.label).toBe('Mark it watched');
    expect(['Going', 'Maybe', 'Can’t', 'RSVP']).not.toContain(card().action?.label);
  });

  it('sends a member who cannot close it to the night rather than to an RSVP', () => {
    const state = resolveClubState(stateInput(-72 * HOUR, false));
    const view = deriveClubDashboardView({
      isMember: true,
      isAdmin: false,
      state,
      roundStatus: 'screening_scheduled',
      roundMode: 'wheel',
      picksReady: true,
      picksRemaining: 0,
      readyMembers: 4,
      memberCount: 5,
      upcomingTitle: 'Sinners',
      screeningPast: true,
    });
    expect(view.actionLabel).toBe('Open movie night');
    expect(card({ view }).waitingOn).toBe('Waiting on an admin to confirm it');
  });

  it('still says RSVP while the night is genuinely ahead', () => {
    const ms = 48 * HOUR;
    expect(screeningHasPassed(ms)).toBe(false);
    const state = resolveClubState({ ...stateInput(ms), hasRsvpd: false });
    expect(state.youNeedTo).toBe('RSVP');
  });
});
