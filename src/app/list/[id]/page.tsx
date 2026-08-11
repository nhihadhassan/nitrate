import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Poster } from '@/components/film/poster';
import { ListActions } from '@/components/list/list-actions';
import { Comments } from '@/components/social/comments';
import { Badge, Container, Divider, EmptyState } from '@/components/ui/primitives';
import { UserChip } from '@/components/user/avatar';
import { pluralize, truncate } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { AppError } from '@/server/errors';
import { getComments, getListDetail } from '@/server/services/lists';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  try {
    const { list } = await getListDetail(id, null);
    return {
      title: list.title,
      description: list.description ? truncate(list.description, 160) : undefined,
    };
  } catch {
    return { title: 'List' };
  }
}

export default async function ListPage({ params }: Params) {
  const { id } = await params;
  const viewerUser = await getCurrentUser();
  const viewer = viewerUser ? { id: viewerUser.id, role: viewerUser.role } : null;

  let detail;
  try {
    detail = await getListDetail(id, viewer);
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }

  const { list, owner, items, likedByViewer, canEdit } = detail;
  const commentRows = await getComments('list', list.id);

  return (
    <Container size="wide" className="py-8">
      <header className="mb-7 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          {list.isRanked ? <Badge tone="ember">Ranked</Badge> : null}
          {list.visibility !== 'public' ? (
            <Badge>{list.visibility === 'private' ? 'Private' : 'Followers only'}</Badge>
          ) : null}
        </div>
        <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">{list.title}</h1>
        <div className="mt-3">
          <UserChip user={owner} size="sm" subtitle={pluralize(list.itemCount, 'film')} />
        </div>
        {list.description ? (
          <p className="mt-4 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-muted">
            {list.description}
          </p>
        ) : null}

        <div className="mt-5">
          <ListActions
            listId={list.id}
            initialLiked={likedByViewer}
            initialLikeCount={list.likeCount}
            canEdit={canEdit}
            signedIn={Boolean(viewer)}
            ownerUsername={owner.username}
          />
        </div>
      </header>

      {items.length ? (
        <ol
          className={
            list.isRanked
              ? 'space-y-2'
              : 'grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8'
          }
        >
          {items.map((item, index) =>
            list.isRanked ? (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-md border border-line px-3 py-2.5"
              >
                <span className="w-7 shrink-0 text-center font-display text-xl text-dim tabular">
                  {index + 1}
                </span>
                <div className="w-11 shrink-0">
                  <Poster
                    film={{
                      slug: item.movie.slug,
                      title: item.movie.title,
                      year: item.movie.year,
                      posterPath: item.movie.posterPath,
                    }}
                    size="xs"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/film/${item.movie.slug}`} className="font-medium hover:text-ember">
                    {item.movie.title}
                  </Link>
                  {item.movie.year ? (
                    <span className="ml-2 text-xs text-dim tabular">{item.movie.year}</span>
                  ) : null}
                  {item.note ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.note}</p>
                  ) : null}
                </div>
              </li>
            ) : (
              <li key={item.id}>
                <Poster
                  film={{
                    slug: item.movie.slug,
                    title: item.movie.title,
                    year: item.movie.year,
                    posterPath: item.movie.posterPath,
                  }}
                />
                {item.note ? (
                  <p className="mt-1.5 text-[0.6875rem] leading-snug text-dim">{item.note}</p>
                ) : null}
              </li>
            ),
          )}
        </ol>
      ) : (
        <EmptyState
          title="This list is empty"
          description={canEdit ? 'Add some films to get it going.' : 'Nothing here yet.'}
        />
      )}

      <Divider className="my-10" />

      <div className="max-w-2xl">
        <Comments
          subjectType="list"
          subjectId={list.id}
          viewerId={viewer?.id ?? null}
          ownerId={owner.id}
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
      </div>
    </Container>
  );
}
