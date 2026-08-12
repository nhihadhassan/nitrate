import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth/login-form';
import { signupHref } from '@/lib/links';
import { getCurrentUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/');
  const { next } = await searchParams;

  return (
    <div>
      <h1 className="text-center text-3xl">Welcome back</h1>
      <p className="mt-2 text-center text-sm text-muted">
        Pick up your diary where you left it.
      </p>
      <div className="mt-7">
        <LoginForm next={next} />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{' '}
        <Link href={signupHref(next)} className="font-medium text-ember hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
