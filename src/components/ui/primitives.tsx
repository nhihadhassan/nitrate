import Link from 'next/link';

import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

export function Container({
  className,
  children,
  size = 'default',
}: {
  className?: string;
  children: React.ReactNode;
  size?: 'default' | 'wide' | 'narrow';
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-6',
        size === 'narrow' && 'max-w-3xl',
        size === 'default' && 'max-w-6xl',
        size === 'wide' && 'max-w-[86rem]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  title,
  subtitle,
  href,
  linkLabel = 'See all',
  className,
  as: Tag = 'h2',
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  href?: string;
  linkLabel?: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <Tag className="text-xl sm:text-2xl">{title}</Tag>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="shrink-0 text-[0.8125rem] font-medium text-muted transition-colors hover:text-ember"
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('eyebrow', className)}>{children}</p>;
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'empty-state flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? <div className="mb-3 text-dim">{icon}</div> : null}
      <p className="font-display text-xl">{title}</p>
      {description ? <p className="mt-2 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'ember' | 'iris' | 'jade' | 'rose' | 'amber';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-surface-strong text-muted border-line',
    ember: 'bg-ember/12 text-ember border-ember/25',
    iris: 'bg-iris/12 text-iris border-iris/25',
    jade: 'bg-jade/12 text-jade border-jade/25',
    rose: 'bg-rose/12 text-rose border-rose/25',
    amber: 'bg-amber/12 text-amber border-amber/25',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-xs border px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-0 border-t border-line', className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-sm', className)} aria-hidden />;
}

export function PosterGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-[2/3] w-full" />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Form field chrome                                                          */
/* -------------------------------------------------------------------------- */

export const inputClass =
  'w-full rounded-md border border-line bg-canvas-raised px-3 py-2 text-sm text-text placeholder:text-dim ' +
  'transition-colors focus:border-line-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-offset-0';

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  optional,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  optional?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-sm font-medium">
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-dim">Optional</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-rose" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-dim">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose"
    >
      {children}
    </p>
  );
}

export function InfoNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('rounded-md border border-line bg-surface px-3 py-2 text-xs text-muted', className)}>
      {children}
    </p>
  );
}
