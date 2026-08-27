import Image from 'next/image';

import { logoUrl } from '@/lib/images';
import type { WatchAvailability, WatchOption } from '@/server/movies/provider/types';

const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

function regionLabel(region: string): string {
  try {
    return REGION_NAMES.of(region) ?? region;
  } catch {
    return region;
  }
}

function ProviderRow({ options }: { options: WatchOption[] }) {
  const shown = [...options].sort((a, b) => a.displayPriority - b.displayPriority).slice(0, 6);
  return (
    <ul className="flex flex-wrap gap-2">
      {shown.map((option) => (
        <li key={option.providerId} title={option.name}>
          {logoUrl(option.logoPath) ? (
            <Image
              src={logoUrl(option.logoPath)!}
              alt={option.name}
              width={36}
              height={36}
              className="rounded-sm"
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-surface-strong text-[0.625rem] text-dim">
              {option.name.slice(0, 2)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Restrained on purpose: recognisable provider logos, no promotional copy, and
 * the section simply does not render when there is nothing honest to show —
 * no data for this region, TMDB unreachable, or the film has none listed.
 *
 * Attribution is required by TMDB's terms for watch-provider data: it is
 * sourced from JustWatch, and the only outbound link is TMDB's own watch page
 * for this title — never a fabricated deep link to a specific service.
 */
export function WhereToWatch({ availability }: { availability: WatchAvailability | null }) {
  if (!availability) return null;

  const { stream, rent, buy, free, link, region } = availability;
  if (!stream.length && !rent.length && !buy.length && !free.length) return null;

  return (
    <section className="rounded-lg border border-ember/25 bg-ember/[0.045] p-3.5">
      <p className="eyebrow text-ember">Where to watch</p>
      <div className="mt-2.5 space-y-3">
        {stream.length ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Stream</p>
            <ProviderRow options={stream} />
          </div>
        ) : null}
        {rent.length ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Rent</p>
            <ProviderRow options={rent} />
          </div>
        ) : null}
        {buy.length ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Buy</p>
            <ProviderRow options={buy} />
          </div>
        ) : null}
        {free.length ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Free</p>
            <ProviderRow options={free} />
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-[0.6875rem] text-dim">
        In {regionLabel(region)}. Streaming data from JustWatch, via TMDB.
        {link ? (
          <>
            {' '}
            <a href={link} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-muted">
              More options
            </a>
          </>
        ) : null}
      </p>
    </section>
  );
}
