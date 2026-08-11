'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { ReportDialog } from '@/components/moderation/report-dialog';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { UserChip } from '@/components/user/avatar';
import { cn, relativeTime } from '@/lib/utils';
import { deleteDiscussionPostAction, postDiscussionAction } from '@/server/actions/clubs';

type Post = {
  id: string;
  body: string;
  containsSpoilers: boolean;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  parentId: string | null;
  replyCount: number;
  author: { id: string; username: string; displayName: string; avatarAssetId: string | null };
};

export function DiscussionThread({
  clubId,
  clubSlug,
  screeningId,
  viewerId,
  isAdmin,
  hasSeenFilm,
  movieTitle,
  posts,
}: {
  clubId: string;
  clubSlug: string;
  screeningId: string;
  viewerId: string;
  isAdmin: boolean;
  hasSeenFilm: boolean;
  movieTitle: string;
  posts: Post[];
}) {
  // Spoiler gate: members who have not watched or attended must opt in.
  const [entered, setEntered] = useState(hasSeenFilm);

  if (!entered) {
    return (
      <div className="rounded-lg border border-dashed border-amber/40 bg-amber/[0.06] px-5 py-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber">
          Spoilers ahead
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          You have not logged <span className="text-text">{movieTitle}</span> yet. This discussion
          assumes everyone has seen it.
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setEntered(true)}>
          I&apos;ve seen it — let me in
        </Button>
      </div>
    );
  }

  return (
    <Thread
      clubId={clubId}
      clubSlug={clubSlug}
      screeningId={screeningId}
      viewerId={viewerId}
      isAdmin={isAdmin}
      posts={posts}
    />
  );
}

function Thread({
  clubId,
  clubSlug,
  screeningId,
  viewerId,
  isAdmin,
  posts,
}: {
  clubId: string;
  clubSlug: string;
  screeningId: string;
  viewerId: string;
  isAdmin: boolean;
  posts: Post[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [spoilers, setSpoilers] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const roots = posts.filter((p) => !p.parentId);
  const repliesByParent = new Map<string, Post[]>();
  for (const post of posts) {
    if (!post.parentId) continue;
    const list = repliesByParent.get(post.parentId) ?? [];
    list.push(post);
    repliesByParent.set(post.parentId, list);
  }

  function submit() {
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await postDiscussionAction({
        clubId,
        clubSlug,
        screeningId,
        parentId: replyTo,
        body,
        containsSpoilers: spoilers,
      });
      if (!result.ok) {
        toast({ message: result.error, tone: 'error' });
        return;
      }
      setBody('');
      setSpoilers(false);
      setReplyTo(null);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-6">
        {replyTo ? (
          <p className="mb-1.5 text-xs text-dim">
            Replying ·{' '}
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="underline underline-offset-2 hover:text-text"
            >
              cancel
            </button>
          </p>
        ) : null}
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="What did you think?"
          aria-label="Write a message"
          className={cn(inputClass, 'resize-y')}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={spoilers}
              onChange={(event) => setSpoilers(event.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--amber)]"
            />
            Mark as a bigger spoiler
          </label>
          <Button variant="iris" size="sm" disabled={pending || !body.trim()} onClick={submit}>
            {pending ? 'Posting…' : 'Post'}
          </Button>
        </div>
      </div>

      {roots.length ? (
        <ul className="space-y-5">
          {roots.map((post) => (
            <li key={post.id}>
              <PostRow
                post={post}
                viewerId={viewerId}
                isAdmin={isAdmin}
                clubSlug={clubSlug}
                screeningId={screeningId}
                onReply={() => setReplyTo(post.id)}
                onReport={() => setReporting(post.id)}
              />
              {repliesByParent.get(post.id)?.length ? (
                <ul className="mt-3.5 space-y-3.5 border-l border-line pl-4">
                  {repliesByParent.get(post.id)!.map((reply) => (
                    <li key={reply.id}>
                      <PostRow
                        post={reply}
                        viewerId={viewerId}
                        isAdmin={isAdmin}
                        clubSlug={clubSlug}
                        screeningId={screeningId}
                        onReply={() => setReplyTo(post.id)}
                        onReport={() => setReporting(reply.id)}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-dim">
          Nobody has said anything yet. Go on.
        </p>
      )}

      {reporting ? (
        <ReportDialog
          subjectType="club_post"
          subjectId={reporting}
          subjectLabel="this message"
          onClose={() => setReporting(null)}
        />
      ) : null}
    </div>
  );
}

function PostRow({
  post,
  viewerId,
  isAdmin,
  clubSlug,
  screeningId,
  onReply,
  onReport,
}: {
  post: Post;
  viewerId: string;
  isAdmin: boolean;
  clubSlug: string;
  screeningId: string;
  onReply: () => void;
  onReport: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [revealed, setRevealed] = useState(!post.containsSpoilers);
  const [pending, startTransition] = useTransition();

  if (post.deletedAt) {
    return (
      <p className="rounded-md border border-line px-3 py-2 text-xs italic text-dim">
        This message was removed.
      </p>
    );
  }

  const canDelete = post.author.id === viewerId || isAdmin;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <UserChip user={post.author} size="sm" />
        <span className="shrink-0 text-xs text-dim">{relativeTime(post.createdAt)}</span>
      </div>

      {revealed ? (
        <p className="mt-1.5 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-muted">
          {post.body}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-1.5 w-full rounded-md border border-dashed border-amber/40 bg-amber/[0.06] px-3 py-2.5 text-xs text-amber transition-colors hover:bg-amber/[0.1]"
        >
          Marked as a bigger spoiler — tap to reveal
        </button>
      )}

      <div className="mt-1.5 flex gap-3 text-xs text-dim">
        <button type="button" onClick={onReply} className="hover:text-text">
          Reply
        </button>
        {post.author.id !== viewerId ? (
          <button type="button" onClick={onReport} className="hover:text-text">
            Report
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteDiscussionPostAction(post.id, clubSlug, screeningId);
                if (!result.ok) {
                  toast({ message: result.error, tone: 'error' });
                  return;
                }
                router.refresh();
              })
            }
            className="hover:text-rose"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}
