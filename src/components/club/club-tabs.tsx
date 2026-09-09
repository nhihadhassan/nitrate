'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

export function ClubTabs({
  slug,
  isMember,
  isAdmin,
}: {
  slug: string;
  isMember: boolean;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const base = `/club/${slug}`;

  void isAdmin;
  const tabs = [
    { href: base, label: 'Club' },
    ...(isMember ? [{ href: `${base}/queue`, label: 'Movies' }] : []),
    { href: `${base}/history`, label: 'Past Movies' },
  ];

  return (
    <nav aria-label="Club sections" className="mt-4 pb-3 sm:mt-5 sm:pb-0">
      <ul
        className="grid overflow-hidden rounded-xl border border-line bg-canvas/70 p-1 shadow-[inset_0_1px_0_rgb(255_255_255/0.025)] sm:w-full lg:w-fit lg:min-w-[30rem]"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href} className="min-w-0">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-12 items-center justify-center rounded-lg px-2 py-2 text-sm transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:rounded-full after:bg-ember after:transition-transform after:duration-200 after:ease-out',
                  active
                    ? 'bg-[radial-gradient(circle_at_50%_115%,rgb(234_88_50/0.2),transparent_68%)] font-medium text-text after:scale-x-100'
                    : 'text-muted after:scale-x-0 hover:bg-surface/55 hover:text-text',
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
