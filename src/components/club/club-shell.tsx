'use client';

import { usePathname } from 'next/navigation';

/**
 * Decides whether a club page gets the club chrome.
 *
 * Almost every club surface wants the header and tabs for orientation. The
 * reveal does not: it is the one screen that should own the whole display, and
 * a cover band plus a tab bar above the winning poster throws the moment away.
 *
 * Doing it here — rather than by moving the route — keeps `/club/[slug]/reveal/
 * [roundId]` exactly where it is, so existing links and emails still work.
 */
export function ClubShell({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isReveal = /\/club\/[^/]+\/reveal\/[^/]+\/?$/.test(pathname);

  if (isReveal) return <div className="min-h-[100dvh]">{children}</div>;

  return (
    <>
      {header}
      <div className="mx-auto w-full max-w-6xl px-4 py-8 pb-20 sm:px-6">{children}</div>
    </>
  );
}
