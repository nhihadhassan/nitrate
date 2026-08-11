import type { Metadata } from 'next';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Community guidelines',
  description: 'How we expect people to behave on Nitrate.',
};

export default function GuidelinesPage() {
  return (
    <>
      <h1 className="text-4xl">Community guidelines</h1>
      <p>
        {BRAND.name} is a place to talk about films. These rules exist so it stays that way. They apply
        to reviews, comments, lists, profiles, club names and club discussions alike.
      </p>

      <h2>Be a person about it</h2>
      <ul>
        <li>Disagree with the film, not the human who liked it.</li>
        <li>No harassment, targeted abuse, threats or pile-ons.</li>
        <li>
          No hate speech. Content attacking people over race, ethnicity, nationality, religion,
          caste, disability, sex, gender identity, sexual orientation or serious disease is removed
          and the account is suspended.
        </li>
        <li>Do not impersonate other people, critics, filmmakers or club staff.</li>
      </ul>

      <h2>Spoilers</h2>
      <ul>
        <li>Mark spoilers when you write them. It takes one tap.</li>
        <li>Do not put spoilers in review previews, list titles or club names.</li>
        <li>Deliberately spoiling a film for someone is treated as harassment.</li>
      </ul>

      <h2>Keep it about film</h2>
      <ul>
        <li>No spam, engagement farming, referral links or advertising.</li>
        <li>No sexual content involving minors, ever. This is reported to the authorities.</li>
        <li>No sexually explicit imagery in avatars, club images or list covers.</li>
        <li>Do not use reviews to promote unrelated products or causes.</li>
      </ul>

      <h2>Clubs</h2>
      <ul>
        <li>Club owners and admins are responsible for what happens in their club.</li>
        <li>Admins can remove messages, remove members and ban people from their club.</li>
        <li>Private club discussions are still covered by these guidelines.</li>
      </ul>

      <h2>What happens when you break them</h2>
      <p>
        Depending on severity we may remove the content, issue a warning, suspend the account or
        remove it. Every moderation action is recorded with a reason. If your content is removed you
        will be notified.
      </p>

      <h2>Reporting</h2>
      <p>
        Every review, comment, list, profile, club and club message has a report option. Reports go
        to a human queue and we keep a copy of the reported content so deleting it does not end the
        review. You can also block any account — blocking is enforced on our servers, not just
        hidden in the interface.
      </p>
    </>
  );
}
