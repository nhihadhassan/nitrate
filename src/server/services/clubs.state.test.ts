import { describe, expect, it } from 'vitest';

import { canTransition } from './clubs';

/**
 * The round state machine is the one piece of club logic where an illegal
 * transition would corrupt real data (voting on a completed screening, a second
 * winner, and so on), so it gets its own tests.
 */
describe('selection round transitions', () => {
  it('allows the happy path end to end', () => {
    expect(canTransition('draft', 'nominations_open')).toBe(true);
    expect(canTransition('nominations_open', 'voting_open')).toBe(true);
    expect(canTransition('voting_open', 'winner_selected')).toBe(true);
    expect(canTransition('winner_selected', 'screening_scheduled')).toBe(true);
    expect(canTransition('screening_scheduled', 'completed')).toBe(true);
  });

  it('allows cancelling from any live state', () => {
    for (const status of [
      'draft',
      'nominations_open',
      'voting_open',
      'winner_selected',
      'screening_scheduled',
    ] as const) {
      expect(canTransition(status, 'cancelled')).toBe(true);
    }
  });

  it('rejects skipping steps', () => {
    expect(canTransition('draft', 'voting_open')).toBe(false);
    expect(canTransition('draft', 'winner_selected')).toBe(false);
    expect(canTransition('nominations_open', 'screening_scheduled')).toBe(false);
    expect(canTransition('voting_open', 'screening_scheduled')).toBe(false);
  });

  it('lets a wheel round go straight from submissions to a winner', () => {
    // Wheel rounds never enter voting. The edge is structurally legal; only
    // `spinWheel` takes it, and it refuses on a round whose mode is 'vote'
    // (covered by the integration suite against a real round).
    expect(canTransition('nominations_open', 'winner_selected')).toBe(true);
  });

  it('rejects going backwards', () => {
    expect(canTransition('voting_open', 'nominations_open')).toBe(false);
    expect(canTransition('winner_selected', 'voting_open')).toBe(false);
    expect(canTransition('completed', 'screening_scheduled')).toBe(false);
  });

  it('treats completed and cancelled as terminal', () => {
    for (const target of [
      'draft',
      'nominations_open',
      'voting_open',
      'winner_selected',
      'screening_scheduled',
      'completed',
      'cancelled',
    ] as const) {
      expect(canTransition('completed', target)).toBe(false);
      expect(canTransition('cancelled', target)).toBe(false);
    }
  });

  it('allows a winner to complete without a scheduled screening', () => {
    // Some clubs just watch it without formally scheduling.
    expect(canTransition('winner_selected', 'completed')).toBe(true);
  });
});
