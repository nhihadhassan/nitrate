import 'server-only';

import { env } from '@/env';
import { ProviderError } from '@/server/errors';

import type {
  DiscoverParams,
  MovieProvider,
  ProviderGenre,
  ProviderMovieDetail,
  ProviderMovieSummary,
  ProviderPage,
  ProviderPerson,
  WatchAvailability,
  WatchOption,
} from './types';

const BASE_URL = 'https://api.themoviedb.org/3';

/* -------------------------------------------------------------------------- */
/* Raw TMDB shapes (only the fields we consume)                               */
/* -------------------------------------------------------------------------- */

type TmdbMovie = {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  adult?: boolean;
  genre_ids?: number[];
};

type TmdbMovieDetail = TmdbMovie & {
  runtime?: number | null;
  tagline?: string | null;
  imdb_id?: string | null;
  original_language?: string | null;
  status?: string | null;
  genres?: { id: number; name: string }[];
  credits?: {
    cast?: { id: number; name: string; character?: string; profile_path?: string | null; order?: number; known_for_department?: string }[];
    crew?: { id: number; name: string; job?: string; department?: string; profile_path?: string | null; known_for_department?: string }[];
  };
  similar?: { results?: TmdbMovie[] };
  recommendations?: { results?: TmdbMovie[] };
};

type TmdbPerson = {
  id: number;
  name: string;
  profile_path?: string | null;
  known_for_department?: string | null;
  biography?: string | null;
  known_for?: TmdbMovie[];
};

type TmdbPaged<T> = {
  page?: number;
  results?: T[];
  total_pages?: number;
  total_results?: number;
};

type TmdbWatchOption = {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
  display_priority?: number;
};

type TmdbWatchRegion = {
  link?: string;
  flatrate?: TmdbWatchOption[];
  rent?: TmdbWatchOption[];
  buy?: TmdbWatchOption[];
  free?: TmdbWatchOption[];
  ads?: TmdbWatchOption[];
};

type TmdbWatchProviders = {
  id?: number;
  results?: Record<string, TmdbWatchRegion>;
};

/* -------------------------------------------------------------------------- */
/* Mapping                                                                    */
/* -------------------------------------------------------------------------- */

function yearFrom(releaseDate?: string): number | null {
  if (!releaseDate) return null;
  const year = Number(releaseDate.slice(0, 4));
  return Number.isFinite(year) && year > 1800 ? year : null;
}

function toSummary(movie: TmdbMovie): ProviderMovieSummary {
  return {
    providerId: String(movie.id),
    title: movie.title || movie.original_title || 'Untitled',
    originalTitle: movie.original_title ?? null,
    year: yearFrom(movie.release_date),
    releaseDate: movie.release_date && movie.release_date.length === 10 ? movie.release_date : null,
    posterPath: movie.poster_path ?? null,
    backdropPath: movie.backdrop_path ?? null,
    overview: movie.overview?.trim() || null,
    popularity: movie.popularity ?? 0,
    voteAverage: movie.vote_average ?? 0,
    voteCount: movie.vote_count ?? 0,
    adult: movie.adult ?? false,
    genreIds: movie.genre_ids?.map(String),
  };
}

function toPerson(person: TmdbPerson): ProviderPerson {
  return {
    providerId: String(person.id),
    name: person.name,
    profilePath: person.profile_path ?? null,
    knownForDepartment: person.known_for_department ?? null,
    biography: person.biography ?? null,
    knownFor: person.known_for?.filter((k) => k.title).map(toSummary),
  };
}

function toWatchOption(option: TmdbWatchOption): WatchOption {
  return {
    providerId: String(option.provider_id),
    name: option.provider_name,
    logoPath: option.logo_path ?? null,
    displayPriority: option.display_priority ?? 0,
  };
}

function toPage<T, R>(raw: TmdbPaged<T>, map: (item: T) => R): ProviderPage<R> {
  return {
    results: (raw.results ?? []).map(map),
    page: raw.page ?? 1,
    totalPages: Math.min(raw.total_pages ?? 1, 500),
    totalResults: raw.total_results ?? 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Client                                                                     */
/* -------------------------------------------------------------------------- */

export class TmdbProvider implements MovieProvider {
  readonly id = 'tmdb' as const;

  constructor(private readonly apiKey: string) {}

  /** v4 read tokens are JWTs and go in the Authorization header. */
  private get usesBearer(): boolean {
    return this.apiKey.startsWith('eyJ');
  }

  private async request<T>(
    path: string,
    params: Record<string, string | number | boolean | undefined> = {},
    revalidate = 60 * 60,
  ): Promise<T | null> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
    if (!this.usesBearer) url.searchParams.set('api_key', this.apiKey);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          accept: 'application/json',
          ...(this.usesBearer ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        // Next's Data Cache dedupes and persists these across requests, which is
        // what keeps us from re-asking TMDB for metadata that never changes.
        next: { revalidate },
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      throw new ProviderError(
        error instanceof Error && error.name === 'TimeoutError'
          ? 'The film database timed out.'
          : 'Could not reach the film database.',
      );
    }

    if (response.status === 404) {
      return null;
    }
    if (response.status === 429) {
      throw new ProviderError('The film database is rate limiting us. Try again shortly.');
    }
    if (!response.ok) {
      throw new ProviderError(`Film database error (${response.status}).`);
    }
    return (await response.json()) as T;
  }

  async searchMovies(query: string, page = 1): Promise<ProviderPage<ProviderMovieSummary>> {
    const raw = await this.request<TmdbPaged<TmdbMovie>>(
      '/search/movie',
      { query, page, include_adult: false },
      60 * 60 * 6,
    );
    return toPage(raw ?? {}, toSummary);
  }

  async searchPeople(query: string, page = 1): Promise<ProviderPage<ProviderPerson>> {
    const raw = await this.request<TmdbPaged<TmdbPerson>>(
      '/search/person',
      { query, page, include_adult: false },
      60 * 60 * 6,
    );
    return toPage(raw ?? {}, toPerson);
  }

  async getMovie(providerId: string): Promise<ProviderMovieDetail | null> {
    const raw = await this.request<TmdbMovieDetail>(
      `/movie/${encodeURIComponent(providerId)}`,
      { append_to_response: 'credits,similar,recommendations' },
      60 * 60 * 24 * 7,
    );
    if (!raw) return null;

    const cast = (raw.credits?.cast ?? []).slice(0, 40).map((c, index) => ({
      personProviderId: String(c.id),
      name: c.name,
      profilePath: c.profile_path ?? null,
      knownForDepartment: c.known_for_department ?? 'Acting',
      kind: 'cast' as const,
      character: c.character ?? null,
      order: c.order ?? index,
    }));

    const keptCrewJobs = new Set([
      'Director',
      'Screenplay',
      'Writer',
      'Story',
      'Director of Photography',
      'Original Music Composer',
      'Editor',
      'Producer',
      'Production Design',
      'Costume Design',
    ]);
    const crew = (raw.credits?.crew ?? [])
      .filter((c) => c.job && keptCrewJobs.has(c.job))
      .slice(0, 40)
      .map((c, index) => ({
        personProviderId: String(c.id),
        name: c.name,
        profilePath: c.profile_path ?? null,
        knownForDepartment: c.known_for_department ?? c.department ?? null,
        kind: 'crew' as const,
        department: c.department ?? null,
        job: c.job ?? null,
        order: c.job === 'Director' ? 0 : index + 1,
      }));

    const similarPool = [...(raw.recommendations?.results ?? []), ...(raw.similar?.results ?? [])];
    const seen = new Set<number>();
    const similar: ProviderMovieSummary[] = [];
    for (const movie of similarPool) {
      if (seen.has(movie.id) || String(movie.id) === providerId) continue;
      seen.add(movie.id);
      similar.push(toSummary(movie));
      if (similar.length >= 12) break;
    }

    return {
      ...toSummary(raw),
      runtime: raw.runtime ?? null,
      tagline: raw.tagline?.trim() || null,
      imdbId: raw.imdb_id ?? null,
      originalLanguage: raw.original_language ?? null,
      status: raw.status ?? null,
      genres: (raw.genres ?? []).map((g) => ({ providerId: String(g.id), name: g.name })),
      credits: [...cast, ...crew],
      similar,
    };
  }

  async getPerson(providerId: string): Promise<ProviderPerson | null> {
    const raw = await this.request<TmdbPerson & { movie_credits?: { cast?: TmdbMovie[]; crew?: TmdbMovie[] } }>(
      `/person/${encodeURIComponent(providerId)}`,
      { append_to_response: 'movie_credits' },
      60 * 60 * 24 * 7,
    );
    if (!raw) return null;
    const credits = [...(raw.movie_credits?.cast ?? []), ...(raw.movie_credits?.crew ?? [])]
      .filter((m) => m.title)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    const seen = new Set<number>();
    const knownFor: ProviderMovieSummary[] = [];
    for (const movie of credits) {
      if (seen.has(movie.id)) continue;
      seen.add(movie.id);
      knownFor.push(toSummary(movie));
      if (knownFor.length >= 24) break;
    }
    return { ...toPerson(raw), knownFor };
  }

  async similar(providerId: string, page = 1): Promise<ProviderPage<ProviderMovieSummary>> {
    const raw = await this.request<TmdbPaged<TmdbMovie>>(
      `/movie/${encodeURIComponent(providerId)}/recommendations`,
      { page },
      60 * 60 * 24,
    );
    return toPage(raw ?? {}, toSummary);
  }

  async trending(window: 'day' | 'week' = 'week', page = 1): Promise<ProviderPage<ProviderMovieSummary>> {
    const raw = await this.request<TmdbPaged<TmdbMovie>>(`/trending/movie/${window}`, { page }, 60 * 60 * 3);
    return toPage(raw ?? {}, toSummary);
  }

  async popular(page = 1): Promise<ProviderPage<ProviderMovieSummary>> {
    const raw = await this.request<TmdbPaged<TmdbMovie>>('/movie/popular', { page }, 60 * 60 * 6);
    return toPage(raw ?? {}, toSummary);
  }

  async topRated(page = 1): Promise<ProviderPage<ProviderMovieSummary>> {
    const raw = await this.request<TmdbPaged<TmdbMovie>>('/movie/top_rated', { page }, 60 * 60 * 24);
    return toPage(raw ?? {}, toSummary);
  }

  async nowPlaying(page = 1): Promise<ProviderPage<ProviderMovieSummary>> {
    const raw = await this.request<TmdbPaged<TmdbMovie>>('/movie/now_playing', { page }, 60 * 60 * 12);
    return toPage(raw ?? {}, toSummary);
  }

  async upcoming(page = 1): Promise<ProviderPage<ProviderMovieSummary>> {
    const raw = await this.request<TmdbPaged<TmdbMovie>>('/movie/upcoming', { page }, 60 * 60 * 12);
    return toPage(raw ?? {}, toSummary);
  }

  async discover(params: DiscoverParams): Promise<ProviderPage<ProviderMovieSummary>> {
    const sort =
      params.sortBy === 'rating'
        ? 'vote_average.desc'
        : params.sortBy === 'release_date'
          ? 'primary_release_date.desc'
          : 'popularity.desc';

    const yearFromValue = params.decade ?? params.yearFrom;
    const yearToValue = params.decade ? params.decade + 9 : params.yearTo;

    const raw = await this.request<TmdbPaged<TmdbMovie>>(
      '/discover/movie',
      {
        page: params.page ?? 1,
        sort_by: sort,
        include_adult: false,
        with_genres: params.genreId,
        'vote_count.gte': params.minVotes ?? (params.sortBy === 'rating' ? 500 : 50),
        'primary_release_date.gte': yearFromValue ? `${yearFromValue}-01-01` : undefined,
        'primary_release_date.lte': yearToValue ? `${yearToValue}-12-31` : undefined,
      },
      60 * 60 * 6,
    );
    return toPage(raw ?? {}, toSummary);
  }

  async genres(): Promise<ProviderGenre[]> {
    const raw = await this.request<{ genres?: { id: number; name: string }[] }>(
      '/genre/movie/list',
      {},
      60 * 60 * 24 * 30,
    );
    return (raw?.genres ?? []).map((g) => ({ providerId: String(g.id), name: g.name }));
  }

  // Availability is the most volatile data TMDB serves — a much shorter TTL
  // than the 7-day `getMovie` cache, and deliberately its own request rather
  // than an `append_to_response` on `getMovie` (which is only re-fetched every
  // 30 days locally and would never see fresh availability).
  async watchProviders(providerId: string, region: string): Promise<WatchAvailability | null> {
    const raw = await this.request<TmdbWatchProviders>(
      `/movie/${encodeURIComponent(providerId)}/watch/providers`,
      {},
      60 * 60 * 12,
    );
    const forRegion = raw?.results?.[region.toUpperCase()];
    if (!forRegion) return null;

    return {
      region: region.toUpperCase(),
      link: forRegion.link ?? null,
      stream: (forRegion.flatrate ?? []).map(toWatchOption),
      rent: (forRegion.rent ?? []).map(toWatchOption),
      buy: (forRegion.buy ?? []).map(toWatchOption),
      free: [...(forRegion.free ?? []), ...(forRegion.ads ?? [])].map(toWatchOption),
    };
  }

  async watchRegions(): Promise<{ code: string; name: string }[]> {
    const raw = await this.request<{ results?: { iso_3166_1: string; english_name: string }[] }>(
      '/watch/providers/regions',
      {},
      60 * 60 * 24 * 30,
    );
    return (raw?.results ?? []).map((r) => ({ code: r.iso_3166_1, name: r.english_name }));
  }
}

export function createTmdbProvider(): TmdbProvider | null {
  const key = env.tmdbApiKey;
  return key ? new TmdbProvider(key) : null;
}
