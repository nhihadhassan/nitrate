import Link from 'next/link';

import { BottomNav } from '@/components/nav/bottom-nav';
import { MotionOrchestrator } from '@/components/motion/motion-orchestrator';
import { TopNav, type NavUser } from '@/components/nav/top-nav';
import { BRAND } from '@/lib/brand';

export function AppShell({
  user,
  unreadCount,
  children,
}: {
  user: NavUser | null;
  unreadCount: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Link
        href="#main"
        className="sr-only-focusable absolute left-4 top-4 z-[200] rounded-md bg-ember px-3 py-2 text-sm font-medium text-white"
      >
        Skip to content
      </Link>

      <TopNav user={user} unreadCount={unreadCount} />

      <main id="main" className="flex-1 pb-[calc(env(safe-area-inset-bottom)+5.25rem)] md:pb-16">
        <MotionOrchestrator>{children}</MotionOrchestrator>
      </main>

      <SiteFooter />
      <BottomNav user={user} unreadCount={unreadCount} />
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-16 hidden border-t border-line py-10 md:block">
      <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-8 px-6 text-sm">
        <div className="max-w-xs">
          <p className="font-display text-lg">{BRAND.name}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-dim">
            {BRAND.tagline}
          </p>
        </div>
        <nav aria-label="Footer" className="flex gap-12 text-xs">
          <div className="space-y-2">
            <p className="eyebrow">Product</p>
            <ul className="space-y-1.5 text-muted">
              <li>
                <Link href="/explore" className="hover:text-ember">
                  Explore
                </Link>
              </li>
              <li>
                <Link href="/clubs" className="hover:text-ember">
                  Movie Clubs
                </Link>
              </li>
              <li>
                <Link href="/import" className="hover:text-ember">
                  Import from Letterboxd
                </Link>
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="eyebrow">Legal</p>
            <ul className="space-y-1.5 text-muted">
              <li>
                <Link href="/guidelines" className="hover:text-ember">
                  Community guidelines
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-ember">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-ember">
                  Privacy
                </Link>
              </li>
            </ul>
          </div>
        </nav>
        <p className="max-w-[15rem] text-[0.6875rem] leading-relaxed text-dim">
          Film metadata and artwork provided by{' '}
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 hover:text-muted"
          >
            TMDB
          </a>
          . This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </div>
    </footer>
  );
}
