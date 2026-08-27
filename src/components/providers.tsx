'use client';

import { LogDialogProvider } from '@/components/log/log-dialog-provider';
import { PwaLifecycle } from '@/components/pwa/pwa-lifecycle';
import { ToastProvider } from '@/components/ui/toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <PwaLifecycle />
      <LogDialogProvider>{children}</LogDialogProvider>
    </ToastProvider>
  );
}
