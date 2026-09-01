import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'How Nitrate collects, protects and shares account and film activity data.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-4xl">Privacy policy</h1>
      <p className="text-sm text-dim">Last updated 11 August 2026.</p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong className="text-text">Account details</strong> — your email address, username,
          display name and password (stored only as a scrypt hash, never in readable form).
        </li>
        <li>
          <strong className="text-text">What you create</strong> — diary entries, ratings, likes,
          reviews, tags, lists, watchlist, follows, clubs and club messages.
        </li>
        <li>
          <strong className="text-text">Product analytics</strong> — a named set of events such as
          &ldquo;film logged&rdquo; or &ldquo;vote cast&rdquo;, tied to your account id, so we can
          tell whether the product works. We do not track time spent or build advertising profiles.
        </li>
        <li>
          <strong className="text-text">Session data</strong> — a hashed session token and the
          browser user-agent, so you can stay signed in and revoke sessions.
        </li>
      </ul>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell your data.</li>
        <li>We do not run third-party advertising or tracking pixels.</li>
        <li>We do not read your private diary entries or private club discussions for analytics.</li>
      </ul>

      <h2>Who can see what</h2>
      <p>
        You control this. Profiles, diary entries, reviews and lists each support public, followers
        only, or private. Clubs are private by default and their discussions are only ever visible
        to members. These rules are enforced on our servers in the database queries themselves, not
        just hidden in the interface — private content does not appear in feeds, search results or
        API responses. See{' '}
        <Link href="/settings/privacy" className="text-ember underline underline-offset-2">
          privacy settings
        </Link>
        .
      </p>

      <h2>Third parties</h2>
      <p>
        Film metadata and artwork come from TMDB. When you view a film page, your browser loads
        poster images from TMDB&apos;s image CDN. We do not send TMDB your identity or your ratings.
      </p>

      <h2>Deleting your account</h2>
      <p>
        You can delete your account from account settings. This removes your name, photo, bio, email
        and username, ends every session, and makes your profile inaccessible. Content that other
        people rely on — club screening history, and moderation records — is retained in
        de-identified form so shared club history and safety records survive.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live you may have the right to access, correct, export or erase your
        personal data. Account deletion covers erasure; for anything else, contact us and we will
        respond within 30 days.
      </p>

      <h2>Security</h2>
      <p>
        Passwords are hashed with scrypt. Session tokens are stored hashed and expire. All traffic
        is served over HTTPS. Every mutation is authorised server-side, and we rate limit sensitive
        endpoints such as sign-in, signup, reporting and imports.
      </p>
    </>
  );
}
