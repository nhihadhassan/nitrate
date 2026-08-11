'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { LogSheet, type LogSheetSeed } from '@/components/log/log-sheet';

type OpenOptions = LogSheetSeed;

const LogDialogContext = createContext<{
  open: (options: OpenOptions) => void;
  close: () => void;
} | null>(null);

/**
 * Logging is reachable from every surface — the nav, a film page, a feed card, a
 * finished screening — so the sheet lives once at the root and is opened through
 * context rather than re-mounted per call site.
 */
export function LogDialogProvider({ children }: { children: React.ReactNode }) {
  const [seed, setSeed] = useState<OpenOptions | null>(null);
  const router = useRouter();

  const open = useCallback((options: OpenOptions) => setSeed(options), []);
  const close = useCallback(() => setSeed(null), []);

  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <LogDialogContext.Provider value={value}>
      {children}
      {seed ? (
        <LogSheet
          seed={seed}
          onClose={close}
          onLogged={() => {
            close();
            router.refresh();
          }}
        />
      ) : null}
    </LogDialogContext.Provider>
  );
}

export function useLogDialog() {
  const context = useContext(LogDialogContext);
  if (!context) throw new Error('useLogDialog must be used inside <LogDialogProvider>');
  return context;
}
