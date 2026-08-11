'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useLogDialog } from '@/components/log/log-dialog-provider';
import type { NavUser } from '@/components/nav/top-nav';
import { ClubIcon, CompassIcon, HomeIcon, PlusIcon, SearchIcon } from '@/components/ui/icons';
import { Avatar } from '@/components/user/avatar';
import { cn } from '@/lib/utils';

/**
 * Mobile-first primary navigation. Logging sits in the middle as a raised
 * action because it is the thing people come back to do every day.
 */
export function BottomNav({ user, unreadCount }: { user: NavUser | null; unreadCount: number }) {
  const pathname = usePathname();
  const { open } = useLogDialog();

  if (pathname.startsWith('/onboarding') || pathname === '/login' || pathname === '/signup') {
    return null;
  }

  const items = [
    { href: '/', label: 'Home', icon: HomeIcon, active: pathname === '/' },
    { href: '/explore', label: 'Explore', icon: CompassIcon, active: pathname.startsWith('/explore') },
    null,
    { href: '/clubs', label: 'Clubs', icon: ClubIcon, active: pathname.startsWith('/club') },
    user
      ? { href: `/@${user.username}`, label: 'You', icon: null, active: pathname.startsWith(`/@${user.username}`) }
      : { href: '/login', label: 'Sign in', icon: SearchIcon, active: false },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-canvas/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto flex h-16 max-w-lg items-stretch">
        {items.map((item, index) =>
          item === null ? (
            <li key="log" className="flex flex-1 items-center justify-center">
              <button
                type="button"
                onClick={() => (user ? open({}) : (window.location.href = '/login'))}
                className="-mt-5 flex h-13 w-13 items-center justify-center rounded-full bg-ember text-white shadow-pop transition-transform active:scale-95"
                style={{ height: '3.25rem', width: '3.25rem' }}
                aria-label="Log a film"
              >
                <PlusIcon className="h-6 w-6" strokeWidth={2} />
              </button>
            </li>
          ) : (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-[0.625rem] font-medium transition-colors',
                  item.active ? 'text-ember' : 'text-dim hover:text-muted',
                )}
              >
                {item.icon ? (
                  <item.icon className="h-[1.35rem] w-[1.35rem]" />
                ) : user ? (
                  <Avatar
                    user={user}
                    size="sm"
                    className={item.active ? 'ring-2 ring-ember' : undefined}
                  />
                ) : null}
                <span>{item.label}</span>
                {index === 4 && unreadCount > 0 ? (
                  <span className="absolute mt-[-1.9rem] ml-5 h-2 w-2 rounded-full bg-ember" />
                ) : null}
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
