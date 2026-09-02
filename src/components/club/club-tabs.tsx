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
    ...(isMember ? [{ href: `${base}/queue`, label: 'Movies' }, { href: `${base}/calendar`, label: 'Calendar' }] : []),
    { href: `${base}/history`, label: 'History' },
  ];

  return (
    <nav aria-label="Club sections" className="mobile-tabs -mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 rounded-lg bg-surface/65 p-1 sm:w-fit">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-10 items-center rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-canvas-raised font-medium text-text shadow-sm'
                    : 'text-muted hover:text-text',
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
