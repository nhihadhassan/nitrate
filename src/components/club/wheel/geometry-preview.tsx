'use client';

import { useState } from 'react';

import { PosterWheel } from '@/components/club/wheel/poster-wheel';
import { Button } from '@/components/ui/button';

import type { WheelItem } from './types';

/**
 * Development-only harness for tuning the wheel against real artwork at a real
 * phone width. It fakes a *winner index* purely to exercise the animation — no
 * round exists here, nothing is written, and this never ships into a club
 * surface.
 */
export function WheelGeometryPreview({ items }: { items: WheelItem[] }) {
  const [winner, setWinner] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  function spin() {
    const index = Math.floor(Math.random() * items.length);
    setNonce((value) => value + 1);
    setWinner(null);
    requestAnimationFrame(() => setWinner(index));
  }

  return (
    <div className="space-y-8">
      <PosterWheel
        key={nonce}
        hubLabel="Movie Club"
        items={items}
        winnerIndex={winner}
        spinning={winner !== null}
        height={340}
      />

      <div className="flex justify-center">
        <Button variant="iris" size="lg" onClick={spin}>
          Spin
        </Button>
      </div>
    </div>
  );
}
