import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';

import { AppShell } from '@/components/nav/app-shell';
import { Providers } from '@/components/providers';
import { env } from '@/env';
import { getCurrentUser } from '@/server/auth/session';
import { getUnreadNotificationCount } from '@/server/services/notifications';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const display = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: 'Nitrate — a social film diary',
    template: '%s · Nitrate',
  },
  description:
    'Track the films you watch, keep a diary worth re-reading, and run movie night with your friends. Nitrate is a social film diary with movie clubs built in.',
  applicationName: 'Nitrate',
  openGraph: {
    title: 'Nitrate',
    description: 'A social film diary, and the movie club that runs itself.',
    siteName: 'Nitrate',
    type: 'website',
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#08090b' },
    { media: '(prefers-color-scheme: light)', color: '#fbfaf8' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * Applied before paint so a light-mode reader never gets a black flash (and
 * vice versa). Kept tiny and dependency-free on purpose.
 */
const themeScript = `
(function(){try{
  var stored = localStorage.getItem('nitrate-theme');
  var theme = stored || 'dark';
  if (theme === 'system') {
    theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.dataset.theme = theme;
}catch(e){document.documentElement.dataset.theme='dark';}})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unreadCount = user ? await getUnreadNotificationCount(user.id) : 0;

  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} ${display.variable}`}>
        <Providers>
          <AppShell
            user={
              user
                ? {
                    id: user.id,
                    username: user.username,
                    displayName: user.displayName,
                    avatarAssetId: user.avatarAssetId,
                    role: user.role,
                    onboarded: Boolean(user.onboardingCompletedAt),
                  }
                : null
            }
            unreadCount={unreadCount}
          >
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
