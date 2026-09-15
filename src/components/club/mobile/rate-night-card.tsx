import Image from 'next/image';
import Link from 'next/link';

import { backdropUrl, posterUrl } from '@/lib/images';

/**
 * The night just watched, given the same big-artwork treatment as
 * `MovieNightCard` (the night still to come). Rating is the one thing left
 * to do about a film the club just watched together, and that earns the film's
 * own poster as the card, not a small thumbnail next to a button.
 */
export function RateNightCard({
  href,
  title,
  posterPath,
  backdropPath,
}: {
  href: string;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
}) {
  const art = posterUrl(posterPath, 'lg') ?? backdropUrl(backdropPath, 'md');

  return (
    <section
      aria-labelledby="rate-night-title"
      className="relative overflow-hidden rounded-2xl border border-iris/40 bg-canvas-raised"
      style={{ boxShadow: '0 18px 40px -24px color-mix(in srgb, var(--iris) 55%, transparent)' }}
    >
      <Link href={href} className="relative block aspect-[4/5] w-full">
        {art ? (
          <Image
            src={art}
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 100vw, 480px"
            className="object-cover object-center"
          />
        ) : (
          <span aria-hidden className="absolute inset-0 bg-surface-strong" />
        )}

        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent"
        />
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-canvas-raised via-canvas-raised/85 to-transparent"
        />

        <p className="absolute left-4 top-4 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-iris">
          After movie night
        </p>

        <span className="absolute inset-x-4 bottom-4">
          <span
            id="rate-night-title"
            className="block font-display text-[1.875rem] leading-[1.05] text-white"
          >
            {title}
          </span>
          <span className="mt-1 block text-[0.9375rem] text-white/85">How was it?</span>
        </span>
      </Link>

      <div className="p-4 pt-1">
        <Link
          href={href}
          className="flex min-h-12 w-full items-center justify-center rounded-full bg-iris px-5 text-[0.9375rem] font-medium text-inverse focus-visible:outline-2 focus-visible:outline-iris focus-visible:outline-offset-2"
        >
          Rate it
        </Link>
      </div>
    </section>
  );
}
