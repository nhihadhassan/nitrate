'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

export function ProfileTabs({ username, isSelf }: { username: string; isSelf: boolean }) {
  const pathname = usePathname();
  const base = `/@${username}`;
  const normalised = pathname.replace(`/u/${username}`, base);

  const tabs = [
    { href: base, label: 'Profile' },
    { href: `${base}/films`, label: 'Films' },
    { href: `${base}/diary`, label: 'Diary' },
    { href: `${base}/reviews`, label: 'Reviews' },
    { href: `${base}/lists`, label: 'Lists' },
    { href: `${base}/likes`, label: 'Likes' },
    { href: `${base}/clubs`, label: 'Clubs' },
    ...(isSelf ? [{ href: '/watchlist', label: 'Watchlist' }] : []),
  ];

  return (
    <nav aria-label="Profile sections" className="-mx-4 mt-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {tabs.map((tab) => {
          const active = normalised === tab.href || pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-block border-b-2 px-3 py-2.5 text-sm transition-colors',
                  active
                    ? 'border-ember font-medium text-text'
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
