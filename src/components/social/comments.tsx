'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { ReportDialog } from '@/components/moderation/report-dialog';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { UserChip } from '@/components/user/avatar';
import { cn, relativeTime } from '@/lib/utils';
import { createCommentAction, deleteCommentAction } from '@/server/actions/social';

export type CommentData = {
  id: string;
  body: string;
  createdAt: string;
  parentId: string | null;
  containsSpoilers: boolean;
  author: { id: string; username: string; displayName: string; avatarAssetId: string | null };
};

export function Comments({
  subjectType,
  subjectId,
  comments,
  viewerId,
  ownerId,
  canModerate,
}: {
  subjectType: 'review' | 'list';
  subjectId: string;
  comments: CommentData[];
  viewerId: string | null;
  ownerId: string;
  canModerate: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [reporting, setReporting] = useState<string | null>(null);

  const roots = comments.filter((c) => !c.parentId);
  const repliesByParent = new Map<string, CommentData[]>();
  for (const comment of comments) {
    if (!comment.parentId) continue;
    const list = repliesByParent.get(comment.parentId) ?? [];
    list.push(comment);
    repliesByParent.set(comment.parentId, list);
  }

  function submit() {
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await createCommentAction({
        subjectType,
        subjectId,
        parentId: replyTo,
        body,
      });
      if (!result.ok) {
        toast({ message: result.error, tone: 'error' });
        return;
      }
      setBody('');
      setReplyTo(null);
      router.refresh();
    });
  }

  return (
    <section aria-label="Comments">
      <h2 className="eyebrow mb-3">
        {comments.length ? `${comments.length} comment${comments.length === 1 ? '' : 's'}` : 'Comments'}
      </h2>

      {viewerId ? (
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
            maxLength={2000}
            placeholder="Add a comment…"
            aria-label="Add a comment"
            className={cn(inputClass, 'resize-y')}
          />
          <div className="mt-2 flex justify-end">
            <Button variant="primary" size="sm" disabled={pending || !body.trim()} onClick={submit}>
              {pending ? 'Posting…' : 'Post'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mb-6 text-sm text-dim">Sign in to join the conversation.</p>
      )}

      {roots.length ? (
        <ul className="space-y-5">
          {roots.map((comment) => (
            <li key={comment.id}>
              <CommentRow
                comment={comment}
                viewerId={viewerId}
                ownerId={ownerId}
                canModerate={canModerate}
                onReply={() => setReplyTo(comment.id)}
                onReport={() => setReporting(comment.id)}
              />
              {repliesByParent.get(comment.id)?.length ? (
                <ul className="mt-4 space-y-4 border-l border-line pl-4">
                  {repliesByParent.get(comment.id)!.map((reply) => (
                    <li key={reply.id}>
                      <CommentRow
                        comment={reply}
                        viewerId={viewerId}
                        ownerId={ownerId}
                        canModerate={canModerate}
                        onReply={() => setReplyTo(comment.id)}
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
        <p className="text-sm text-dim">No comments yet.</p>
      )}

      {reporting ? (
        <ReportDialog
          subjectType="comment"
          subjectId={reporting}
          subjectLabel="this comment"
          onClose={() => setReporting(null)}
        />
      ) : null}
    </section>
  );
}

function CommentRow({
  comment,
  viewerId,
  ownerId,
  canModerate,
  onReply,
  onReport,
}: {
  comment: CommentData;
  viewerId: string | null;
  ownerId: string;
  canModerate: boolean;
  onReply: () => void;
  onReport: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const canDelete = viewerId === comment.author.id || viewerId === ownerId || canModerate;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <UserChip user={comment.author} size="sm" />
        <span className="shrink-0 text-xs text-dim">{relativeTime(comment.createdAt)}</span>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-muted">
        {comment.body}
      </p>
      <div className="mt-1.5 flex gap-3 text-xs text-dim">
        {viewerId ? (
          <button type="button" onClick={onReply} className="hover:text-text">
            Reply
          </button>
        ) : null}
        {viewerId && viewerId !== comment.author.id ? (
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
                const result = await deleteCommentAction(comment.id);
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
