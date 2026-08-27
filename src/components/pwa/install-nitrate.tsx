'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export function InstallNitrate() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(window.matchMedia('(display-mode: standalone)').matches);
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const didInstall = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', didInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', didInstall);
    };
  }, []);

  if (installed) {
    return <p className="mt-2 text-xs text-dim">Nitrate is installed on this device.</p>;
  }
  return (
    <div className="mt-3">
      {prompt ? (
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await prompt.prompt();
            const choice = await prompt.userChoice;
            if (choice.outcome === 'accepted') setInstalled(true);
            setPrompt(null);
          }}
        >
          Install Nitrate
        </Button>
      ) : (
        <p className="text-xs leading-relaxed text-dim">
          On iPhone or iPad, use Share then Add to Home Screen. On supported browsers, use Install from the browser menu.
        </p>
      )}
    </div>
  );
}
