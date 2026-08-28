'use client';

import { Children, cloneElement, isValidElement, type ReactElement } from 'react';

import { cn } from '@/lib/utils';

/**
 * Minimal `asChild` implementation: merges our props onto the single child
 * element instead of rendering a wrapper. Saves pulling in Radix for one behaviour.
 *
 * Deliberately more forgiving than `Children.only` (which throws the moment
 * `children` isn't *exactly* one element — including on stray whitespace or
 * comment nodes some render paths can introduce). `Children.toArray` strips
 * those and flattens fragments first, so the intended single child still
 * resolves; if genuinely nothing valid is there, this renders nothing rather
 * than taking the whole page down with it.
 */
export function Slot({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const child = Children.toArray(children).find(isValidElement) as
    | ReactElement<Record<string, unknown>>
    | undefined;
  if (!child) return null;

  const childProps = child.props as { className?: string };
  return cloneElement(child, {
    ...props,
    className: cn(className, childProps.className),
  });
}
