'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { LogButton } from '@/components/log/log-button';
import { ThemeToggle } from '@/components/nav/theme-toggle';
import { QuickSearch, useQuickSearchHotkey } from '@/components/search/quick-search';
import { BellIcon, ChevronDownIcon, SearchIcon, ShieldIcon } from '@/components/ui/icons';
import { Avatar } from '@/components/user/avatar';
import { BRAND } from '@/lib/brand';
import { userHref, userSectionHref } from '@/lib/links';
import { cn } from '@/lib/utils';

export type NavUser = {
  id: string;
  username: string;
  displayName: string;
  avatarAssetId: string | null;
  role: 'member' | 'moderator' | 'admin';
  onboarded: boolean;
};

const LINKS = [
  { href: '/', label: 'Home', match: (p: string) => p === '/' },
  { href: '/explore', label: 'Explore', match: (p: string) => p.startsWith('/explore') },
  { href: '/films', label: 'Films', match: (p: string) => p.startsWith('/films') },
  { href: '/clubs', label: 'Clubs', match: (p: string) => p.startsWith('/club') },
  { href: '/network', label: 'Network', match: (p: string) => p.startsWith('/network') },
];

export function TopNav({ user, unreadCount }: { user: NavUser | null; unreadCount: number }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  useQuickSearchHotkey(openSearch);

  return (
    <header className="nav-shell sticky top-0 z-50 border-b border-line bg-canvas/85 backdrop-blur-xl">
      <QuickSearch open={searchOpen} onClose={closeSearch} />
      <div className="mx-auto flex h-14 max-w-[86rem] items-center gap-1.5 px-3 min-[360px]:gap-2 sm:gap-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 pr-1" aria-label={`${BRAND.name} home`}>
          <Wordmark />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-0.5 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.match(pathname) ? 'page' : undefined}
              className={cn(
                'nav-link rounded-md px-3 py-1.5 text-sm transition-colors',
                link.href === '/network' && 'hidden lg:block',
                link.match(pathname)
                  ? 'font-medium text-text'
                  : 'text-muted hover:bg-surface-hover hover:text-text',
              )}
              data-active={link.match(pathname) ? 'true' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={openSearch}
            aria-label="Search"
            className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-md text-muted transition-colors active:scale-95 hover:bg-surface-hover hover:text-text md:hidden"
          >
            <SearchIcon />
          </button>
          <div className="hidden md:block">
            <SearchTrigger onClick={openSearch} />
          </div>

          {user ? (
            <>
              <div className="hidden sm:block">
                <LogButton size="sm" />
              </div>
              <Link
                href="/notifications"
                aria-label={
                  unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'
                }
                className="relative flex h-11 w-11 touch-manipulation items-center justify-center rounded-md text-muted transition-colors active:scale-95 hover:bg-surface-hover hover:text-text sm:h-9 sm:w-9"
              >
                <BellIcon />
                {unreadCount > 0 ? (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember px-1 text-[0.5625rem] font-bold text-white tabular">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                ) : null}
              </Link>
              <AccountMenu user={user} />
            </>
          ) : (
            <>
              <ThemeToggle />
              <Link
                href="/login"
                className="hidden min-h-11 items-center rounded-md px-2 text-sm text-muted transition-colors hover:text-text min-[350px]:flex sm:min-h-0 sm:px-3 sm:py-1.5"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="flex min-h-11 items-center rounded-md bg-ember px-3 text-sm font-medium text-white transition-colors active:scale-[0.98] hover:bg-ember-soft sm:min-h-0 sm:py-1.5"
              >
                Join
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Film-reel mark plus the product name. The mark alone carries the smallest
 * breakpoints, where every pixel of the nav is spoken for.
 */
function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        <span className="absolute inset-0 rounded-[4px] bg-ember" />
        <span className="absolute inset-x-[5px] inset-y-[3px] rounded-[1px] bg-canvas" />
        <span className="absolute left-[3px] top-[5px] h-[2px] w-[2px] rounded-full bg-canvas" />
        <span className="absolute bottom-[5px] left-[3px] h-[2px] w-[2px] rounded-full bg-canvas" />
        <span className="absolute right-[3px] top-[5px] h-[2px] w-[2px] rounded-full bg-canvas" />
        <span className="absolute bottom-[5px] right-[3px] h-[2px] w-[2px] rounded-full bg-canvas" />
      </span>
      <span className="hidden font-display text-[1.2rem] leading-none tracking-tight min-[390px]:inline">
        {BRAND.name}
      </span>
    </span>
  );
}

function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-48 items-center gap-2 rounded-md border border-line bg-canvas-raised px-2.5 text-sm text-dim transition-colors hover:border-line-strong lg:w-64"
    >
      <SearchIcon className="h-4 w-4" />
      <span className="flex-1 text-left">Films, people, clubs…</span>
      <kbd className="hidden rounded-xs border border-line px-1 py-px text-[0.625rem] lg:block">
        ⌘K
      </kbd>
    </button>
  );
}

function AccountMenu({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = [
    { href: userHref(user), label: 'Your profile' },
    { href: userSectionHref(user, 'diary'), label: 'Diary' },
    { href: userSectionHref(user, 'films'), label: 'Films' },
    { href: userSectionHref(user, 'lists'), label: 'Lists' },
    { href: '/lists', label: 'List library' },
    { href: '/watchlist', label: 'Watchlist' },
    { href: '/tonight', label: 'Tonight' },
    { href: '/taste-circle', label: 'Taste circle' },
    { href: '/settings', label: 'Settings' },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1 rounded-md p-0.5 pr-1 transition-colors hover:bg-surface-hover"
      >
        <Avatar user={user} size="md" />
        <ChevronDownIcon className="h-3.5 w-3.5 text-dim" />
        <span className="sr-only">Account menu</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-rise fixed inset-x-3 top-[4.25rem] max-h-[calc(var(--mobile-viewport-height,100dvh)-5rem)] overflow-y-auto rounded-lg border border-line bg-canvas-raised py-1 shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+0.5rem)] sm:w-56"
        >
          <div className="border-b border-line px-3 py-2.5">
            <p className="truncate text-sm font-medium">{user.displayName}</p>
            <p className="truncate text-xs text-dim">@{user.username}</p>
          </div>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              className="flex min-h-11 items-center px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-text sm:min-h-0"
            >
              {item.label}
            </Link>
          ))}
          {user.role !== 'member' ? (
            <Link
              href="/admin"
              role="menuitem"
              className="flex items-center gap-2 border-t border-line px-3 py-2 text-sm text-iris transition-colors hover:bg-surface-hover"
            >
              <ShieldIcon className="h-4 w-4" />
              Moderation
            </Link>
          ) : null}
          <div className="border-t border-line px-3 py-2">
            <ThemeToggle withLabel />
          </div>
          <form action="/api/auth/logout" method="post" className="border-t border-line">
            <button
              type="submit"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
