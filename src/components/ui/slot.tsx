'use client';

import { Children, cloneElement, isValidElement, type ReactElement } from 'react';

import { cn } from '@/lib/utils';

/**
 * Minimal `asChild` implementation: merges our props onto the single child
 * element instead of rendering a wrapper. Saves pulling in Radix for one behaviour.
 */
export function Slot({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const child = Children.only(children) as ReactElement<Record<string, unknown>>;
  if (!isValidElement(child)) return null;

  const childProps = child.props as { className?: string };
  return cloneElement(child, {
    ...props,
    className: cn(className, childProps.className),
  });
}
