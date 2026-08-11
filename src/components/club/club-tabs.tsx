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

  const tabs = [
    { href: base, label: 'Dashboard' },
    ...(isMember ? [{ href: `${base}/queue`, label: 'Queue' }] : []),
    { href: `${base}/history`, label: 'History' },
    { href: `${base}/members`, label: 'Members' },
    ...(isAdmin ? [{ href: `${base}/settings`, label: 'Settings' }] : []),
  ];

  return (
    <nav aria-label="Club sections" className="-mx-4 mt-7 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-block border-b-2 px-3 py-2.5 text-sm transition-colors',
                  active
                    ? 'border-iris font-medium text-text'
                    : 'border-transparent text-muted hover:text-text',
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
