'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/settings', label: 'Profile' },
  { href: '/settings/favorites', label: 'Favourite films' },
  { href: '/settings/privacy', label: 'Privacy' },
  { href: '/settings/notifications', label: 'Email' },
  { href: '/settings/sharing', label: 'Sharing' },
  { href: '/import', label: 'Import' },
  { href: '/settings/account', label: 'Account' },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections" className="mobile-tabs -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1 border-b border-line md:min-w-0 md:flex-col md:border-b-0 md:border-l md:border-line">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center px-3 py-2 text-sm transition-colors md:-ml-px md:block md:min-h-0 md:border-l-2',
                  active
                    ? 'font-medium text-text md:border-ember'
                    : 'text-muted hover:text-text md:border-transparent',
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
