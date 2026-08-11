import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center px-4 py-12">
      {/* A single warm bloom behind the form; enough atmosphere, no gradient soup. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[42rem] -translate-x-1/2 opacity-[0.16]"
        style={{
          background: 'radial-gradient(ellipse at center, var(--ember) 0%, transparent 68%)',
        }}
      />
      <div className="relative w-full max-w-sm">
        {children}
        <p className="mt-8 text-center text-xs text-dim">
          By continuing you agree to our{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-muted">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-muted">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
