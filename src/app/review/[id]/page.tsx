import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { and, eq, isNull, sql } from 'drizzle-orm';

import { Poster } from '@/components/film/poster';
import { LikeMark, Stars } from '@/components/film/stars';
import { ReviewActions } from '@/components/review/review-actions';
import { ReviewBody } from '@/components/review/review-body';
import { Comments } from '@/components/social/comments';
import { Badge, Container, Divider } from '@/components/ui/primitives';
import { UserChip } from '@/components/user/avatar';
import { ProfilePinButton } from '@/components/user/profile-pin-button';
import { filmHref } from '@/lib/links';
import { formatDateOnly, truncate } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { db } from '@/server/db';
import { diaryEntries, diaryEntryTags, movies, reviewLikes, tags, users } from '@/server/db/schema';
import { viewableSql } from '@/server/privacy';
import { getComments } from '@/server/services/lists';
import { isProfilePinned } from '@/server/services/profile-pins';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

async function loadReview(id: string, viewer: { id: string; role: 'member' | 'moderator' | 'admin' } | null) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ entry: diaryEntries, movie: movies, author: users })
    .from(diaryEntries)
    .innerJoin(movies, eq(movies.id, diaryEntries.movieId))
    .innerJoin(users, eq(users.id, diaryEntries.userId))
    .where(
      and(
        eq(diaryEntries.id, id),
        isNull(diaryEntries.deletedAt),
        isNull(users.deletedAt),
        viewableSql(sql`${diaryEntries.visibility}`, sql`${diaryEntries.userId}`, viewer),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const row = await loadReview(id, null);
  if (!row) return { title: 'Review' };
  return {
    title: `${row.author.displayName} on ${row.movie.title}`,
    description: row.entry.containsSpoilers
      ? 'This review contains spoilers.'
      : truncate(row.entry.reviewText ?? '', 160),
  };
}

export default async function ReviewPage({ params }: Params) {
  const { id } = await params;
  const viewerUser = await getCurrentUser();
  const viewer = viewerUser ? { id: viewerUser.id, role: viewerUser.role } : null;

  const row = await loadReview(id, viewer);
  if (!row) notFound();

  const { entry, movie, author } = row;

  const [entryTags, commentRows, liked, pinned] = await Promise.all([
    db
      .select({ name: tags.name })
      .from(diaryEntryTags)
      .innerJoin(tags, eq(tags.id, diaryEntryTags.tagId))
      .where(eq(diaryEntryTags.diaryEntryId, entry.id)),
    getComments('review', entry.id),
    viewer
      ? db
          .select({ userId: reviewLikes.userId })
          .from(reviewLikes)
          .where(and(eq(reviewLikes.diaryEntryId, entry.id), eq(reviewLikes.userId, viewer.id)))
          .limit(1)
          .then((rows) => rows.length > 0)
      : Promise.resolve(false),
    viewer?.id === author.id ? isProfilePinned(author.id, 'review', entry.id) : Promise.resolve(false),
  ]);

  return (
    <Container size="narrow" className="py-8">
      <article>
        <div className="flex gap-4">
          <div className="w-20 shrink-0 sm:w-24">
            <Poster
              film={{
                slug: movie.slug,
                title: movie.title,
                year: movie.year,
                posterPath: movie.posterPath,
              }}
              size="sm"
            />
          </div>
          <div className="min-w-0 flex-1">
            <Link href={filmHref(movie)} className="block">
              <h1 className="text-2xl leading-tight hover:text-ember sm:text-3xl">{movie.title}</h1>
            </Link>
            {movie.year ? <p className="text-sm text-dim tabular">{movie.year}</p> : null}
            <div className="mt-3">
              <UserChip user={author} size="sm" showUsername />
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {entry.rating ? <Stars value={entry.rating} size="lg" /> : null}
          {entry.liked ? <LikeMark className="text-xl text-rose" /> : null}
          {entry.isRewatch ? <Badge tone="iris">Rewatch</Badge> : null}
          {entry.visibility !== 'public' ? (
            <Badge>{entry.visibility === 'private' ? 'Private' : 'Followers only'}</Badge>
          ) : null}
          <span className="text-xs text-dim">Watched {formatDateOnly(entry.watchedDate)}</span>
        </div>

        <div className="mt-5">
          <ReviewBody text={entry.reviewText ?? ''} containsSpoilers={entry.containsSpoilers} />
        </div>

        {entryTags.length ? (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {entryTags.map((tag) => (
              <li
                key={tag.name}
                className="rounded-xs border border-line px-2 py-0.5 text-xs text-muted"
              >
                #{tag.name}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-6">
          <ReviewActions
            entryId={entry.id}
            initialLiked={liked}
            initialLikeCount={entry.likeCount}
            isAuthor={viewer?.id === author.id}
            signedIn={Boolean(viewer)}
            authorUsername={author.username}
          />
          {viewer?.id === author.id && entry.visibility !== 'private' ? <span className="ml-2 inline-flex"><ProfilePinButton targetType="review" targetId={entry.id} initialPinned={pinned}/></span>:null}
        </div>
      </article>

      <Divider className="my-8" />

      <Comments
        subjectType="review"
        subjectId={entry.id}
        viewerId={viewer?.id ?? null}
        ownerId={author.id}
        canModerate={viewer?.role === 'admin' || viewer?.role === 'moderator'}
        comments={commentRows.map((comment) => ({
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt.toISOString(),
          parentId: comment.parentId,
          containsSpoilers: comment.containsSpoilers,
          author: {
            id: comment.authorId,
            username: comment.username,
            displayName: comment.displayName,
            avatarAssetId: comment.avatarAssetId,
          },
        }))}
      />
    </Container>
  );
}
