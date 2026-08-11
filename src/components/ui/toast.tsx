'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

type Toast = {
  id: number;
  message: string;
  tone: 'default' | 'success' | 'error';
  action?: { label: string; onClick: () => void };
};

type ToastInput = Omit<Toast, 'id' | 'tone'> & { tone?: Toast['tone'] };

const ToastContext = createContext<{
  toast: (input: ToastInput | string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput | string) => {
      const normalised = typeof input === 'string' ? { message: input } : input;
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, tone: 'default', ...normalised }]);
      // Undo affordances need longer than a plain confirmation.
      window.setTimeout(() => dismiss(id), normalised.action ? 7000 : 3600);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'animate-rise pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm shadow-pop backdrop-blur',
              t.tone === 'error'
                ? 'border-rose/30 bg-rose/12 text-rose'
                : t.tone === 'success'
                  ? 'border-jade/30 bg-jade/12 text-jade'
                  : 'border-line bg-surface/95 text-text',
            )}
          >
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.action ? (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="shrink-0 rounded-xs font-semibold uppercase tracking-wide text-ember hover:underline"
              >
                {t.action.label}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-dim transition-colors hover:text-text"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context.toast;
}
