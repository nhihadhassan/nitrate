import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Badge, Container } from '@/components/ui/primitives';
import { getCurrentUser } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

const LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/clubs', label: 'Clubs' },
  { href: '/admin/movies', label: 'Film metadata' },
  { href: '/admin/email', label: 'Outbox' },
  { href: '/admin/audit', label: 'Audit log' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'admin' && user.role !== 'moderator') redirect('/');

  return (
    <Container size="wide" className="py-8 pb-20">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl">Moderation</h1>
          <Badge tone="iris">{user.role}</Badge>
        </div>
      </header>

      <nav aria-label="Admin sections" className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b border-line">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="-mb-px inline-block border-b-2 border-transparent px-3 py-2.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-text"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {children}
    </Container>
  );
}
