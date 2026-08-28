import { stageFiles } from '@/server/import/letterboxd';

import type { ImportAdapter } from './types';

export const letterboxdImportAdapter: ImportAdapter = {
  source: 'letterboxd',
  displayName: 'Letterboxd',
  canRead(files) {
    return files.some((file) => file.name.toLowerCase().endsWith('.csv'));
  },
  stage(files) {
    return stageFiles(files);
  },
};

export const importAdapters: readonly ImportAdapter[] = [letterboxdImportAdapter];

// IMDb remains intentionally absent until representative export fixtures and
// demonstrated demand make a safe field mapping possible.
