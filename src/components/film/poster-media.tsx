'use client';

import Image from 'next/image';
import { useState } from 'react';

import { cn } from '@/lib/utils';

export function PosterMedia({
  src,
  sizes,
  priority,
}: {
  src: string;
  sizes: string;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <span aria-hidden className={cn('poster-placeholder', loaded && 'is-loaded')} />
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
        onLoad={() => setLoaded(true)}
        className={cn('poster-image object-cover', loaded && 'is-loaded')}
      />
    </>
  );
}
