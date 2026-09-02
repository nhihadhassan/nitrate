'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

import { MoreIcon } from '@/components/ui/icons';
import { useToast } from '@/components/ui/toast';
import type { RecommendationReasonKind } from '@/lib/recommendations';
import { cn } from '@/lib/utils';
import { recommendationFeedbackAction } from '@/server/actions/discovery';

const MENU_WIDTH = 160;
const VIEWPORT_MARGIN = 8;

/**
 * The quiet way to tune a recommendation: a small overflow trigger in a
 * poster corner rather than visible "Tune suggestion" text under every card.
 * Meant to be passed as a `Poster`/`PosterCard` `overlay` — it positions
 * itself and renders as a sibling of the film link, never nested inside it.
 *
 * The dropdown itself renders through a portal at `position: fixed`,
 * computed from the trigger's own bounding box: most callers sit inside a
 * horizontally-scrolling rail (`overflow-x: auto`), which would silently
 * clip an absolutely-positioned dropdown for any poster near either edge.
 *
 * Hidden by default on pointer devices (revealed on hover or keyboard focus
 * of the card), always present at a faint, touch-sized opacity on devices
 * with no hover.
 */
export function RecommendationOptionsMenu({
  targetType,
  targetId,
  reasonKind,
  includeAlreadyKnow = false,
  resetBatchOnFeedback = false,
  className,
}: {
  targetType: 'user' | 'movie' | 'person';
  targetId: string;
  reasonKind?: RecommendationReasonKind;
  includeAlreadyKnow?: boolean;
  /** Tonight keeps its hand in the URL, so new feedback must begin at the first hand. */
  resetBatchOnFeedback?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const place = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const left = Math.min(
      Math.max(rect.right - MENU_WIDTH, VIEWPORT_MARGIN),
      window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN,
    );
    setMenuPos({ top: rect.bottom + 4, left });
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    function onViewportChange() {
      place();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
    };
  }, [open]);

  const submit = (kind: 'hide' | 'already_know' | 'less_like_this') => {
    setOpen(false);
    startTransition(async () => {
      const result = await recommendationFeedbackAction({ targetType, targetId, kind, reasonKind });
      if (!result.ok) return toast({ message: result.error, tone: 'error' });
      toast({
        message:
          kind === 'already_know'
            ? 'Marked as someone you already know'
            : kind === 'hide'
              ? 'Hidden for 90 days'
              : 'Adjusted for 30 days',
        tone: 'success',
      });
      const currentUrl = new URL(window.location.href);
      if (resetBatchOnFeedback && currentUrl.searchParams.has('more')) {
        currentUrl.searchParams.delete('more');
        router.push(`${currentUrl.pathname}${currentUrl.search}`, { scroll: false });
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div ref={rootRef} className={cn('absolute right-1.5 top-1.5 z-10', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Recommendation options"
        disabled={pending}
        onClick={(event) => {
          // The button sits over the film link, not inside it — stop the
          // click from doing anything else (and never navigate).
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={cn(
          // 44px touch target on mobile (matches Button's `icon` size), a
          // more compact 36px on hover-capable desktop where it only ever
          // appears on hover/focus in the first place.
          'flex h-11 w-11 items-center justify-center rounded-full bg-canvas/75 text-dim backdrop-blur-sm sm:h-9 sm:w-9',
          'opacity-0 transition-opacity hover:text-text',
          'focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-offset-1',
          'group-hover:opacity-100 group-focus-within:opacity-100',
          // No hover on touch: keep a faint, always-present, properly sized target.
          '[@media(hover:none)]:opacity-60',
        )}
      >
        <MoreIcon className="h-4 w-4" />
      </button>
      {open && menuPos
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label="Recommendation options"
              style={{ top: menuPos.top, left: menuPos.left, width: MENU_WIDTH }}
              className="fixed z-50 rounded-md border border-line bg-canvas-raised p-1 shadow-pop"
            >
              <MenuItem
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  submit('hide');
                }}
              >
                Hide
              </MenuItem>
              {includeAlreadyKnow ? (
                <MenuItem
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    submit('already_know');
                  }}
                >
                  Already know
                </MenuItem>
              ) : (
                <MenuItem
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    submit('less_like_this');
                  }}
                >
                  Less like this
                </MenuItem>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex min-h-9 w-full items-center rounded-xs px-2.5 text-left text-[0.8125rem] text-muted transition-colors hover:bg-surface-hover hover:text-text"
    >
      {children}
    </button>
  );
}
