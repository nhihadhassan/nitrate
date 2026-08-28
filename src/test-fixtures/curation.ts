export type SyntheticCurationState = {
  title: string;
  description: string;
  unavailable?: boolean;
  conflict?: string;
  itemCount: number;
  items: Array<{ id: string; title: string; year: number; contributor: string; note: string | null }>;
  editors: Array<{ name: string; status: 'owner' | 'editor' | 'pending' | 'expired' }>;
};

export function syntheticCurationState(state: string): SyntheticCurationState {
  if (state === 'private' || state === 'blocked') {
    return {
      title: 'This list is unavailable',
      description: 'Privacy and block denials use the same quiet boundary.',
      unavailable: true,
      itemCount: 0,
      items: [],
      editors: [],
    };
  }
  const highVolume = state === 'high-volume';
  const imported = state === 'imported';
  const count = highVolume ? 500 : imported ? 25 : 8;
  return {
    title: imported ? 'Imported films, curated together' : highVolume ? 'The 500-film collaboration' : 'Rainy-night double features',
    description: state === 'failure'
      ? 'The last saved version remains intact while the mutation fails safely.'
      : 'An owner and two editors curating with attribution and version checks.',
    conflict: state === 'stale' ? 'This list changed in another tab. Refresh before reordering.' : state === 'failure' ? 'Synthetic write failure. Nothing was partially applied.' : undefined,
    itemCount: count,
    items: Array.from({ length: Math.min(count, 25) }, (_, index) => ({
      id: `curation-${index}`,
      title: `${imported ? 'Imported' : 'Curated'} Film ${index + 1}`,
      year: 1970 + (index % 50),
      contributor: index % 3 === 0 ? 'Avery' : index % 3 === 1 ? 'Morgan' : 'Samira',
      note: index % 4 === 0 ? 'Pairs beautifully with the film before it.' : null,
    })),
    editors: [
      { name: 'Avery', status: 'owner' },
      { name: 'Morgan', status: 'editor' },
      { name: 'Samira', status: state === 'pending' ? 'pending' : 'editor' },
    ],
  };
}
