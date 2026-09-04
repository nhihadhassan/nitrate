import { describe, expect, it } from 'vitest';

import { deriveClubDashboardView, type ClubState } from './club';

const state = (stage: ClubState['stage'], youNeedTo: string | null = null): ClubState => ({ stage, youNeedTo, headline: '', next: '' });
const base = { isMember: true, isAdmin: true, roundStatus: null, roundMode: null, picksReady: false, picksRemaining: 0, readyMembers: 1, memberCount: 3, state: state('queue') } as const;

describe('club dashboard hero', () => {
  it('prioritizes a due rating over every other state', () => {
    expect(deriveClubDashboardView({ ...base, state: state('rate', 'Rate it'), upcomingTitle: 'Heat' }).kind).toBe('rate');
  });
  it('prioritizes a scheduled movie night over an active round', () => {
    expect(deriveClubDashboardView({ ...base, roundStatus: 'nominations_open', upcomingTitle: 'Heat' }).kind).toBe('screening');
  });
  it('turns wheel readiness into the primary action', () => {
    expect(deriveClubDashboardView({ ...base, roundStatus: 'nominations_open', roundMode: 'wheel', picksReady: true }).kind).toBe('wheel');
  });
  it('shows the viewer their remaining pick', () => {
    expect(deriveClubDashboardView({ ...base, roundStatus: 'nominations_open', roundMode: 'vote', picksRemaining: 1 }).actionLabel).toBe('Choose a movie');
  });
  it('surfaces the cadence period while picks are open', () => {
    expect(deriveClubDashboardView({ ...base, roundStatus: 'nominations_open', roundMode: 'vote', picksRemaining: 1, selectionRoundLabel: 'September movie' }).eyebrow).toBe('September movie');
  });
  it('makes an unviewed wheel result a personal reveal action', () => {
    expect(deriveClubDashboardView({ ...base, roundStatus: 'winner_selected', roundMode: 'wheel', wheelSpun: true, wheelRevealed: false }).kind).toBe('reveal');
  });
  it('uses the club cadence for a personal reveal', () => {
    expect(deriveClubDashboardView({ ...base, roundStatus: 'winner_selected', roundMode: 'wheel', wheelSpun: true, wheelRevealed: false, selectionMovieLabel: 'September’s movie' }).title).toBe('Reveal September’s movie');
  });
  it('uses the cadence due date when no round is active', () => {
    expect(deriveClubDashboardView({ ...base, nextSelectionLabel: 'Next movie selection in 12 days' }).title).toBe('Next movie selection in 12 days');
  });
  it('moves a revealed wheel result into scheduling', () => {
    expect(deriveClubDashboardView({ ...base, roundStatus: 'winner_selected', roundMode: 'wheel', wheelSpun: true, wheelRevealed: true, winnerTitle: 'Heat' }).kind).toBe('schedule');
  });
  it('keeps non-members out of private workflow copy', () => {
    expect(deriveClubDashboardView({ ...base, isMember: false }).kind).toBe('join');
  });
});
