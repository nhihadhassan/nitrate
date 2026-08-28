import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Poster } from '@/components/film/poster';
import { RecommendationContext } from '@/components/discovery/recommendation-context';
import { ListActions } from '@/components/list/list-actions';
import { CollaboratorManager, ListEditor, ListOwnerSettings, MovieIdeasTransfer } from '@/components/list/shared-list-tools';
import { Comments } from '@/components/social/comments';
import { Badge, Container, Divider, EmptyState } from '@/components/ui/primitives';
import { UserChip } from '@/components/user/avatar';
import { ProfilePinButton } from '@/components/user/profile-pin-button';
import { filmHref } from '@/lib/links';
import { pluralize, truncate } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { AppError } from '@/server/errors';
import { getComments, getListDetail, getOwnerListInvitations } from '@/server/services/lists';
import { getUserClubs } from '@/server/services/clubs';
import { getMovieRecommendationContext } from '@/server/services/discovery';
import { isProfilePinned } from '@/server/services/profile-pins';

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

  const { list, owner, items, likedByViewer, savedByViewer, canEdit, isOwner, collaborators, activity, clonedFrom } = detail;
  const [commentRows, movieContext, clubs, invitations, pinned] = await Promise.all([
    getComments('list', list.id),
    viewerUser ? getMovieRecommendationContext(viewerUser.id, items.map((item) => item.movie.id)) : Promise.resolve(new Map()),
    viewerUser ? getUserClubs(viewerUser.id) : Promise.resolve([]),
    viewerUser && isOwner ? getOwnerListInvitations(list.id, viewerUser.id) : Promise.resolve([]),
    viewerUser && isOwner ? isProfilePinned(viewerUser.id, 'list', list.id) : Promise.resolve(false),
  ]);

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
        {clonedFrom ? <p className="mt-3 text-xs text-dim">Cloned from <Link href={`/list/${clonedFrom.id}`} className="underline underline-offset-2 hover:text-ember">{clonedFrom.title}</Link></p> : null}

        <div className="mt-5">
          <ListActions
            listId={list.id}
            initialLiked={likedByViewer}
            initialLikeCount={list.likeCount}
            initialSaved={savedByViewer}
            canEdit={canEdit}
            isOwner={isOwner}
            signedIn={Boolean(viewer)}
            ownerUsername={owner.username}
            visibility={list.visibility}
          />
          {isOwner && list.visibility !== 'private' ? <span className="ml-2 inline-flex"><ProfilePinButton targetType="list" targetId={list.id} initialPinned={pinned}/></span>:null}
        </div>
      </header>

      {viewerUser && canEdit ? (
        <section className="mb-8 space-y-3" aria-label="List editing tools">
          <ListEditor
            listId={list.id}
            initialVersion={list.version}
            initialItems={items.map((item) => ({
              id: item.id,
              movieId: item.movie.id,
              providerId: item.movie.providerId,
              title: item.movie.title,
              year: item.movie.year,
              note: item.note,
            }))}
          />
          {isOwner ? <ListOwnerSettings list={{
            id: list.id,
            title: list.title,
            description: list.description,
            visibility: list.visibility,
            isRanked: list.isRanked,
            allowCollaborators: list.allowCollaborators,
            isPinned: list.isPinned,
          }} /> : null}
          {isOwner ? <CollaboratorManager
            listId={list.id}
            collaborators={collaborators}
            invitations={invitations.map(({ invitation, invitee }) => ({
              id: invitation.id,
              username: invitee.username,
              displayName: invitee.displayName,
              status: invitation.status,
              expiresAt: invitation.expiresAt.toISOString(),
            }))}
          /> : null}
        </section>
      ) : null}

      {viewerUser ? <section className="mb-8"><MovieIdeasTransfer
        listId={list.id}
        items={items.map((item) => ({ movieId: item.movie.id, title: item.movie.title }))}
        clubs={clubs.map(({ club }) => ({ id: club.id, name: club.name }))}
      /></section> : null}

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
                  <Link href={filmHref(item.movie)} className="font-medium hover:text-ember">
                    {item.movie.title}
                  </Link>
                  {item.movie.year ? (
                    <span className="ml-2 text-xs text-dim tabular">{item.movie.year}</span>
                  ) : null}
                  {item.note ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.note}</p>
                  ) : null}
                  {item.addedBy && item.addedBy.id !== owner.id ? <p className="mt-0.5 text-[0.6875rem] text-dim">Added by {item.addedBy.displayName}</p> : null}
                  <RecommendationContext reasons={movieContext.get(item.movie.id) ?? []} />
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
                {item.addedBy && item.addedBy.id !== owner.id ? <p className="mt-1 text-[0.6875rem] text-dim">Added by {item.addedBy.displayName}</p> : null}
                <RecommendationContext reasons={movieContext.get(item.movie.id) ?? []} />
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

      {activity.length ? (
        <details className="mb-10 max-w-2xl border-y border-line py-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Contribution activity</summary>
          <ol className="mt-2 space-y-2 text-xs text-muted">{activity.slice(0, 20).map((entry) => <li key={entry.id}><span className="font-medium text-text">{entry.actor.displayName}</span> {activityLabel(entry.action)} <span className="text-dim">· {entry.createdAt.toLocaleDateString('en-CA')}</span></li>)}</ol>
        </details>
      ) : null}

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

function activityLabel(action: string): string {
  return ({
    list_updated: 'updated the list',
    item_added: 'added a film',
    item_removed: 'removed a film',
    note_updated: 'updated a note',
    reordered: 'reordered the list',
    collaborator_added: 'joined as an editor',
    collaborator_removed: 'removed an editor',
    cloned: 'cloned a source list',
    bulk_transferred: 'transferred films to Movie Ideas',
  } as Record<string, string>)[action] ?? 'contributed';
}
