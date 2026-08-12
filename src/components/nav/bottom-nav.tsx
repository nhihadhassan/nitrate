'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useLogDialog } from '@/components/log/log-dialog-provider';
import type { NavUser } from '@/components/nav/top-nav';
import { ClubIcon, CompassIcon, HomeIcon, PlusIcon, UserIcon } from '@/components/ui/icons';
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
      : { href: '/login', label: 'Sign in', icon: UserIcon, active: false },
  ];

  return (
    <nav
      aria-label="Primary"
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-line bg-canvas/92 pb-[max(env(safe-area-inset-bottom),0.25rem)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto flex h-[4.125rem] max-w-lg items-stretch px-1">
        {items.map((item, index) =>
          item === null ? (
            <li key="log" className="flex flex-1 items-center justify-center">
              <button
                type="button"
                onClick={() => (user ? open({}) : (window.location.href = '/login'))}
                className="-mt-5 flex h-13 w-13 touch-manipulation items-center justify-center rounded-full bg-ember text-white shadow-pop transition-transform active:scale-95"
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
                  'relative flex h-full min-w-0 touch-manipulation flex-col items-center justify-center gap-1 overflow-hidden px-0.5 text-[0.625rem] font-medium transition-colors active:scale-[0.96]',
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
                <span className="max-w-full truncate">{item.label}</span>
                {index === 4 && unreadCount > 0 ? (
                  <span className="absolute left-1/2 top-2.5 ml-2 h-2 w-2 rounded-full bg-ember ring-2 ring-canvas" />
                ) : null}
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
