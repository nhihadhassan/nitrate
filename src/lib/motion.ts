/**
 * The motion vocabulary, as values.
 *
 * Everything that moves in the club experience reads its timing from here, so
 * a press in the pick sheet, a sheet entrance and the wheel's final settle all
 * belong to the same hand. The numbers mirror the CSS custom properties in
 * `globals.css` — `--duration-fast`, `--duration-base`, `--duration-slow` —
 * rather than competing with them: CSS keeps owning hover, colour and border
 * transitions, and these values own the choreography Motion drives.
 *
 * Durations are in seconds because that is what Motion takes.
 */

/** Cubic-bezier control points, matching the CSS easing tokens by name. */
export const EASE = {
  /** `--ease-out` — everyday UI. */
  out: [0.22, 1, 0.36, 1],
  /** `--ease-out-expo` — deliberate reveals, sheets, heroes. */
  outExpo: [0.16, 1, 0.3, 1],
  /** Symmetric, for things that leave the way they arrived. */
  inOut: [0.65, 0, 0.35, 1],
  /** `--ease-wheel` — the club wheel only. */
  wheel: [0.08, 0.72, 0.12, 1],
} as const;

export const DURATION = {
  /** 140ms — press, hover, colour. */
  press: 0.14,
  /** 220ms — the default for state that changes in place. */
  base: 0.22,
  /** 300ms — sheets, tab indicators, RSVP commitment. */
  sheet: 0.3,
  /** 420ms — deliberate reveals. */
  slow: 0.42,
  /** 520ms — hero and page-level transitions, the poster→winner morph. */
  hero: 0.52,
} as const;

/** Spring for anything that should feel physical rather than timed. */
export const SPRING = {
  /** Press and selection: settles fast, barely overshoots. */
  press: { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 },
  /** Layout moves — attendee avatars rearranging, counts changing. */
  layout: { type: 'spring', stiffness: 360, damping: 32, mass: 0.9 },
  /** The winner poster arriving in its hero slot. */
  hero: { type: 'spring', stiffness: 220, damping: 28, mass: 1 },
} as const;

/**
 * The wheel's full sequence, in seconds. Read by the spin driver; exported so
 * the copy ("about five seconds") and the tests can agree with the animation.
 *
 *   windUp   a short pull-back before it commits
 *   accelerate  into the cruise
 *   cruise   full speed, artwork blurring past
 *   decelerate  the long slow-down that does the emotional work
 *   suspense  near-stopped, creeping the last fraction of a slot
 *   settle   the small final drop into place
 */
export const WHEEL = {
  windUp: 0.32,
  accelerate: 0.9,
  cruise: 1.1,
  decelerate: 2.4,
  suspense: 0.85,
  settle: 0.35,
  /** Beat between the wheel stopping and the winner taking over the screen. */
  revealHold: 0.5,
} as const;

export const WHEEL_TOTAL_MS =
  (WHEEL.windUp +
    WHEEL.accelerate +
    WHEEL.cruise +
    WHEEL.decelerate +
    WHEEL.suspense +
    WHEEL.settle) *
  1000;
