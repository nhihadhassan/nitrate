'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { useToast } from '@/components/ui/toast';
import type { ClubPulse } from '@/server/services/clubs';

const ACTIVE_INTERVAL_MS = 5000;
const SLOW_INTERVAL_MS = 20000;
/** Back off to the slow interval after two minutes with nothing changing. */
const SLOWDOWN_AFTER_MS = 2 * 60 * 1000;
/** Stop polling entirely after ten idle minutes; a focus/visibility event resumes it. */
const STOP_AFTER_MS = 10 * 60 * 1000;

/** One short, human line for the transitions worth interrupting someone for. */
function describeChange(prev: ClubPulse, next: ClubPulse): string | null {
  if (prev.round?.status === 'nominations_open' && next.round?.status === 'voting_open') {
    return 'Voting just opened';
  }
  if (prev.round && !prev.round.winnerNominationId && next.round?.winnerNominationId) {
    return next.round.status === 'nominations_open' ? 'The wheel just landed on a winner' : 'A winner was just picked';
  }
  if (prev.round && !prev.round.picksClosedAt && next.round?.picksClosedAt) {
    return 'Picks just closed';
  }
  if (!prev.poll && next.poll) {
    return 'An availability poll just opened';
  }
  if (prev.poll && next.poll && prev.poll.responseCount < next.poll.responseCount) {
    return 'Someone just marked their availability';
  }
  if (prev.poll?.status === 'open' && next.poll?.status === 'closed') {
    return 'A time was just confirmed';
  }
  if (prev.round && !next.round && next.screening && !prev.screening) {
    return 'Movie night was just scheduled';
  }
  if (prev.screening && next.screening && prev.screening.status !== 'completed' && next.screening.status === 'completed') {
    return 'Movie night just wrapped — ratings are open';
  }
  return null;
}

/**
 * Keeps a club round or screening feeling live without a manual reload.
 * Polls the pulse endpoint while the tab is visible, backs off once nothing
 * has moved for a while, and stops after a long idle stretch — resuming the
 * moment the tab regains focus. Mount once per club page; it renders nothing.
 */
export function ClubPulseWatcher({ clubId, screeningId }: { clubId: string; screeningId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const lastRef = useRef<ClubPulse | null>(null);
  const lastChangeAtRef = useRef(Date.now());
  const stoppedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      if (cancelled || document.visibilityState !== 'visible') return;

      try {
        const url = new URL(`/api/club/${clubId}/pulse`, window.location.origin);
        if (screeningId) url.searchParams.set('screeningId', screeningId);
        const res = await fetch(url.toString(), { cache: 'no-store' });
        if (res.ok) {
          const next: ClubPulse = (await res.json()) as ClubPulse;
          const prev = lastRef.current;
          if (prev && JSON.stringify(prev) !== JSON.stringify(next)) {
            lastChangeAtRef.current = Date.now();
            const message = describeChange(prev, next);
            router.refresh();
            if (message) toast(message);
          }
          lastRef.current = next;
        }
      } catch {
        // Offline or a blip — try again next tick.
      }

      if (cancelled || document.visibilityState !== 'visible') return;
      const idleFor = Date.now() - lastChangeAtRef.current;
      if (idleFor > STOP_AFTER_MS) {
        stoppedRef.current = true;
        return;
      }
      timer = window.setTimeout(poll, idleFor > SLOWDOWN_AFTER_MS ? SLOW_INTERVAL_MS : ACTIVE_INTERVAL_MS);
    }

    function onVisible() {
      if (document.visibilityState !== 'visible') return;
      if (timer) window.clearTimeout(timer);
      if (stoppedRef.current) {
        stoppedRef.current = false;
        lastChangeAtRef.current = Date.now();
      }
      poll();
    }

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    poll();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [clubId, screeningId, router, toast]);

  return null;
}
