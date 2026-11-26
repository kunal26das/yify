import type {
  AvailabilityResponse,
  DiscoverResponse,
  FindResponse,
  GenresResponse,
  GeoResponse,
  HealthResponse,
  HeroItem,
  HomeResponse,
  LegacyMovieResponse,
  PersonResponse,
  ProvidersResponse,
  Rail,
  RailId,
  RegionsResponse,
  ResolvedTitle,
  ResolveResponse,
  SearchResponse,
  SeasonResponse,
  TitleResponse,
} from '@/core/domain/api';
import type {MediaType, PersonKey, TitleKey} from '@/core/domain/keys';
import {MAX_TMDB_ID, parseTitleKey} from '@/core/domain/keys';
import type {PersonCredit, PersonDetails, PersonSummary} from '@/core/domain/person';
import type {CatalogProvider, OfferType, Provider, Region, RegionAvailability, RegionCode} from '@/core/domain/providers';
import {OFFER_TYPES} from '@/core/domain/providers';
import type {Paged, SearchResult, SearchType} from '@/core/domain/search';
import type {
  CastCredit,
  CrewCredit,
  Episode,
  EpisodeSummary,
  Genre,
  MovieDetails,
  SeasonDetails,
  SeasonSummary,
  TitleDetails,
  TitleSummary,
  TvDetails,
  Video,
  VideoType,
} from '@/core/domain/title';
import {ApiDecodeError} from './errors';
import {rememberSummary} from './summaryCache';

type Json = Record<string, unknown>;
type Members<T extends string> = Readonly<Record<T, true>>;

const REGION_CODE = /^[A-Z]{2}$/;
const YOUTUBE_KEY = /^[A-Za-z0-9_-]{11}$/;
const IMDB_ID = /^tt\d{7,10}$/;

const MEDIA_TYPES: Members<MediaType> = {movie: true, tv: true};
const SEARCH_TYPES: Members<SearchType> = {all: true, movie: true, tv: true, person: true};
const RAIL_IDS: Members<RailId> = {
  'trending': true,
  'popular-movies': true,
  'popular-tv': true,
  'in-theaters': true,
  'streaming-now': true,
  'acclaimed': true,
  'new-episodes': true,
};
const RAIL_KINDS: Members<Rail['kind']> = {ranked: true, posters: true};
const VIDEO_TYPES: Members<VideoType> = {
  'Trailer': true,
  'Teaser': true,
  'Clip': true,
  'Featurette': true,
  'Behind the Scenes': true,
  'Bloopers': true,
  'Opening Credits': true,
};
const KEY_SOURCES: Members<HealthResponse['tmdbKey']> = {env: true, fallback: true, fixtures: true};
const LEGACY_STATES: Members<HealthResponse['legacy']> = {ok: true, retired: true};

function record(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null;
}

function isMember<T extends string>(members: Members<T>, value: unknown): value is T {
  return typeof value === 'string' && Object.hasOwn(members, value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isNullableCount(value: unknown): value is number | null {
  return value === null || isCount(value);
}

function isId(value: unknown): value is number {
  return isCount(value) && value >= 1 && value <= MAX_TMDB_ID;
}

function isNullableRating(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10);
}

function isRegionCode(value: unknown): value is RegionCode {
  return typeof value === 'string' && REGION_CODE.test(value);
}

function isNullableYear(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 1000 && value <= 9999);
}

function list<T>(value: unknown[], decodeItem: (item: unknown) => T | null): T[] {
  const items: T[] = [];
  for (const item of value) {
    const decoded = decodeItem(item);
    if (decoded !== null) items.push(decoded);
  }
  return items;
}

function strings(value: unknown[]): string[] {
  return value.filter((item): item is string => typeof item === 'string');
}

function mediaTypes(value: unknown[]): MediaType[] {
  return value.filter((item): item is MediaType => isMember(MEDIA_TYPES, item));
}

function expectObject(body: unknown, route: string): Json {
  const data = record(body);
  if (data === null || data.v !== 2) throw new ApiDecodeError(route);
  return data;
}

function expect<T>(value: T | null, route: string): T {
  if (value === null) throw new ApiDecodeError(route);
  return value;
}

function titleKeyOf(type: unknown, id: unknown, key: unknown): {type: MediaType; id: number; key: TitleKey} | null {
  if (!isMember(MEDIA_TYPES, type) || !isId(id) || typeof key !== 'string') return null;
  const parsed = parseTitleKey(key);
  return parsed !== null && parsed.type === type && parsed.id === id ? parsed : null;
}

function personKeyOf(id: unknown, key: unknown): PersonKey | null {
  return isId(id) && key === `person:${id}` ? `person:${id}` : null;
}

function summaryFields(data: Json): TitleSummary | null {
  const parsed = titleKeyOf(data.type, data.id, data.key);
  const {slug, title, originalTitle, year, releaseDate, overview, posterPath, backdropPath, rating, voteCount, genreIds, originalLanguage} = data;
  if (parsed === null || typeof slug !== 'string' || typeof title !== 'string' || title.length === 0) return null;
  if (typeof originalTitle !== 'string' || !isNullableYear(year) || !isNullableString(releaseDate) || typeof overview !== 'string') return null;
  if (!isNullableString(posterPath) || !isNullableString(backdropPath) || !isNullableRating(rating) || !isCount(voteCount)) return null;
  if (!Array.isArray(genreIds) || typeof originalLanguage !== 'string') return null;
  return {
    key: parsed.key,
    type: parsed.type,
    id: parsed.id,
    slug,
    title,
    originalTitle,
    year,
    releaseDate,
    overview,
    posterPath,
    backdropPath,
    rating,
    voteCount,
    genreIds: genreIds.filter(isId),
    originalLanguage,
  };
}

export function decodeTitleSummary(value: unknown): TitleSummary | null {
  const data = record(value);
  const summary = data === null ? null : summaryFields(data);
  if (summary !== null) rememberSummary(summary);
  return summary;
}

export function decodeVideo(value: unknown): Video | null {
  const data = record(value);
  if (data === null) return null;
  const {key, type, name, official, language, publishedAt} = data;
  if (typeof key !== 'string' || !YOUTUBE_KEY.test(key) || !isMember(VIDEO_TYPES, type) || typeof name !== 'string') return null;
  if (typeof official !== 'boolean' || !isNullableString(language) || !isNullableString(publishedAt)) return null;
  return {key, type, name, official, language, publishedAt};
}

function decodeNullableVideo(value: unknown): Video | null | undefined {
  if (value === null) return null;
  return decodeVideo(value) ?? undefined;
}

export function decodeGenre(value: unknown): Genre | null {
  const data = record(value);
  if (data === null || !isId(data.id) || typeof data.name !== 'string' || !Array.isArray(data.types)) return null;
  return {id: data.id, name: data.name, types: mediaTypes(data.types)};
}

export function decodeRegion(value: unknown): Region | null {
  const data = record(value);
  if (data === null || !isRegionCode(data.code) || typeof data.name !== 'string') return null;
  return {code: data.code, name: data.name};
}

function providerFields(data: Json): Provider | null {
  const {id, name, logoPath, priority} = data;
  if (!isId(id) || typeof name !== 'string' || !isNullableString(logoPath)) return null;
  if (typeof priority !== 'number' || !Number.isFinite(priority)) return null;
  return {id, name, logoPath, priority};
}

export function decodeProvider(value: unknown): Provider | null {
  const data = record(value);
  return data === null ? null : providerFields(data);
}

export function decodeCatalogProvider(value: unknown): CatalogProvider | null {
  const data = record(value);
  if (data === null || !Array.isArray(data.types)) return null;
  const provider = providerFields(data);
  return provider === null ? null : {...provider, types: mediaTypes(data.types)};
}

function decodeOffers(value: unknown): Record<OfferType, Provider[]> | null {
  const offers = record(value);
  if (offers === null || OFFER_TYPES.some((type) => !Array.isArray(offers[type]))) return null;
  const providers = (type: OfferType): Provider[] => {
    const items = offers[type];
    return Array.isArray(items) ? list(items, decodeProvider) : [];
  };
  return {stream: providers('stream'), free: providers('free'), ads: providers('ads'), rent: providers('rent'), buy: providers('buy')};
}

export function decodeRegionAvailability(value: unknown): RegionAvailability | null {
  const data = record(value);
  const offers = decodeOffers(data?.offers);
  if (data === null || offers === null || data.attribution !== 'JustWatch' || !isNullableString(data.link)) return null;
  if (typeof data.region !== 'string' || (data.region !== '' && !isRegionCode(data.region))) return null;
  return {region: data.region, offers, link: data.link, attribution: 'JustWatch'};
}

function decodeCast(value: unknown): CastCredit | null {
  const data = record(value);
  if (data === null) return null;
  const personKey = personKeyOf(data.personId, data.personKey);
  const {personId, slug, name, character, profilePath, episodeCount} = data;
  if (personKey === null || !isId(personId) || typeof slug !== 'string' || typeof name !== 'string' || name.length === 0) return null;
  if (typeof character !== 'string' || !isNullableString(profilePath) || !isNullableCount(episodeCount)) return null;
  return {personKey, personId, slug, name, character, profilePath, episodeCount};
}

function decodeCrew(value: unknown): CrewCredit | null {
  const data = record(value);
  if (data === null) return null;
  const personKey = personKeyOf(data.personId, data.personKey);
  const {personId, slug, name, job, department, profilePath} = data;
  if (personKey === null || !isId(personId) || typeof slug !== 'string' || typeof name !== 'string' || name.length === 0) return null;
  if (typeof job !== 'string' || typeof department !== 'string' || !isNullableString(profilePath)) return null;
  return {personKey, personId, slug, name, job, department, profilePath};
}

function decodeEpisodeSummary(value: unknown): EpisodeSummary | null | undefined {
  if (value === null) return null;
  const data = record(value);
  if (data === null) return undefined;
  const {seasonNumber, episodeNumber, name, airDate} = data;
  if (!isCount(seasonNumber) || !isCount(episodeNumber) || typeof name !== 'string' || !isNullableString(airDate)) return undefined;
  return {seasonNumber, episodeNumber, name, airDate};
}

function decodeSeasonSummary(value: unknown): SeasonSummary | null {
  const data = record(value);
  if (data === null) return null;
  const {seasonNumber, name, episodeCount, airDate, posterPath} = data;
  if (!isCount(seasonNumber) || typeof name !== 'string' || !isCount(episodeCount)) return null;
  if (!isNullableString(airDate) || !isNullableString(posterPath)) return null;
  return {seasonNumber, name, episodeCount, airDate, posterPath};
}

function decodeCollection(value: unknown): MovieDetails['collection'] | undefined {
  if (value === null) return null;
  const data = record(value);
  if (data === null || !isId(data.id) || typeof data.name !== 'string') return undefined;
  return {id: data.id, name: data.name};
}

function decodeNetwork(value: unknown): TvDetails['networks'][number] | null {
  const data = record(value);
  if (data === null || !isId(data.id) || typeof data.name !== 'string' || !isNullableString(data.logoPath)) return null;
  return {id: data.id, name: data.name, logoPath: data.logoPath};
}

function decodeCreator(value: unknown): TvDetails['createdBy'][number] | null {
  const data = record(value);
  if (data === null || typeof data.personKey !== 'string' || typeof data.name !== 'string') return null;
  const match = /^person:([1-9]\d{0,9})$/.exec(data.personKey);
  if (match === null || Number(match[1]) > MAX_TMDB_ID) return null;
  return {personKey: `person:${Number(match[1])}`, name: data.name};
}

export function decodeTitleDetails(value: unknown): TitleDetails | null {
  const data = record(value);
  const summary = data === null ? null : summaryFields(data);
  if (data === null || summary === null) return null;
  const {tagline, genres, runtimeMinutes, certification, imdbId, status, homepage, cast, crew, videos, recommendations} = data;
  if (typeof tagline !== 'string' || !Array.isArray(genres) || !isNullableCount(runtimeMinutes) || !isNullableString(certification)) return null;
  if (!isNullableString(imdbId) || typeof status !== 'string' || !isNullableString(homepage)) return null;
  if (!Array.isArray(cast) || !Array.isArray(crew) || !Array.isArray(videos) || !Array.isArray(recommendations)) return null;
  const trailer = decodeNullableVideo(data.trailer);
  const availability = decodeRegionAvailability(data.availability);
  if (trailer === undefined || availability === null) return null;
  rememberSummary(summary);
  const base = {
    ...summary,
    tagline,
    genres: list(genres, decodeGenre),
    runtimeMinutes,
    certification,
    imdbId,
    status,
    homepage,
    cast: list(cast, decodeCast),
    crew: list(crew, decodeCrew),
    videos: list(videos, decodeVideo),
    trailer,
    recommendations: list(recommendations, decodeTitleSummary),
    availability,
  };
  if (summary.type === 'movie') {
    const collection = decodeCollection(data.collection);
    if (collection === undefined) return null;
    const movie: MovieDetails = {...base, type: 'movie', collection};
    return movie;
  }
  const {seasons, numberOfSeasons, numberOfEpisodes, inProduction, lastAirDate, networks, createdBy} = data;
  if (!Array.isArray(seasons) || !isCount(numberOfSeasons) || !isCount(numberOfEpisodes) || typeof inProduction !== 'boolean') return null;
  if (!isNullableString(lastAirDate) || !Array.isArray(networks) || !Array.isArray(createdBy)) return null;
  const nextEpisode = decodeEpisodeSummary(data.nextEpisode);
  const lastEpisode = decodeEpisodeSummary(data.lastEpisode);
  if (nextEpisode === undefined || lastEpisode === undefined) return null;
  const tv: TvDetails = {
    ...base,
    type: 'tv',
    seasons: list(seasons, decodeSeasonSummary),
    numberOfSeasons,
    numberOfEpisodes,
    inProduction,
    lastAirDate,
    nextEpisode,
    lastEpisode,
    networks: list(networks, decodeNetwork),
    createdBy: list(createdBy, decodeCreator),
  };
  return tv;
}

function decodeEpisode(value: unknown): Episode | null {
  const data = record(value);
  if (data === null) return null;
  const {id, seasonNumber, episodeNumber, name, overview, airDate, runtimeMinutes, stillPath, rating} = data;
  if (!isId(id) || !isCount(seasonNumber) || !isCount(episodeNumber) || typeof name !== 'string' || typeof overview !== 'string') return null;
  if (!isNullableString(airDate) || !isNullableCount(runtimeMinutes) || !isNullableString(stillPath) || !isNullableRating(rating)) return null;
  return {id, seasonNumber, episodeNumber, name, overview, airDate, runtimeMinutes, stillPath, rating};
}

export function decodeSeasonDetails(value: unknown): SeasonDetails | null {
  const data = record(value);
  if (data === null || typeof data.key !== 'string') return null;
  const parsed = parseTitleKey(data.key);
  const {seasonNumber, name, overview, airDate, posterPath, episodes} = data;
  if (parsed === null || parsed.type !== 'tv' || !isCount(seasonNumber) || typeof name !== 'string' || typeof overview !== 'string') return null;
  if (!isNullableString(airDate) || !isNullableString(posterPath) || !Array.isArray(episodes)) return null;
  return {key: parsed.key, seasonNumber, name, overview, airDate, posterPath, episodes: list(episodes, decodeEpisode)};
}

export function decodePersonSummary(value: unknown): PersonSummary | null {
  const data = record(value);
  if (data === null) return null;
  const key = personKeyOf(data.id, data.key);
  const {id, slug, name, profilePath, knownForDepartment, knownFor} = data;
  if (key === null || !isId(id) || typeof slug !== 'string' || typeof name !== 'string' || name.length === 0) return null;
  if (!isNullableString(profilePath) || !isNullableString(knownForDepartment) || !Array.isArray(knownFor)) return null;
  return {key, id, slug, name, profilePath, knownForDepartment, knownFor: list(knownFor, decodeTitleSummary)};
}

function decodePersonCredit(value: unknown): PersonCredit | null {
  const data = record(value);
  if (data === null || !isNullableString(data.character) || !Array.isArray(data.jobs) || !isNullableCount(data.episodeCount)) return null;
  const title = decodeTitleSummary(data.title);
  return title === null ? null : {title, character: data.character, jobs: strings(data.jobs), episodeCount: data.episodeCount};
}

export function decodePersonDetails(value: unknown): PersonDetails | null {
  const data = record(value);
  if (data === null) return null;
  const key = personKeyOf(data.id, data.key);
  const {id, slug, name, biography, birthday, deathday, placeOfBirth, profilePath, knownForDepartment, imdbId, alsoKnownAs, knownFor, credits} = data;
  if (key === null || !isId(id) || typeof slug !== 'string' || typeof name !== 'string' || name.length === 0) return null;
  if (typeof biography !== 'string' || !isNullableString(birthday) || !isNullableString(deathday) || !isNullableString(placeOfBirth)) return null;
  if (!isNullableString(profilePath) || !isNullableString(knownForDepartment) || !isNullableString(imdbId)) return null;
  if (!Array.isArray(alsoKnownAs) || !Array.isArray(knownFor) || !Array.isArray(credits)) return null;
  return {
    key,
    id,
    slug,
    name,
    biography,
    birthday,
    deathday,
    placeOfBirth,
    profilePath,
    knownForDepartment,
    imdbId,
    alsoKnownAs: strings(alsoKnownAs),
    knownFor: list(knownFor, decodeTitleSummary),
    credits: list(credits, decodePersonCredit),
  };
}

export function decodeSearchResult(value: unknown): SearchResult | null {
  const data = record(value);
  if (data?.kind === 'title') {
    const title = decodeTitleSummary(data.title);
    return title === null ? null : {kind: 'title', title};
  }
  if (data?.kind === 'person') {
    const person = decodePersonSummary(data.person);
    return person === null ? null : {kind: 'person', person};
  }
  return null;
}

function decodeHeroItem(value: unknown): HeroItem | null {
  const data = record(value);
  const summary = decodeTitleSummary(value);
  const trailer = decodeNullableVideo(data?.trailer);
  return summary === null || trailer === undefined ? null : {...summary, trailer};
}

function decodeRail(value: unknown): Rail | null {
  const data = record(value);
  if (data === null || !isMember(RAIL_IDS, data.id) || !isMember(RAIL_KINDS, data.kind) || !Array.isArray(data.items)) return null;
  return {id: data.id, kind: data.kind, items: list(data.items, decodeTitleSummary)};
}

export function decodeResolvedTitle(value: unknown): ResolvedTitle | null {
  const data = record(value);
  if (data === null || typeof data.key !== 'string') return null;
  const parsed = parseTitleKey(data.key);
  const {slug, title, year, posterPath, imdbId} = data;
  if (parsed === null || typeof slug !== 'string' || typeof title !== 'string' || title.length === 0) return null;
  if (!isNullableYear(year) || !isNullableString(posterPath) || !isNullableString(imdbId)) return null;
  return {key: parsed.key, slug, title, year, posterPath, imdbId};
}

function decodeResolutions(value: unknown, isKey: (key: string) => boolean): Record<string, ResolvedTitle | null> | null {
  const data = record(value);
  if (data === null) return null;
  const result: Record<string, ResolvedTitle | null> = {};
  for (const [key, item] of Object.entries(data)) {
    if (!isKey(key)) continue;
    if (item === null) {
      result[key] = null;
      continue;
    }
    const resolved = decodeResolvedTitle(item);
    if (resolved !== null) result[key] = resolved;
  }
  return result;
}

export function decodePaged<T>(body: unknown, route: string, decodeItem: (item: unknown) => T | null): Paged<T> {
  const data = record(body);
  if (data === null || !isCount(data.page) || data.page < 1 || !isCount(data.totalPages) || !isCount(data.totalResults)) {
    throw new ApiDecodeError(route);
  }
  if (!Array.isArray(data.results)) throw new ApiDecodeError(route);
  return {page: data.page, totalPages: data.totalPages, totalResults: data.totalResults, results: list(data.results, decodeItem)};
}

export function decodeHomeResponse(body: unknown): HomeResponse {
  const data = expectObject(body, 'home');
  if (!isRegionCode(data.region) || typeof data.generatedAt !== 'string' || !Array.isArray(data.hero) || !Array.isArray(data.rails)) {
    throw new ApiDecodeError('home');
  }
  return {v: 2, region: data.region, generatedAt: data.generatedAt, hero: list(data.hero, decodeHeroItem), rails: list(data.rails, decodeRail)};
}

export function decodeDiscoverResponse(body: unknown): DiscoverResponse {
  expectObject(body, 'discover');
  return {v: 2, ...decodePaged(body, 'discover', decodeTitleSummary)};
}

export function decodeSearchResponse(body: unknown): SearchResponse {
  const data = expectObject(body, 'search');
  if (typeof data.q !== 'string' || !isMember(SEARCH_TYPES, data.type)) throw new ApiDecodeError('search');
  return {v: 2, q: data.q, type: data.type, ...decodePaged(body, 'search', decodeSearchResult)};
}

export function decodeTitleResponse(body: unknown): TitleResponse {
  const data = expectObject(body, 'title');
  return {v: 2, title: expect(decodeTitleDetails(data.title), 'title')};
}

export function decodeSeasonResponse(body: unknown): SeasonResponse {
  const data = expectObject(body, 'season');
  return {v: 2, season: expect(decodeSeasonDetails(data.season), 'season')};
}

export function decodePersonResponse(body: unknown): PersonResponse {
  const data = expectObject(body, 'person');
  return {v: 2, person: expect(decodePersonDetails(data.person), 'person')};
}

export function decodeGenresResponse(body: unknown): GenresResponse {
  const data = expectObject(body, 'genres');
  if (!Array.isArray(data.genres)) throw new ApiDecodeError('genres');
  return {v: 2, genres: list(data.genres, decodeGenre)};
}

export function decodeRegionsResponse(body: unknown): RegionsResponse {
  const data = expectObject(body, 'regions');
  if (!Array.isArray(data.regions)) throw new ApiDecodeError('regions');
  return {v: 2, regions: list(data.regions, decodeRegion)};
}

export function decodeProvidersResponse(body: unknown): ProvidersResponse {
  const data = expectObject(body, 'providers');
  if (!isRegionCode(data.region) || !Array.isArray(data.providers)) throw new ApiDecodeError('providers');
  return {v: 2, region: data.region, providers: list(data.providers, decodeCatalogProvider)};
}

export function decodeAvailabilityResponse(body: unknown): AvailabilityResponse {
  const data = expectObject(body, 'availability');
  const items = record(data.items);
  if (!isRegionCode(data.region) || items === null || !Array.isArray(data.failed)) throw new ApiDecodeError('availability');
  const decoded: Partial<Record<TitleKey, RegionAvailability | null>> = {};
  for (const [key, value] of Object.entries(items)) {
    const parsed = parseTitleKey(key);
    if (parsed === null) continue;
    if (value === null) {
      decoded[parsed.key] = null;
      continue;
    }
    const availability = decodeRegionAvailability(value);
    if (availability !== null) decoded[parsed.key] = availability;
  }
  const failed: TitleKey[] = [];
  for (const key of data.failed) {
    const parsed = typeof key === 'string' ? parseTitleKey(key) : null;
    if (parsed !== null) failed.push(parsed.key);
  }
  return {v: 2, region: data.region, items: decoded, failed};
}

export function decodeFindResponse(body: unknown): FindResponse {
  const data = expectObject(body, 'find');
  if (typeof data.imdbId !== 'string' || !IMDB_ID.test(data.imdbId)) throw new ApiDecodeError('find');
  return {v: 2, imdbId: data.imdbId, match: expect(decodeResolvedTitle(data.match), 'find')};
}

export function decodeLegacyMovieResponse(body: unknown): LegacyMovieResponse {
  const data = expectObject(body, 'legacy-movie');
  const {v1Id, imdbId, path} = data;
  if (!isId(v1Id) || typeof imdbId !== 'string' || !IMDB_ID.test(imdbId) || typeof path !== 'string' || !path.startsWith('/title/')) {
    throw new ApiDecodeError('legacy-movie');
  }
  return {v: 2, v1Id, imdbId, match: expect(decodeResolvedTitle(data.match), 'legacy-movie'), path};
}

export function decodeResolveResponse(body: unknown): ResolveResponse {
  const data = expectObject(body, 'resolve');
  const imdb = decodeResolutions(data.imdb, (key) => IMDB_ID.test(key));
  const v1 = decodeResolutions(data.v1, (key) => /^[1-9]\d{0,9}$/.test(key) && Number(key) <= MAX_TMDB_ID);
  const failed = record(data.failed);
  if (imdb === null || v1 === null || failed === null || !Array.isArray(failed.imdb) || !Array.isArray(failed.v1)) {
    throw new ApiDecodeError('resolve');
  }
  return {
    v: 2,
    imdb,
    v1,
    failed: {imdb: strings(failed.imdb).filter((id) => IMDB_ID.test(id)), v1: failed.v1.filter(isId)},
  };
}

export function decodeGeoResponse(body: unknown): GeoResponse {
  const data = expectObject(body, 'geo');
  if (data.country !== null && !isRegionCode(data.country)) throw new ApiDecodeError('geo');
  return {v: 2, country: data.country};
}

export function decodeHealthResponse(body: unknown): HealthResponse {
  const data = expectObject(body, 'health');
  if (data.ok !== true || data.upstream !== 'ok' || !isMember(LEGACY_STATES, data.legacy) || !isMember(KEY_SOURCES, data.tmdbKey)) {
    throw new ApiDecodeError('health');
  }
  return {v: 2, ok: true, upstream: 'ok', legacy: data.legacy, tmdbKey: data.tmdbKey};
}
