/**
 * The contract every movie metadata source must satisfy.
 *
 * Nothing above this layer knows what TMDB is. Swapping in another provider (or
 * running against our own cached catalogue during an outage) is a matter of
 * returning these shapes.
 */

export type ProviderId = 'tmdb' | 'offline';

export type ProviderMovieSummary = {
  providerId: string;
  title: string;
  originalTitle?: string | null;
  year: number | null;
  releaseDate: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  popularity: number;
  voteAverage: number;
  voteCount: number;
  adult: boolean;
  genreIds?: string[];
};

export type ProviderCredit = {
  personProviderId: string;
  name: string;
  profilePath: string | null;
  knownForDepartment: string | null;
  kind: 'cast' | 'crew';
  character?: string | null;
  department?: string | null;
  job?: string | null;
  order: number;
};

export type ProviderGenre = { providerId: string; name: string };

export type ProviderMovieDetail = ProviderMovieSummary & {
  runtime: number | null;
  tagline: string | null;
  imdbId: string | null;
  originalLanguage: string | null;
  status: string | null;
  genres: ProviderGenre[];
  credits: ProviderCredit[];
  similar: ProviderMovieSummary[];
};

export type ProviderPerson = {
  providerId: string;
  name: string;
  profilePath: string | null;
  knownForDepartment: string | null;
  biography?: string | null;
  knownFor?: ProviderMovieSummary[];
};

export type ProviderPage<T> = {
  results: T[];
  page: number;
  totalPages: number;
  totalResults: number;
};

export type DiscoverParams = {
  page?: number;
  genreId?: string;
  decade?: number;
  yearFrom?: number;
  yearTo?: number;
  sortBy?: 'popularity' | 'rating' | 'release_date';
  minVotes?: number;
};

export interface MovieProvider {
  readonly id: ProviderId;
  searchMovies(query: string, page?: number): Promise<ProviderPage<ProviderMovieSummary>>;
  searchPeople(query: string, page?: number): Promise<ProviderPage<ProviderPerson>>;
  getMovie(providerId: string): Promise<ProviderMovieDetail | null>;
  getPerson(providerId: string): Promise<ProviderPerson | null>;
  trending(window?: 'day' | 'week'): Promise<ProviderPage<ProviderMovieSummary>>;
  popular(page?: number): Promise<ProviderPage<ProviderMovieSummary>>;
  topRated(page?: number): Promise<ProviderPage<ProviderMovieSummary>>;
  nowPlaying(page?: number): Promise<ProviderPage<ProviderMovieSummary>>;
  upcoming(page?: number): Promise<ProviderPage<ProviderMovieSummary>>;
  discover(params: DiscoverParams): Promise<ProviderPage<ProviderMovieSummary>>;
  genres(): Promise<ProviderGenre[]>;
}

export const emptyPage = <T>(): ProviderPage<T> => ({
  results: [],
  page: 1,
  totalPages: 0,
  totalResults: 0,
});
