export type ImportSource = 'letterboxd';

export type ImportSourceFile = { name: string; text: string };

export type ImportAdapterRow = {
  kind: 'diary' | 'review' | 'rating' | 'watched' | 'watchlist' | 'list_item';
  rawTitle: string;
  rawYear: number | null;
  rawUri: string | null;
  payload: Record<string, unknown>;
  dedupeKey: string;
};

export interface ImportAdapter {
  readonly source: ImportSource;
  readonly displayName: string;
  canRead(files: ImportSourceFile[]): boolean;
  stage(files: ImportSourceFile[]): ImportAdapterRow[];
}
