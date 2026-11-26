import type {Genre, SeasonDetails, TitleDetails, TitleSummary, Video} from './title';
import type {PersonDetails} from './person';
import type {CatalogProvider, Region, RegionAvailability, RegionCode} from './providers';
import type {Paged, SearchResult, SearchType} from './search';
import type {TitleKey} from './keys';

export type RailId = 'trending' | 'popular-movies' | 'popular-tv' | 'in-theaters' | 'streaming-now' | 'acclaimed' | 'new-episodes';

export interface HeroItem extends TitleSummary {
  trailer: Video | null;
}

export interface Rail {
  id: RailId;
  kind: 'ranked' | 'posters';
  items: TitleSummary[];
}

export interface HomeResponse { v: 2; region: RegionCode; generatedAt: string; hero: HeroItem[]; rails: Rail[] }
export interface DiscoverResponse extends Paged<TitleSummary> { v: 2 }
export interface SearchResponse extends Paged<SearchResult> { v: 2; q: string; type: SearchType }
export interface TitleResponse { v: 2; title: TitleDetails }
export interface SeasonResponse { v: 2; season: SeasonDetails }
export interface PersonResponse { v: 2; person: PersonDetails }
export interface GenresResponse { v: 2; genres: Genre[] }
export interface RegionsResponse { v: 2; regions: Region[] }
export interface ProvidersResponse { v: 2; region: RegionCode; providers: CatalogProvider[] }
export interface AvailabilityRequest { region: RegionCode; keys: TitleKey[] }
export interface AvailabilityResponse { v: 2; region: RegionCode; items: Partial<Record<TitleKey, RegionAvailability | null>>; failed: TitleKey[] }

export interface ResolvedTitle {
  key: TitleKey;
  slug: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  imdbId: string | null;
}

export interface FindResponse { v: 2; imdbId: string; match: ResolvedTitle }
export interface LegacyMovieResponse { v: 2; v1Id: number; imdbId: string; match: ResolvedTitle; path: string }
export interface V1Candidate { id: number; title: string | null; year: number | null }
export interface ResolveRequest { imdb: string[]; v1: V1Candidate[] }
export interface ResolveResponse {
  v: 2;
  imdb: Record<string, ResolvedTitle | null>;
  v1: Record<string, ResolvedTitle | null>;
  failed: {imdb: string[]; v1: number[]};
}
export interface GeoResponse { v: 2; country: RegionCode | null }
export interface HealthResponse { v: 2; ok: true; upstream: 'ok'; legacy: 'ok' | 'retired'; tmdbKey: 'env' | 'fallback' | 'fixtures' }

export type ApiErrorCode =
  | 'invalid_request' | 'not_found' | 'method_not_allowed' | 'payload_too_large'
  | 'rate_limited' | 'upstream_rate_limited' | 'upstream_unavailable' | 'upstream_timeout' | 'internal';

export interface ApiErrorBody { error: {code: ApiErrorCode; message: string; retryAfterSeconds?: number} }
