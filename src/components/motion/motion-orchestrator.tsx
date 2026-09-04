'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * One lightweight coordinator for the product's ambient motion. It delegates
 * pointer work instead of installing listeners on every poster.
 */
export function MotionOrchestrator({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
    <div key={pathname} className="route-stage">
      {children}
    </div>
  );
}
