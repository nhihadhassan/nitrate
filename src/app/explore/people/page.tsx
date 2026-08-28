import type { Metadata } from 'next';

import { RecommendationFeedback } from '@/components/discovery/recommendation-feedback';
import { FollowButton } from '@/components/user/follow-button';
import { Container, EmptyState } from '@/components/ui/primitives';
import { recommendationReasonLabel } from '@/lib/recommendations';
import { pluralize } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { getPeopleRecommendations } from '@/server/services/discovery';
import { getSuggestedUsers } from '@/server/services/profile';

export const metadata: Metadata = { title: 'Find people' };
export const dynamic = 'force-dynamic';

export default async function ExplorePeoplePage() {
  const user = await getCurrentUser();
  const people = user
    ? await getPeopleRecommendations(user.id, 40)
    : (await getSuggestedUsers(null, 40)).map((person) => ({
        user: person,
        reasons: [],
        sharedRatings: 0,
      }));

  return (
    <Container size="wide" className="py-8">
      <header className="mb-7 max-w-2xl">
        <h1 className="text-3xl sm:text-4xl">Find people</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Bounded suggestions from Movie Clubs and people you already follow. Similar-taste
          discovery appears in Network only after its community evidence gate opens, and never
          makes a taste claim below 10 shared ratings.
        </p>
      </header>

      {people.length ? (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {people.map(({ user: person, reasons }) => (
            <li key={person.id} className="flex min-h-40 flex-col rounded-lg border border-line p-4">
              <div className="min-w-0">
                <a href={`/@${person.username}`} className="block truncate text-lg font-medium hover:text-ember">
                  {person.displayName}
                </a>
                <p className="truncate text-xs text-dim">@{person.username} · {pluralize(person.filmCount, 'film')}</p>
              </div>
              <ul className="mt-3 min-h-10 space-y-1 text-xs leading-relaxed text-muted">
                {reasons.slice(0, 2).map((reason) => (
                  <li key={reason.kind}>{recommendationReasonLabel(reason)}</li>
                ))}
                {!reasons.length ? <li>Active public film diary</li> : null}
              </ul>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                <FollowButton
                  userId={person.id}
                  initialFollowing={false}
                  signedIn={Boolean(user)}
                  source={user ? 'recommendation' : undefined}
                />
                {user ? (
                  <RecommendationFeedback
                    targetType="user"
                    targetId={person.id}
                    reasonKind={reasons[0]?.kind}
                    includeAlreadyKnow
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No suggestions right now"
          description="You have reached the end of the bounded suggestion pool. Hidden suggestions can be restored in Discovery settings."
        />
      )}
    </Container>
  );
}
