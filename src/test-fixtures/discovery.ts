import { peopleRecommendationReasons, type RecommendationReason } from '@/lib/recommendations';

export type SyntheticDiscoveryState = {
  title: string;
  description: string;
  people: Array<{
    id: string;
    name: string;
    username: string;
    filmCount: number;
    reasons: RecommendationReason[];
  }>;
  circle: Array<{ name: string; username: string }>;
  hidden: Array<{ label: string; detail: string }>;
  failure?: string;
};

const basePeople = [
  { id: 'person-1', name: 'Avery Chen', username: 'avery', filmCount: 438 },
  { id: 'person-2', name: 'Morgan Okafor', username: 'morgan', filmCount: 291 },
  { id: 'person-3', name: 'Samira Vale', username: 'samira', filmCount: 176 },
];

export function syntheticDiscoveryState(state: string): SyntheticDiscoveryState {
  if (state === 'private' || state === 'blocked') {
    return {
      title: 'No suggestions right now',
      description: `${state === 'private' ? 'Private profiles' : 'Blocked relationships'} are removed before recommendation scoring.`,
      people: [],
      circle: [],
      hidden: [],
    };
  }
  if (state === 'failure') {
    return {
      title: 'Discovery is taking a quiet night',
      description: 'Existing Home activity remains chronological while suggestions are unavailable.',
      people: [],
      circle: [],
      hidden: [],
      failure: 'Synthetic provider and recommendation-query failure',
    };
  }

  const limited = state === 'limited-overlap';
  const people = basePeople.map((person, index) => ({
    ...person,
    reasons: peopleRecommendationReasons({
      sharedRatings: limited ? 9 - index : 18 + index * 4,
      sharedFavourites: index === 0 ? ['Moonlight'] : [],
      sharedClubs: index === 1 ? 1 : 0,
      mutualFollows: index + 1,
    }),
  }));
  return {
    title: limited ? 'Context without a premature taste claim' : 'Explainable people suggestions',
    description: limited
      ? 'Nine shared ratings is useful context, but below Nitrate’s ten-rating threshold.'
      : 'Every suggestion names its strongest evidence and never displays a match percentage.',
    people,
    circle: (state === 'circle-full' ? [...basePeople, { id: '4', name: 'Noor Park', username: 'noor', filmCount: 99 }, { id: '5', name: 'Leo Hart', username: 'leo', filmCount: 88 }] : basePeople.slice(0, 2))
      .map(({ name, username }) => ({ name, username })),
    hidden: [
      { label: 'Synthetic Film 12', detail: 'Less like this until 2026-09-26' },
      { label: 'Jordan Rivera', detail: 'Already know · hidden until restored' },
    ],
  };
}
