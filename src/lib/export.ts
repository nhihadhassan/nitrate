export const NITRATE_EXPORT_VERSION = '1.0' as const;

export type ExportManifestV1 = {
  schemaVersion: typeof NITRATE_EXPORT_VERSION;
  product: 'Nitrate';
  generatedAt: string;
  userId: string;
  username: string;
  files: Array<{ path: string; format: 'json' | 'csv'; records: number; description: string }>;
  privacy: {
    otherPeoplePrivateDataIncluded: false;
    clubDiscussionsIncluded: false;
  };
  batching: { strategy: 'cursor'; batchSize: number };
};

export type ExportMovieV1 = {
  id: string;
  provider: string;
  providerId: string;
  imdbId: string | null;
  title: string;
  year: number | null;
  runtime: number | null;
};

export type NitrateExportV1 = {
  schemaVersion: typeof NITRATE_EXPORT_VERSION;
  exportedAt: string;
  profile: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    bio: string | null;
    location: string | null;
    websiteUrl: string | null;
    pronouns: string | null;
    timezone: string;
    watchRegion: string | null;
    createdAt: string;
  };
  sections: {
    diary: unknown[];
    filmState: unknown[];
    favourites: unknown[];
    lists: unknown[];
    tags: unknown[];
    ownership: unknown[];
    clubContributions: unknown[];
    clubRatings: unknown[];
    attendance: unknown[];
  };
};

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function csvRow(values: unknown[]): string {
  return `${values.map(csvCell).join(',')}\r\n`;
}

export function toLetterboxdRating(rating: number | null): string {
  return rating === null ? '' : String(rating / 2);
}
