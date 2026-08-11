'use client';

import { LogDialogProvider } from '@/components/log/log-dialog-provider';
import { ToastProvider } from '@/components/ui/toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <LogDialogProvider>{children}</LogDialogProvider>
    </ToastProvider>
  );
}
