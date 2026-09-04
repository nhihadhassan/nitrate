'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * One lightweight coordinator for the product's ambient motion. It delegates
 * pointer work instead of installing listeners on every poster and observes
 * streamed route content as it arrives.
 */
export function MotionOrchestrator({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = stageRef.current;
    if (!root) return;
    const observed = new WeakSet<HTMLElement>();
    let observer: IntersectionObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let firstFrame = 0;
    let secondFrame = 0;
    let cancelled = false;

    const start = () => {
      if (cancelled) return;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const reveal = (element: Element) => element.classList.add('is-revealed');
      observer = reduced
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                reveal(entry.target);
                observer?.unobserve(entry.target);
              }
            },
            { rootMargin: '0px 0px -6% 0px', threshold: 0.04 },
          );

      const register = (scope: ParentNode) => {
        const candidates = new Set<HTMLElement>([
          ...(scope instanceof HTMLElement && scope.matches('[data-reveal]') ? [scope] : []),
          ...scope.querySelectorAll<HTMLElement>('[data-reveal]'),
        ]);
        for (const element of candidates) {
          if (observed.has(element)) continue;
          observed.add(element);
          const rect = element.getBoundingClientRect();
          if (reduced || rect.top < window.innerHeight * 0.94) reveal(element);
          else observer?.observe(element);
        }
      };

      // Motion is progressive enhancement: content only becomes reveal-managed
      // after every current target has either been shown or observed. If this
      // coordinator ever fails to run, server-rendered content remains visible.
      register(root);
      root.dataset.motionReady = 'true';

      mutationObserver = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof HTMLElement) register(node);
          }
        }
      });
      mutationObserver.observe(root, { childList: true, subtree: true });
    };

    // Let streamed children finish hydrating before motion mutates their
    // attributes. This avoids React treating harmless reveal bookkeeping as a
    // hydration mismatch.
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(start);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      delete root.dataset.motionReady;
      observer?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [pathname]);

  useEffect(() => {
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let active: HTMLElement | null = null;

    function reset(element: HTMLElement | null) {
      if (!element) return;
      element.style.setProperty('--tilt-x', '0deg');
      element.style.setProperty('--tilt-y', '0deg');
      element.style.setProperty('--light-x', '50%');
      element.style.setProperty('--light-y', '42%');
      element.removeAttribute('data-pointer-active');
    }

    function onPointerMove(event: PointerEvent) {
      if (!finePointer.matches || reducedMotion.matches) return;
      const target = (event.target as Element | null)?.closest<HTMLElement>(
        '[data-poster-depth], [data-pointer-light]',
      );
      if (!target) {
        reset(active);
        active = null;
        return;
      }
      if (active !== target) reset(active);
      active = target;

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
        target.style.setProperty('--light-x', `${(x * 100).toFixed(1)}%`);
        target.style.setProperty('--light-y', `${(y * 100).toFixed(1)}%`);
        if (target.matches('[data-poster-depth]')) {
          target.style.setProperty('--tilt-x', `${((0.5 - y) * 3.2).toFixed(2)}deg`);
          target.style.setProperty('--tilt-y', `${((x - 0.5) * 3.2).toFixed(2)}deg`);
        }
        target.setAttribute('data-pointer-active', 'true');
      });
    }

    function onPointerOut(event: PointerEvent) {
      if (!active) return;
      const next = event.relatedTarget as Node | null;
      if (next && active.contains(next)) return;
      reset(active);
      active = null;
    }

    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerout', onPointerOut, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      reset(active);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerout', onPointerOut);
    };
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;

    function updateViewport() {
      const height = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      document.documentElement.style.setProperty('--mobile-viewport-height', `${height}px`);
      document.documentElement.style.setProperty('--mobile-viewport-offset', `${offsetTop}px`);
      document.documentElement.toggleAttribute(
        'data-keyboard-open',
        window.innerHeight - height > 140,
      );
    }

    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    return () => {
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      frame = 0;
      const y = reduced.matches ? 0 : Math.min(window.scrollY, 420);
      document.documentElement.style.setProperty('--page-scroll', `${y}px`);
      document.documentElement.style.setProperty('--backdrop-shift', `${y * 0.12}px`);
      document.documentElement.style.setProperty('--poster-shift', `${y * -0.025}px`);
      document.documentElement.toggleAttribute('data-scrolled', window.scrollY > 12);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div key={pathname} ref={stageRef} className="route-stage">
      {children}
    </div>
  );
}
