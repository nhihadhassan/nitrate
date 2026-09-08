'use client';

import { AnimatePresence, motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';

import { DURATION, EASE, SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Shared motion primitives.
 *
 * Everyday chrome stays on CSS transitions — these exist for the handful of
 * moments worth choreographing: a card becoming a screen, a poster becoming a
 * hero. Each one has a real reduced-motion path (same end state, no travel)
 * rather than an animation that simply does not run.
 *
 * Content *entrances* deliberately stay in CSS (`data-reveal`, `.animate-rise`
 * in globals.css). A JavaScript entrance starts the element at opacity 0, and
 * Motion pauses while a tab is hidden — so a club opened in a background tab
 * comes back with its posters still invisible. CSS animations keep running,
 * and nothing here may be the reason content fails to appear.
 */

/**
 * A tactile press. Scales to 0.975 on touch/click the way `.tactile-button`
 * does in CSS, but on elements that also participate in layout animation —
 * where a CSS transform would fight Motion for the transform property.
 */
export function Press({
  children,
  className,
  disabled,
  ...rest
}: HTMLMotionProps<'div'> & { disabled?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      whileTap={disabled || reduced ? undefined : { scale: 0.975 }}
      transition={SPRING.press}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * A poster that can travel between two places in the tree — the wheel and the
 * winner hero, a history card and the night it opens into.
 *
 * Both ends render `<SharedPoster shareId={...}>` with the same id; Motion
 * measures the two boxes and animates one into the other. When the two ends
 * are not mounted together (a real page navigation), this degrades to a plain
 * fade, which is why every caller must still look correct without the morph.
 */
export function SharedPoster({
  shareId,
  children,
  className,
  ...rest
}: HTMLMotionProps<'div'> & { shareId: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      layoutId={reduced ? undefined : shareId}
      className={className}
      transition={SPRING.hero}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * A number that animates *between* values but never counts up from zero on
 * first paint — "6 going" is a fact on arrival and an event only when it
 * changes.
 */
export function TickingCount({ value, className }: { value: number; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <span className={cn('relative inline-block tabular', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className="inline-block"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0, position: 'absolute' } : { opacity: 0, y: -6, position: 'absolute' }}
          transition={{ duration: DURATION.base, ease: EASE.out }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
