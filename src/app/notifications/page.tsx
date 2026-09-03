import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Container, EmptyState } from '@/components/ui/primitives';
import { Avatar } from '@/components/user/avatar';
import { relativeTime } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { listNotifications, markNotificationsRead } from '@/server/services/notifications';

export const metadata: Metadata = { title: 'Notifications', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const LABELS: Record<string, string> = {
  new_follower: 'started following you',
  review_liked: 'liked your review',
  list_liked: 'liked your list',
  review_comment: 'commented on your review',
  list_comment: 'commented on your list',
  comment_reply: 'replied to your comment',
  club_invitation: 'invited you to a club',
  list_collaboration_invite: 'invited you to edit a list',
  club_member_joined: 'joined the club',
  club_nominations_opened: 'started choosing the next movie',
  club_voting_opened: 'opened voting',
  club_voting_ending: 'voting is closing soon',
  club_pick_deadline_extended: 'extended the pick deadline',
  club_winner_selected: 'a film was chosen',
  club_screening_scheduled: 'scheduled a movie night',
  club_screening_reminder: 'movie night is coming up',
  club_screening_completed: 'the club finished a film',
  club_discussion_reply: 'replied in a discussion',
  moderation_action: 'moderation update',
  mention: 'mentioned you in a discussion',
  club_join_request: 'requested to join your club',
  club_join_approved: 'approved your club request',
  club_join_declined: 'declined your club request',
};

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/notifications');

  const notifications = await listNotifications(user.id, { limit: 60 });
  // Opening the page is the read receipt.
  await markNotificationsRead(user.id);

  return (
    <Container size="narrow" className="py-8">
      <h1 className="mb-6 text-3xl sm:text-4xl">Notifications</h1>

      {notifications.length ? (
        <ul className="divide-y divide-line">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <Link
                href={notification.url}
                className={`flex items-start gap-3 px-2 py-3.5 transition-colors hover:bg-surface-hover ${
                  notification.readAt ? '' : 'bg-ember/[0.04]'
                }`}
              >
                {notification.actor ? (
                  <Avatar user={notification.actor} size="md" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-xs text-dim">
                    ●
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">
                    {notification.body ??
                      `${notification.actor?.displayName ?? 'Someone'} ${
                        LABELS[notification.type] ?? 'did something'
                      }`}
                    {notification.groupCount > 1 ? <span className="ml-1 text-dim">· {notification.groupCount} updates</span> : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-dim">
                    {relativeTime(notification.createdAt)}
                  </span>
                </span>
                {!notification.readAt ? (
                  <span aria-label="Unread" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-ember" />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Nothing yet"
          description="Follows, likes, comments and everything happening in your clubs will show up here."
        />
      )}
    </Container>
  );
}
