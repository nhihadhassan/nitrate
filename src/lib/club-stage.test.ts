import { describe, expect, it } from 'vitest';

import { deriveClubDashboardView, type ClubState } from './club';
import { resolveClubStageCard, type ClubStageInput } from './club-stage';

const state = (stage: ClubState['stage'], youNeedTo: string | null = null): ClubState => ({
  stage,
  youNeedTo,
  headline: '',
  next: '',
});

const viewBase = {
  isMember: true,
  isAdmin: true,
  roundStatus: null,
  roundMode: null,
  picksReady: false,
  picksRemaining: 0,
  readyMembers: 1,
  memberCount: 8,
  state: state('queue'),
} as const;

function card(
  view: Parameters<typeof deriveClubDashboardView>[0],
  overrides: Partial<ClubStageInput> = {},
) {
  return resolveClubStageCard({
    view: deriveClubDashboardView(view),
    clubSlug: 'velvet',
    inviteCode: 'abc123',
    selectionLabel: 'September selection',
    selectionMovieLabel: 'September’s film',
    roundId: 'round-1',
    screeningId: 'screening-1',
    ratingScreeningId: 'screening-0',
    movieTitle: 'Sinners',
    pickCount: 8,
    readyMembers: 5,
    participatingMembers: 8,
    viewerHasPicked: false,
    canSpin: true,
    dateLabel: 'Sat, Sep 27 · 7:00 PM',
    location: 'Maya’s House',
    rsvp: null,
    nextSelectionLabel: 'Next movie selection in 12 days',
    ...overrides,
  });
}

describe('club stage card', () => {
  it('states the pick count as a fact and offers one action', () => {
    const result = card({ ...viewBase, roundStatus: 'nominations_open', roundMode: 'wheel', picksRemaining: 1 });
    expect(result.label).toBe('September selection');
    expect(result.headline).toBe('5 of 8 picks in');
    expect(result.action).toEqual({ label: 'Pick your movie', href: '/club/velvet/pick' });
  });

  it('stops asking once the viewer has picked', () => {
    const result = card({ ...viewBase, roundStatus: 'nominations_open', roundMode: 'wheel', picksRemaining: 0 });
    expect(result.kind).toBe('waiting');
    // Distinct from the "pick your movie" card, which leads with the count.
    expect(result.headline).toBe('Your pick is in');
    expect(result.meta).toBe('5 of 8 picks in');
    expect(result.waitingOn).toBe('Waiting on the rest of the club');
    expect(result.action?.label).toBe('See the picks');
  });

  it('sends a ready wheel straight to the reveal route', () => {
    const result = card({
      ...viewBase,
      roundStatus: 'nominations_open',
      roundMode: 'wheel',
      picksReady: true,
    });
    expect(result.headline).toBe('8 picks');
    expect(result.action).toEqual({ label: 'Spin the wheel', href: '/club/velvet/reveal/round-1' });
  });

  it('will not offer a spin the server would refuse', () => {
    const result = card(
      { ...viewBase, roundStatus: 'nominations_open', roundMode: 'wheel', picksReady: true },
      { pickCount: 1 },
    );
    expect(result.headline).toBe('1 pick');
    expect(result.action).toBeNull();
    expect(result.waitingOn).toBe('The wheel needs at least two picks');
  });

  it('tells a member without wheel access who can spin', () => {
    const result = card(
      { ...viewBase, roundStatus: 'nominations_open', roundMode: 'wheel', picksReady: true },
      { canSpin: false },
    );
    expect(result.action?.label).toBe('Open the wheel');
    expect(result.waitingOn).toBe('Anyone with wheel access can spin');
  });

  // The whole point of the personal reveal: the card must not leak the result.
  it('never names the winning film before the viewer has revealed it', () => {
    const result = card({
      ...viewBase,
      roundStatus: 'winner_selected',
      roundMode: 'wheel',
      wheelSpun: true,
      wheelRevealed: false,
      winnerTitle: 'Sinners',
    });
    expect(result.kind).toBe('reveal');
    expect(result.headline).toBe('The wheel has spun');
    expect(JSON.stringify(result)).not.toContain('Sinners');
  });

  it('names the film once the reveal is done', () => {
    const result = card({
      ...viewBase,
      roundStatus: 'winner_selected',
      roundMode: 'wheel',
      wheelSpun: true,
      wheelRevealed: true,
      winnerTitle: 'Sinners',
    });
    expect(result.label).toBe('September’s film');
    expect(result.headline).toBe('Sinners');
    expect(result.action?.label).toBe('Plan movie night');
  });

  it('puts the date and place on a scheduled night', () => {
    const result = card({ ...viewBase, upcomingTitle: 'Sinners' });
    expect(result.label).toBe('Movie night');
    expect(result.meta).toBe('Sat, Sep 27 · 7:00 PM · Maya’s House');
    expect(result.action?.label).toBe('RSVP');
  });

  it('shows an existing RSVP instead of asking again', () => {
    const result = card({ ...viewBase, upcomingTitle: 'Sinners' }, { rsvp: 'going' });
    expect(result.action?.label).toBe('Going');
  });

  it('offers a non-member the join action only', () => {
    const result = card({ ...viewBase, isMember: false });
    expect(result.action).toEqual({ label: 'Join', href: '/join/abc123' });
  });

  it('drops the action when a member cannot schedule', () => {
    const result = card({
      ...viewBase,
      isAdmin: false,
      roundStatus: 'winner_selected',
      roundMode: 'wheel',
      wheelSpun: true,
      wheelRevealed: true,
      winnerTitle: 'Sinners',
    });
    expect(result.action).toBeNull();
    expect(result.waitingOn).toBe('An admin is picking the date');
  });
});
