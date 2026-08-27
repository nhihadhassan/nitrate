export const LIBRARY_FIXTURE_STATES = ['sparse', 'normal', 'imported', 'high-volume', 'private', 'blocked', 'failure'] as const;

export function syntheticLibraryState(name: string) {
  const state = LIBRARY_FIXTURE_STATES.includes(name as never) ? name : 'normal';
  const counts = state === 'sparse' ? { diary: 1, films: 2, ownership: 0 }
    : state === 'high-volume' ? { diary: 48_400, films: 21_700, ownership: 386 }
      : { diary: 284, films: 221, ownership: 19 };
  return {
    state,
    title: state === 'failure' ? 'Export temporarily unavailable' : state === 'high-volume' ? 'A permanent library at scale' : 'Your film library, portable',
    description: state === 'imported' ? 'Imported Letterboxd rows retain source and stable dedupe keys.'
      : state === 'private' ? 'Private notes, ownership, and non-public diary entries stay inside the signed-in export.'
        : state === 'blocked' ? 'No other member’s private data or club discussions cross the export boundary.'
          : state === 'failure' ? 'The download fails closed without creating a partial public artifact.'
            : 'Cursor batches produce versioned JSON, readable CSVs, and safe Letterboxd mappings.',
    counts,
    copies: state === 'sparse' ? [] : [
      { title: 'In the Mood for Love', format: '4K UHD', edition: 'Criterion', purchased: '2025-11-03' },
      { title: 'Heat', format: 'Blu-ray', edition: null, purchased: null },
      { title: 'Stalker', format: 'Digital', edition: null, purchased: '2024-02-12' },
    ],
    contexts: ['Cinema', 'At home', 'Movie Club', 'Festival'],
    failed: state === 'failure',
  };
}
