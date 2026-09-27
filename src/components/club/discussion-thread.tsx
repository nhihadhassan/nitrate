'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { ReportDialog } from '@/components/moderation/report-dialog';
import { Button } from '@/components/ui/button';
import { ImageIcon } from '@/components/ui/icons';
import { inputClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { UserChip } from '@/components/user/avatar';
import { cn, relativeTime } from '@/lib/utils';
import { deleteDiscussionPostAction, postDiscussionAction, revealScreeningDiscussionAction, searchDiscussionGifsAction, toggleDiscussionReactionAction, updateDiscussionPostAction } from '@/server/actions/clubs';
import { uploadImageAction } from '@/server/actions/media';

type Post = {
  id: string;
  body: string;
  isReview: boolean;
  gifUrl: string | null;
  containsSpoilers: boolean;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  parentId: string | null;
  replyCount: number;
  reactions: { emoji: string; count: number; mine: boolean }[];
  author: { id: string; username: string; displayName: string; avatarAssetId: string | null };
};

const REACTION_NAMES: Record<string, string> = {
  '❤️': 'heart',
  '😂': 'laugh',
  '😮': 'surprised',
  '👏': 'applause',
  '🎬': 'film',
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
  const toast = useToast();
  // Keep spoiler content out of the initial page payload until the viewer opts in.
  const [entered, setEntered] = useState(hasSeenFilm);
  const [revealedPosts, setRevealedPosts] = useState<Post[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function revealDiscussion() {
    setLoading(true);
    const result = await revealScreeningDiscussionAction(screeningId);
    setLoading(false);
    if (!result.ok) {
      // The action can fail if membership or screening state changed meanwhile.
      toast({ message: result.error, tone: 'error' });
      return;
    }
    setRevealedPosts(result.data.posts);
    setEntered(true);
  }

  async function refreshRevealedPosts() {
    if (hasSeenFilm) return;
    const result = await revealScreeningDiscussionAction(screeningId);
    if (result.ok) setRevealedPosts(result.data.posts);
  }

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
        <Button variant="outline" size="sm" className="mt-4" disabled={loading} onClick={revealDiscussion}>
          {loading ? 'Loading discussion…' : 'I’ve seen it — let me in'}
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
      movieTitle={movieTitle}
      posts={hasSeenFilm ? posts : revealedPosts ?? []}
      onPosted={refreshRevealedPosts}
    />
  );
}

function Thread({
  clubId,
  clubSlug,
  screeningId,
  viewerId,
  isAdmin,
  movieTitle,
  posts,
  onPosted,
}: {
  clubId: string;
  clubSlug: string;
  screeningId: string;
  viewerId: string;
  isAdmin: boolean;
  movieTitle: string;
  posts: Post[];
  onPosted: () => Promise<void>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [localPosts, setLocalPosts] = useState(posts);
  const [postKind, setPostKind] = useState<'review' | 'comment'>('review');
  const [body, setBody] = useState('');
  const [spoilers, setSpoilers] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [imageAssetId, setImageAssetId] = useState<string | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<{ id: string; description: string; previewUrl: string; gifUrl: string }[]>([]);
  const [gifSearchConfigured, setGifSearchConfigured] = useState<boolean | null>(null);
  const [gifSearchPending, setGifSearchPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setLocalPosts(posts), [posts]);

  const roots = localPosts.filter((post) => !post.parentId);
  const repliesByParent = new Map<string, Post[]>();
  for (const post of localPosts) {
    if (!post.parentId) continue;
    const list = repliesByParent.get(post.parentId) ?? [];
    list.push(post);
    repliesByParent.set(post.parentId, list);
  }

  async function searchGifs(query = gifQuery) {
    setGifSearchPending(true);
    const result = await searchDiscussionGifsAction({ screeningId, query: query.trim() || undefined });
    setGifSearchPending(false);
    if (!result.ok) {
      toast({ message: result.error, tone: 'error' });
      return;
    }
    setGifSearchConfigured(result.data.configured);
    setGifResults(result.data.gifs);
  }

  async function attachGifFile(file: File) {
    const limit = file.type === 'image/gif' ? 2 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > limit) {
      toast({ message: file.type === 'image/gif' ? 'That GIF is too large (2MB max).' : 'That image is too large (8MB max).', tone: 'error' });
      return;
    }
    setUploading(true);
    try {
      const dataUrl = file.type === 'image/gif' ? await readFileDataUrl(file) : await prepareDiscussionImage(file);
      const result = await uploadImageAction({ kind: 'club_image', dataUrl });
      if (!result.ok) toast({ message: result.error, tone: 'error' });
      else {
        setImageAssetId(result.data.assetId);
        setGifUrl(null);
      }
    } catch {
      toast({ message: 'We could not read that image.', tone: 'error' });
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    if (!body.trim() && !imageAssetId && !gifUrl) return;
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
        isReview: postKind === 'review' && !replyTo,
        gifUrl,
      });
      if (!result.ok) {
        toast({ message: result.error, tone: 'error' });
        return;
      }
      setBody('');
      setSpoilers(false);
      setReplyTo(null);
      setImageAssetId(null);
      setGifUrl(null);
      setPostKind('comment');
      await onPosted();
      router.refresh();
    });
  }

  async function reactToPost(postId: string, emoji: string) {
    const result = await toggleDiscussionReactionAction({ postId, emoji, screeningId, clubSlug });
    if (!result.ok) {
      toast({ message: result.error, tone: 'error' });
      return;
    }
    setLocalPosts((current) => current.map((post) => post.id === postId ? { ...post, reactions: result.data.reactions } : post));
  }

  function selectKind(kind: 'review' | 'comment') {
    setPostKind(replyTo ? 'comment' : kind);
  }

  function renderPostList(items: Post[], label: string) {
    if (!items.length) return null;
    return (
      <section className="mt-6" aria-label={label}>
        <h4 className="mb-3 text-sm font-semibold text-text">{label}</h4>
        <ul className="divide-y divide-line">
          {items.map((post) => (
            <li key={post.id} className="py-4 first:pt-0 last:pb-0">
              <PostRow
                post={post}
                viewerId={viewerId}
                isAdmin={isAdmin}
                clubSlug={clubSlug}
                screeningId={screeningId}
                onReply={() => { setReplyTo(post.id); setPostKind('comment'); }}
                onReport={() => setReporting(post.id)}
                onReact={(emoji) => reactToPost(post.id, emoji)}
                onChanged={async () => { await onPosted(); router.refresh(); }}
              />
              {repliesByParent.get(post.id)?.length ? (
                <ul className="ml-3 mt-4 space-y-4 border-l border-line pl-4 sm:ml-5 sm:pl-5">
                  {repliesByParent.get(post.id)!.map((reply) => (
                    <li key={reply.id}>
                      <PostRow
                        post={reply}
                        viewerId={viewerId}
                        isAdmin={isAdmin}
                        clubSlug={clubSlug}
                        screeningId={screeningId}
                        onReply={() => { setReplyTo(post.id); setPostKind('comment'); }}
                        onReport={() => setReporting(reply.id)}
                        onReact={(emoji) => reactToPost(reply.id, emoji)}
                        onChanged={async () => { await onPosted(); router.refresh(); }}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="eyebrow">Movie night</p>
          <h3 className="mt-1 font-display text-xl">Your take on {movieTitle}</h3>
          <p className="mt-1 text-sm text-muted">Reviews and reactions, just for this club.</p>
        </div>
        <p className="text-xs text-dim" aria-live="polite">
          {roots.filter((post) => post.isReview).length} {roots.filter((post) => post.isReview).length === 1 ? 'review' : 'reviews'}
          {' · '}{localPosts.length - roots.filter((post) => post.isReview).length} {localPosts.length - roots.filter((post) => post.isReview).length === 1 ? 'comment' : 'comments'}
        </p>
      </div>

      <div className="rounded-lg border border-line bg-surface/50 p-3.5 sm:p-4">
        {replyTo ? (
          <p className="mb-3 flex items-center justify-between gap-2 text-sm text-muted">
            Replying to a club post
            <button type="button" onClick={() => setReplyTo(null)} className="min-h-10 px-2 text-text underline underline-offset-2">Cancel reply</button>
          </p>
        ) : (
          <div className="mb-3 inline-flex rounded-md bg-canvas p-1" role="group" aria-label="Choose what to share">
            <button type="button" aria-pressed={postKind === 'review'} onClick={() => selectKind('review')} className={cn('min-h-10 rounded px-3 text-sm transition-colors', postKind === 'review' ? 'bg-surface-raised text-text shadow-card' : 'text-muted hover:text-text')}>Write a review</button>
            <button type="button" aria-pressed={postKind === 'comment'} onClick={() => selectKind('comment')} className={cn('min-h-10 rounded px-3 text-sm transition-colors', postKind === 'comment' ? 'bg-surface-raised text-text shadow-card' : 'text-muted hover:text-text')}>Add a comment</button>
          </div>
        )}
        <label className="mb-1.5 block text-sm font-medium text-text" htmlFor="club-discussion-body">
          {replyTo ? 'Your reply' : postKind === 'review' ? `Your review of ${movieTitle}` : 'Your comment'}
        </label>
        <textarea
          id="club-discussion-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          maxLength={5000}
          placeholder={postKind === 'review' && !replyTo ? 'What stayed with you after the credits?' : 'Add to the conversation…'}
          className={cn(inputClass, 'min-h-28 resize-y')}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line px-3 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-50">
            <ImageIcon className="h-4 w-4" />{uploading ? 'Adding…' : 'Photo or GIF'}
          </button>
          <button type="button" onClick={() => { setGifPickerOpen((open) => !open); if (!gifPickerOpen) void searchGifs(''); }} className="min-h-10 rounded-md border border-line px-3 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-text" aria-expanded={gifPickerOpen}>Find a GIF</button>
          <label className="ml-auto flex min-h-10 cursor-pointer items-center gap-2 px-1 text-xs text-muted">
            <input type="checkbox" checked={spoilers} onChange={(event) => setSpoilers(event.target.checked)} className="h-4 w-4 accent-[var(--amber)]" />
            Contains spoilers
          </label>
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void attachGifFile(file);
        }} />

        {gifPickerOpen ? (
          <div className="mt-3 rounded-md border border-line bg-canvas p-3" aria-label="GIF search">
            <form onSubmit={(event) => { event.preventDefault(); void searchGifs(); }} className="flex gap-2">
              <input value={gifQuery} onChange={(event) => setGifQuery(event.target.value)} placeholder="Search GIFs" aria-label="Search GIFs" className={cn(inputClass, 'min-w-0 flex-1')} />
              <Button type="submit" variant="outline" size="sm" disabled={gifSearchPending}>{gifSearchPending ? 'Searching…' : 'Search'}</Button>
            </form>
            {gifSearchConfigured === false ? (
              <p className="mt-3 text-sm text-muted">GIF search is not connected yet. You can add a GIF file from your device above.</p>
            ) : gifSearchPending ? (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Loading GIFs">{Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-square animate-pulse rounded bg-surface" />)}</div>
            ) : gifResults.length ? (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {gifResults.map((gif) => (
                  <button key={gif.id} type="button" onClick={() => { setGifUrl(gif.gifUrl); setImageAssetId(null); setGifPickerOpen(false); }} aria-label={`Choose GIF: ${gif.description}`} className="overflow-hidden rounded border border-line outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ember">
                    <Image src={gif.previewUrl} alt={gif.description} width={180} height={140} unoptimized className="h-24 w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : gifSearchConfigured ? <p className="mt-3 text-sm text-muted">No GIFs found. Try another search.</p> : null}
            {gifSearchConfigured ? <p className="mt-2 text-right text-[0.6875rem] text-dim">GIFs by Tenor</p> : null}
          </div>
        ) : null}

        {imageAssetId || gifUrl ? (
          <div className="relative mt-3 h-24 w-32 overflow-hidden rounded-md border border-line">
            <Image src={imageAssetId ? `/media/${imageAssetId}` : gifUrl!} alt="Selected attachment preview" fill sizes="128px" className="object-cover" unoptimized />
            <button type="button" onClick={() => { setImageAssetId(null); setGifUrl(null); }} aria-label="Remove attachment" className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-canvas/90 text-text">×</button>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-dim">{postKind === 'review' && !replyTo ? 'Shared with members of this club.' : 'Keep the conversation kind and spoiler aware.'}</p>
          <Button variant="primary" size="sm" disabled={pending || uploading || (!body.trim() && !imageAssetId && !gifUrl)} onClick={submit}>
            {pending ? 'Sharing…' : replyTo ? 'Post reply' : postKind === 'review' ? 'Share review' : 'Post comment'}
          </Button>
        </div>
      </div>

      {roots.length === 0 ? (
        <div className="mt-5 border-l-2 border-ember/50 py-2 pl-4">
          <p className="font-display text-lg">Start with your take</p>
          <p className="mt-1 text-sm text-muted">Leave the first review of {movieTitle}, or share a reaction with the group.</p>
        </div>
      ) : null}

      {renderPostList(roots.filter((post) => post.isReview), 'Club reviews')}
      {renderPostList(roots.filter((post) => !post.isReview), 'Comments')}

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
  onReact,
  onChanged,
}: {
  post: Post;
  viewerId: string;
  isAdmin: boolean;
  clubSlug: string;
  screeningId: string;
  onReply: () => void;
  onReport: () => void;
  onReact: (emoji: string) => void;
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [revealed, setRevealed] = useState(!post.containsSpoilers);
  const [pending, startTransition] = useTransition();
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState('');
  const [editSpoilers, setEditSpoilers] = useState(post.containsSpoilers);

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
        <span className="shrink-0 text-xs text-dim">{relativeTime(post.createdAt)}{post.editedAt ? ' · edited' : ''}</span>
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <label htmlFor={`edit-${post.id}`} className="block text-xs font-medium text-text">Edit your {post.isReview ? 'review' : 'comment'}</label>
          <textarea id={`edit-${post.id}`} value={editBody} onChange={(event) => setEditBody(event.target.value)} rows={4} maxLength={5000} className={cn(inputClass, 'min-h-24 resize-y')} />
          <label className="flex min-h-10 items-center gap-2 text-xs text-muted"><input type="checkbox" checked={editSpoilers} onChange={(event) => setEditSpoilers(event.target.checked)} className="h-4 w-4 accent-[var(--amber)]" />Contains spoilers</label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={pending || (!editBody.trim() && !post.gifUrl)} onClick={() => startTransition(async () => {
              const result = await updateDiscussionPostAction({ postId: post.id, screeningId, clubSlug, body: editBody, containsSpoilers: editSpoilers });
              if (!result.ok) { toast({ message: result.error, tone: 'error' }); return; }
              setEditing(false);
              await onChanged();
            })}>{pending ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </div>
      ) : revealed ? (
        <PostBody body={post.body} gifUrl={post.gifUrl} isReview={post.isReview} />
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-1.5 w-full rounded-md border border-dashed border-amber/40 bg-amber/[0.06] px-3 py-2.5 text-xs text-amber transition-colors hover:bg-amber/[0.1]"
        >
          Spoiler alert — tap to reveal
        </button>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {post.reactions.filter((reaction) => reaction.count > 0).map((reaction) => (
          <button key={reaction.emoji} type="button" aria-label={`${reaction.count} ${REACTION_NAMES[reaction.emoji] ?? 'other'} reaction${reaction.count === 1 ? '' : 's'}${reaction.mine ? ', including yours' : ''}`} aria-pressed={reaction.mine} onClick={() => onReact(reaction.emoji)} className={cn('inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-sm transition-colors active:scale-[0.98]', reaction.mine ? 'border-ember/50 bg-ember/10 text-text' : 'border-line text-muted hover:bg-surface-hover hover:text-text')}>
            <span aria-hidden>{reaction.emoji}</span><span className="tabular text-xs">{reaction.count}</span>
          </button>
        ))}
        <button type="button" aria-expanded={reactionPickerOpen} onClick={() => setReactionPickerOpen((open) => !open)} className="min-h-9 rounded-full border border-line px-3 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-text">
          React
        </button>
        {reactionPickerOpen ? (
          <div className="flex min-h-9 items-center gap-1 rounded-full border border-line bg-canvas px-1.5" role="group" aria-label="Choose a reaction">
            {post.reactions.map((reaction) => (
              <button key={reaction.emoji} type="button" aria-label={`${reaction.mine ? 'Remove' : 'Add'} ${REACTION_NAMES[reaction.emoji] ?? 'other'} reaction`} aria-pressed={reaction.mine} onClick={() => { onReact(reaction.emoji); setReactionPickerOpen(false); }} className={cn('flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-surface-hover active:scale-[0.95]', reaction.mine && 'bg-ember/15')}>
                <span aria-hidden>{reaction.emoji}</span>
              </button>
            ))}
          </div>
        ) : null}
        <button type="button" onClick={onReply} className="min-h-9 px-2 text-xs text-muted hover:text-text">
          Reply{post.replyCount > 0 ? ` · ${post.replyCount}` : ''}
        </button>
        {post.author.id === viewerId ? (
          <button type="button" onClick={() => { setEditBody(post.body.replace(IMAGE_MARKER, '').trim()); setEditSpoilers(post.containsSpoilers); setEditing(true); }} className="min-h-9 px-2 text-xs text-muted hover:text-text">Edit</button>
        ) : null}
        {post.author.id !== viewerId ? (
          <button type="button" onClick={onReport} className="min-h-9 px-2 text-xs text-muted hover:text-text">
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
                await onChanged();
              })
            }
            className="min-h-9 px-2 text-xs text-muted hover:text-rose"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}

const IMAGE_MARKER = /\[\[image:([0-9a-f-]{36})\]\]/i;

function PostBody({ body, gifUrl, isReview }: { body: string; gifUrl: string | null; isReview: boolean }) {
  const match = IMAGE_MARKER.exec(body);
  const text = body.replace(IMAGE_MARKER, '').trim();
  return <div className={cn('mt-1.5', isReview && 'rounded-md border-l-2 border-ember/50 pl-3')}>
    {isReview ? <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-ember">Club review</p> : null}
    {text ? <p className="break-words whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-muted [overflow-wrap:anywhere]">{text}</p> : null}
    {match ? <div className="relative mt-2 aspect-[4/3] max-w-sm overflow-hidden rounded-lg border border-line"><Image src={`/media/${match[1]}`} alt="Discussion attachment" fill sizes="(max-width: 640px) 80vw, 384px" className="object-cover" unoptimized /></div> : null}
    {gifUrl ? <div className="relative mt-2 aspect-video max-w-sm overflow-hidden rounded-lg border border-line bg-surface"><Image src={gifUrl} alt="GIF shared in the club discussion" fill sizes="(max-width: 640px) 80vw, 384px" className="object-contain" unoptimized /></div> : null}
  </div>;
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

function readFileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read image'));
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}
