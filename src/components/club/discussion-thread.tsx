'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import { ReportDialog } from '@/components/moderation/report-dialog';
import { Button } from '@/components/ui/button';
import { ImageIcon, SendIcon } from '@/components/ui/icons';
import { inputClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { Avatar, UserChip } from '@/components/user/avatar';
import { cn, relativeTime } from '@/lib/utils';
import { deleteDiscussionPostAction, postDiscussionAction } from '@/server/actions/clubs';
import { uploadImageAction } from '@/server/actions/media';

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
  compact = false,
  viewer,
}: {
  clubId: string;
  clubSlug: string;
  screeningId: string;
  viewerId: string;
  isAdmin: boolean;
  hasSeenFilm: boolean;
  movieTitle: string;
  posts: Post[];
  compact?: boolean;
  viewer?: { username: string; displayName: string; avatarAssetId: string | null };
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
      compact={compact}
      viewer={viewer}
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
  compact,
  viewer,
}: {
  clubId: string;
  clubSlug: string;
  screeningId: string;
  viewerId: string;
  isAdmin: boolean;
  posts: Post[];
  compact: boolean;
  viewer?: { username: string; displayName: string; avatarAssetId: string | null };
}) {
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [spoilers, setSpoilers] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [imageAssetId, setImageAssetId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const roots = posts.filter((p) => !p.parentId);
  const repliesByParent = new Map<string, Post[]>();
  for (const post of posts) {
    if (!post.parentId) continue;
    const list = repliesByParent.get(post.parentId) ?? [];
    list.push(post);
    repliesByParent.set(post.parentId, list);
  }

  function submit() {
    if (!body.trim() && !imageAssetId) return;
    startTransition(async () => {
      const textBody = imageAssetId ? body.trim().slice(0, 4950) : body.trim();
      const postBody = `${textBody}${imageAssetId ? `${textBody ? '\n' : ''}[[image:${imageAssetId}]]` : ''}`;
      const result = await postDiscussionAction({
        clubId,
        clubSlug,
        screeningId,
        parentId: replyTo,
        body: postBody,
        containsSpoilers: spoilers,
      });
      if (!result.ok) {
        toast({ message: result.error, tone: 'error' });
        return;
      }
      setBody('');
      setSpoilers(false);
      setReplyTo(null);
      setImageAssetId(null);
      router.refresh();
    });
  }

  return (
    <div>
      <div className={compact ? 'mb-4' : 'mb-6'}>
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
        <div className={cn(compact && 'flex items-start gap-2.5')}>
          {compact && viewer ? <Avatar user={viewer} size="sm" className="mt-1 shrink-0" /> : null}
          <div className="min-w-0 flex-1">
            <div className={cn(compact && 'flex items-center gap-2')}>
              <div className="relative min-w-0 flex-1">
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={compact ? 1 : 3}
                  maxLength={5000}
                  placeholder="What did you think?"
                  aria-label="Write a message"
                  className={cn(inputClass, compact ? 'min-h-12 resize-none rounded-full py-3 pl-4 pr-12' : 'resize-y')}
                />
                {compact ? (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Add an image" className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-hover hover:text-text">
                    <ImageIcon className="h-5 w-5" />
                  </button>
                ) : null}
              </div>
              {compact ? (
                <button type="button" onClick={submit} disabled={pending || uploading || (!body.trim() && !imageAssetId)} aria-label={pending ? 'Posting' : 'Post message'} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ember text-white transition-opacity disabled:opacity-40">
                  <SendIcon className="h-5 w-5" />
                </button>
              ) : null}
            </div>
            {imageAssetId ? (
              <div className="relative mt-2 h-20 w-20 overflow-hidden rounded-lg border border-line">
                <Image src={`/media/${imageAssetId}`} alt="Attached image" fill sizes="80px" className="object-cover" unoptimized />
                <button type="button" onClick={() => setImageAssetId(null)} aria-label="Remove image" className="absolute right-1 top-1 h-6 w-6 rounded-full bg-canvas/85 text-xs text-text">×</button>
              </div>
            ) : null}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          if (file.size > 8 * 1024 * 1024) return toast({ message: 'That image is too large (8MB max).', tone: 'error' });
          setUploading(true);
          try {
            const dataUrl = await prepareDiscussionImage(file);
            const result = await uploadImageAction({ kind: 'club_image', dataUrl });
            if (!result.ok) toast({ message: result.error, tone: 'error' });
            else setImageAssetId(result.data.assetId);
          } catch { toast({ message: 'We could not read that image.', tone: 'error' }); }
          finally { setUploading(false); }
        }} />
        <div className={cn('mt-2 flex flex-wrap items-center justify-between gap-3', compact && 'pl-11')}>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={spoilers}
              onChange={(event) => setSpoilers(event.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--amber)]"
            />
            Mark as a bigger spoiler
          </label>
          {!compact ? <Button variant="iris" size="sm" disabled={pending || (!body.trim() && !imageAssetId)} onClick={submit}>
            {pending ? 'Posting…' : 'Post'}
          </Button> : null}
        </div>
      </div>

      {roots.length ? (
        <ul className={compact ? 'divide-y divide-line' : 'space-y-5'}>
          {roots.map((post) => (
            <li key={post.id} className={compact ? 'py-3 first:pt-0 last:pb-0' : undefined}>
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
        <PostBody body={post.body} />
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-1.5 w-full rounded-md border border-dashed border-amber/40 bg-amber/[0.06] px-3 py-2.5 text-xs text-amber transition-colors hover:bg-amber/[0.1]"
        >
          Marked as a bigger spoiler — tap to reveal
        </button>
      )}

      <div className="mt-1 flex flex-wrap gap-1 text-xs text-dim">
        <button type="button" onClick={onReply} className="flex min-h-10 items-center px-2 hover:text-text sm:min-h-0 sm:px-0">
          Reply
        </button>
        {post.author.id !== viewerId ? (
          <button type="button" onClick={onReport} className="flex min-h-10 items-center px-2 hover:text-text sm:min-h-0 sm:px-0">
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
            className="flex min-h-10 items-center px-2 hover:text-rose sm:min-h-0 sm:px-0"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}

const IMAGE_MARKER = /\[\[image:([0-9a-f-]{36})\]\]/i;

function PostBody({ body }: { body: string }) {
  const match = IMAGE_MARKER.exec(body);
  const text = body.replace(IMAGE_MARKER, '').trim();
  return <div className="mt-1.5">{text ? <p className="break-words whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-muted [overflow-wrap:anywhere]">{text}</p> : null}{match ? <div className="relative mt-2 aspect-[4/3] max-w-sm overflow-hidden rounded-lg border border-line"><Image src={`/media/${match[1]}`} alt="Discussion attachment" fill sizes="(max-width: 640px) 80vw, 384px" className="object-cover" unoptimized /></div> : null}</div>;
}

async function prepareDiscussionImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not process image');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.84);
}
