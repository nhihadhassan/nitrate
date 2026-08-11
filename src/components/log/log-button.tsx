'use client';

import { useLogDialog } from '@/components/log/log-dialog-provider';
import type { PickedFilm } from '@/components/log/film-picker';
import { Button, type ButtonProps } from '@/components/ui/button';
import { PlusIcon } from '@/components/ui/icons';
import type { Visibility } from '@/lib/types';

export function LogButton({
  film,
  initial,
  label,
  screeningId,
  ...buttonProps
}: {
  film?: PickedFilm;
  initial?: { rating?: number | null; liked?: boolean; watched?: boolean; visibility?: Visibility };
  label?: string;
  screeningId?: string;
} & Omit<ButtonProps, 'onClick' | 'children'>) {
  const { open } = useLogDialog();

  return (
    <Button
      variant="primary"
      {...buttonProps}
      onClick={() => open({ film, initial, screeningId })}
    >
      {!label ? <PlusIcon className="h-4 w-4" /> : null}
      {label ?? 'Log'}
    </Button>
  );
}
