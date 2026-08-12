'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * One lightweight coordinator for the product's ambient motion. It delegates
 * pointer work instead of installing listeners on every poster and observes
 * streamed route content as it arrives.
 */
export function MotionOrchestrator({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const stageRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = stageRef.current;
    if (!root) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reveal = (element: Element) => element.classList.add('is-revealed');
    const observer = reduced
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
        ...(scope instanceof HTMLElement &&
        (scope.matches('[data-reveal]') || scope.matches('section'))
          ? [scope]
          : []),
        ...scope.querySelectorAll<HTMLElement>('[data-reveal]'),
        ...scope.querySelectorAll<HTMLElement>('section'),
      ]);
      for (const element of candidates) {
        if (!element.dataset.reveal) element.dataset.reveal = 'section';
        if (element.dataset.motionObserved) continue;
        element.dataset.motionObserved = 'true';
        const rect = element.getBoundingClientRect();
        if (reduced || rect.top < window.innerHeight * 0.94) reveal(element);
        else observer?.observe(element);
      }
    };

    register(root);
    const mutationObserver = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement) register(node);
        }
      }
    });
    mutationObserver.observe(root, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      mutationObserver.disconnect();
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
