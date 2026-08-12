import { Slot } from '@/components/ui/slot';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'iris';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-ember text-white hover:bg-ember-soft active:bg-ember disabled:bg-ember/50 shadow-[0_1px_0_rgba(255,255,255,0.12)_inset]',
  iris: 'bg-iris text-white hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface-strong text-text hover:bg-surface-hover border border-line',
  outline: 'border border-line-strong text-text hover:bg-surface-hover hover:border-line-strong',
  ghost: 'text-muted hover:text-text hover:bg-surface-hover',
  danger: 'bg-rose/15 text-rose border border-rose/30 hover:bg-rose/25',
};

const SIZES: Record<Size, string> = {
  sm: 'h-11 px-3 text-[0.8125rem] gap-1.5 sm:h-8',
  md: 'h-11 px-4 text-sm gap-2 sm:h-10',
  lg: 'h-12 px-6 text-[0.9375rem] gap-2',
  icon: 'h-11 w-11 justify-center sm:h-9 sm:w-9',
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
};

export function Button({
  className,
  variant = 'secondary',
  size = 'md',
  asChild,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      // Buttons inside forms default to submit; everything else should not.
      {...(asChild ? {} : { type: type ?? 'button' })}
      className={cn(
        'tactile-button inline-flex touch-manipulation select-none items-center rounded-md font-medium',
        'disabled:pointer-events-none disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
