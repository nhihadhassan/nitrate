import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Terms of service' };

export default function TermsPage() {
  return (
    <>
      <h1 className="text-4xl">Terms of service</h1>
      <p className="text-sm text-dim">Last updated 11 August 2026.</p>

      <h2>1. Who can use Nitrate</h2>
      <p>
        You must be at least 13 years old, or the minimum age of digital consent where you live if
        that is higher. You are responsible for everything done through your account, so keep your
        password to yourself.
      </p>

      <h2>2. Your content</h2>
      <p>
        Your reviews, lists, diary entries and club messages remain yours. By posting them you give
        us a non-exclusive licence to store and display them on Nitrate so the product can work —
        showing your review on a film page, in a feed, or to your club. That licence ends when you
        delete the content, except where we must retain a copy for moderation or legal reasons.
      </p>

      <h2>3. Acceptable use</h2>
      <p>
        Follow the{' '}
        <Link href="/guidelines" className="text-ember underline underline-offset-2">
          community guidelines
        </Link>
        . Do not scrape the service, hammer it with automated requests, attempt to break its
        security, or use it to distribute malware or spam.
      </p>

      <h2>4. Film data</h2>
      <p>
        Film metadata and artwork are supplied by TMDB. This product uses the TMDB API but is not
        endorsed or certified by TMDB. Posters, backdrops and stills remain the property of their
        respective rights holders and are displayed for identification and commentary.
      </p>

      <h2>5. Moderation and termination</h2>
      <p>
        We may remove content, suspend or terminate accounts that breach these terms or the
        community guidelines. Where possible we will tell you why. You may delete your account at
        any time from your account settings.
      </p>

      <h2>6. No warranty</h2>
      <p>
        Nitrate is provided as is. We do not guarantee that it will be uninterrupted or error free,
        and we are not liable for indirect or consequential losses arising from your use of it.
        Nothing here limits liability that cannot be limited by law.
      </p>

      <h2>7. Changes</h2>
      <p>
        We may update these terms. Material changes will be announced in the product before they
        take effect. Continuing to use Nitrate after that means you accept the new terms.
      </p>
    </>
  );
}
