'use client';

import { useEffect } from 'react';

export function PwaLifecycle() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    const register = () => navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);
  return null;
}
