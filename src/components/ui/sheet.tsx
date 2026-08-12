'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { XIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/**
 * One modal surface for the whole app: a bottom sheet on phones, a centred
 * dialog from `sm` up. Handles focus trapping, Escape, scroll locking and the
 * backdrop so no individual feature has to.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeLabel = 'Close',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeLabel?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusTo.current = document.activeElement as HTMLElement | null;

    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      'input, textarea, select, button:not([tabindex="-1"]), [href], [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]):not([tabindex="-1"]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      restoreFocusTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="mobile-viewport-overlay fixed inset-x-0 z-[120] flex items-end justify-center sm:inset-0 sm:items-center">
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="animate-fade absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'animate-sheet relative flex max-h-[calc(var(--mobile-viewport-height,100dvh)-0.5rem)] w-full flex-col overflow-hidden border border-line bg-canvas-raised shadow-pop',
          'rounded-t-xl sm:max-h-[92dvh] sm:animate-rise sm:rounded-xl',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-lg',
          size === 'lg' && 'sm:max-w-2xl',
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-dim">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="-mr-1 flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-md text-dim transition-colors active:scale-95 hover:bg-surface-hover hover:text-text sm:h-8 sm:w-8"
          >
            <XIcon />
          </button>
        </div>

        <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 py-4 sm:px-5">{children}</div>

        {footer ? (
          <div className="shrink-0 border-t border-line bg-canvas-raised px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
