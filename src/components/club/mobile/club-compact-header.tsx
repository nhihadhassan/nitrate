'use client';

import { useEffect, useRef, useState } from 'react';

/** Keeps the club identity in view after its full photographic header leaves. */
export function ClubCompactHeader({ name }: { name: string }) {
  const markerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 56);
      },
      { rootMargin: '-56px 0px 0px', threshold: 0 },
    );

    observer.observe(marker);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={markerRef} aria-hidden className="h-px" />
      <div
        aria-hidden={!visible}
        className={`fixed inset-x-0 top-14 z-40 border-b border-line bg-canvas/95 px-4 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none lg:hidden ${
          visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
        }`}
      >
        <div className="mx-auto flex h-11 max-w-6xl items-center">
          <p className="truncate text-sm font-medium text-text">{name}</p>
        </div>
      </div>
    </>
  );
}
