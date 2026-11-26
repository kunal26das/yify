import type {HomeResponse, ResolvedTitle} from '@/core/domain/api';
import {isLocalDate} from '@/core/domain/dates';
import type {EntryKey, LegacyKey, MediaType} from '@/core/domain/keys';
import {isEntryKey, isLegacyKey, parseTitleKey} from '@/core/domain/keys';
import type {
  DiaryEntry,
  DiaryState,
  HalfStars,
  ListItem,
  ListsState,
  RecentEntry,
  RecentState,
  TitleSnapshot,
  UserList,
  WatchlistEntry,
  WatchlistState,
} from '@/core/domain/library';
import {LIMITS} from '@/core/domain/library';
import type {Accent, Consent, Preferences, PreferencesSectionState, ThemePreference} from '@/core/domain/preferences';
import {DEFAULT_PREFERENCES} from '@/core/domain/preferences';
import type {MyServices, Region, RegionCode} from '@/core/domain/providers';
import type {SectionName} from '@/core/domain/sync/types';
import type {Genre} from '@/core/domain/title';
import type {Codec} from './json';

export interface Revisioned<S> {
  rev: number;
  state: S;
}

export interface DetectedRegion {
  code: RegionCode;
  source: 'locale' | 'geo';
  at: number;
}

export interface RecentSearches {
  terms: string[];
}

export interface LibraryOwner {
  uid: string | null;
  settled: boolean;
}

export interface SectionSyncRecord {
  remoteUpdateTime: string | null;
  syncedRev: number;
}

export interface ImportBackoff {
  attempts: number;
  nextAttemptAt: number;
}

export interface SyncRecord {
  sections: Record<SectionName, SectionSyncRecord>;
  lastSyncedAt: number | null;
  deleted: boolean;
  importPending: ImportBackoff | null;
  v1CheckedAt: number | null;
}

export interface AccountStash {
  savedAt: number;
  prefs?: PreferencesSectionState;
  watchlist?: WatchlistState;
  diary?: DiaryState;
  lists?: ListsState;
  recent?: RecentState;
}

export interface UnresolvedLegacy {
  unresolved: true;
  attempts: number;
  nextAttemptAt: number;
  final: boolean;
}

export type LegacyResolution = ResolvedTitle | UnresolvedLegacy;

export type LocalMigrationStatus = 'pending' | 'done' | 'none';

export interface MigrationState {
  localV1: LocalMigrationStatus;
  completedAt: number | null;
  resolutions: Partial<Record<LegacyKey, LegacyResolution>>;
  v1CleanupAt: number | null;
  noticeShown: boolean;
}

export interface HomeCache {
  savedAt: number;
  data: HomeResponse;
}

export interface ReferenceCache {
  savedAt: number;
  genres: Genre[];
  regions: Region[];
}

export type ImageHostMode = 'direct' | 'proxy';

export interface ImageHostState {
  mode: ImageHostMode;
  until: number;
}

export interface HomeUiState {
  popular: MediaType;
}

export interface TitleUiState {
  signInHintShown: boolean;
}

export interface LibraryUiState {
  signInRowHidden: boolean;
}

type JsonRecord = Record<string, unknown>;
type Members<T extends string> = Readonly<Record<T, true>>;

const REGION_CODE = /^[A-Z]{2}$/;
const RECORD_ID = /^[A-Za-z0-9_-]{1,100}$/;
const MAX_SERVICE_REGIONS = 250;
const MAX_SERVICES_PER_REGION = 64;
const MAX_SERVICES_JSON_LENGTH = 2800;
const MAX_PROVIDER_ID = 999999;

const THEMES: Members<ThemePreference> = {system: true, light: true, dark: true};
const ACCENTS: Members<Accent> = {default: true, accent1: true, accent2: true, accent3: true, accent4: true};
const MEDIA_TYPES: Members<MediaType> = {movie: true, tv: true};
const REGION_SOURCES: Members<DetectedRegion['source']> = {locale: true, geo: true};
const LOCAL_MIGRATION: Members<LocalMigrationStatus> = {pending: true, done: true, none: true};
const IMAGE_HOST_MODES: Members<ImageHostMode> = {direct: true, proxy: true};

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function isMember<T extends string>(members: Members<T>, value: unknown): value is T {
  return typeof value === 'string' && Object.hasOwn(members, value);
}

function isStamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function stampOr(value: unknown, fallback: number): number {
  return isStamp(value) ? value : fallback;
}

function nullableStamp(value: unknown): number | null {
  return isStamp(value) ? value : null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isYear(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1000 && value <= 9999;
}

function isRegionCode(value: unknown): value is RegionCode {
  return typeof value === 'string' && REGION_CODE.test(value);
}

function isRecordId(value: string): boolean {
  return RECORD_ID.test(value) && value !== '__proto__';
}

function isIsoTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function isHalfStars(value: unknown): value is HalfStars {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;
}

function isPositiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isProviderId(value: unknown): value is number {
  return isPositiveId(value) && value <= MAX_PROVIDER_ID;
}

function decodeList<T>(value: unknown, decodeItem: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  const items: T[] = [];
  for (const item of value) {
    const decoded = decodeItem(item);
    if (decoded !== null) items.push(decoded);
  }
  return items;
}

function decodeEntryMap<T>(value: unknown, decodeItem: (item: unknown) => T | null): Partial<Record<EntryKey, T>> {
  const result: Partial<Record<EntryKey, T>> = {};
  const data = asRecord(value);
  if (data === null) return result;
  for (const [key, item] of Object.entries(data)) {
    if (!isEntryKey(key)) continue;
    const decoded = decodeItem(item);
    if (decoded !== null) result[key] = decoded;
  }
  return result;
}

function decodeIdMap<T>(value: unknown, decodeItem: (id: string, item: unknown) => T | null): Record<string, T> {
  const result: Record<string, T> = {};
  const data = asRecord(value);
  if (data === null) return result;
  for (const [id, item] of Object.entries(data)) {
    if (!isRecordId(id)) continue;
    const decoded = decodeItem(id, item);
    if (decoded !== null) result[id] = decoded;
  }
  return result;
}

function decodeTombstone(value: unknown): number | null {
  return isStamp(value) ? value : null;
}

function decodeSnapshot(value: unknown): TitleSnapshot | null {
  const data = asRecord(value);
  if (data === null || typeof data.title !== 'string') return null;
  return {
    title: data.title,
    year: isYear(data.year) ? data.year : null,
    posterPath: typeof data.posterPath === 'string' ? data.posterPath : null,
    slug: typeof data.slug === 'string' ? data.slug : '',
  };
}

function decodeWatchlistEntry(value: unknown): WatchlistEntry | null {
  const data = asRecord(value);
  if (data === null || !isStamp(data.addedAt)) return null;
  const snapshot = decodeSnapshot(data.snapshot);
  return snapshot === null ? null : {addedAt: data.addedAt, snapshot};
}

function decodeWatchlistState(value: unknown): WatchlistState | null {
  const data = asRecord(value);
  if (data === null) return null;
  return {
    entries: decodeEntryMap(data.entries, decodeWatchlistEntry),
    removed: decodeEntryMap(data.removed, decodeTombstone),
  };
}

function decodeDiaryEntry(id: string, value: unknown): DiaryEntry | null {
  const data = asRecord(value);
  if (data === null || data.id !== id) return null;
  const {key, watchedOn, rating, note, rewatch, createdAt, updatedAt, deletedAt} = data;
  if (typeof key !== 'string' || !isEntryKey(key)) return null;
  if (!(watchedOn === null || isLocalDate(watchedOn)) || !(rating === null || isHalfStars(rating))) return null;
  if (typeof note !== 'string' || typeof rewatch !== 'boolean') return null;
  if (!isStamp(createdAt) || !isStamp(updatedAt) || !isStamp(deletedAt)) return null;
  const snapshot = decodeSnapshot(data.snapshot);
  if (snapshot === null) return null;
  return {id, key, snapshot, watchedOn, rating, note, rewatch, createdAt, updatedAt, deletedAt};
}

function decodeDiaryState(value: unknown): DiaryState | null {
  const data = asRecord(value);
  if (data === null) return null;
  return {entries: decodeIdMap(data.entries, decodeDiaryEntry), clearedAt: stampOr(data.clearedAt, 0)};
}

function decodeListItem(value: unknown): ListItem | null {
  const data = asRecord(value);
  if (data === null || !isStamp(data.at) || typeof data.value !== 'boolean') return null;
  const snapshot = decodeSnapshot(data.snapshot);
  return snapshot === null ? null : {at: data.at, value: data.value, snapshot};
}

function decodeUserList(id: string, value: unknown): UserList | null {
  const data = asRecord(value);
  if (data === null || data.id !== id) return null;
  const {name, createdAt, updatedAt, removedAt} = data;
  if (typeof name !== 'string' || !isStamp(createdAt) || !isStamp(updatedAt) || !isStamp(removedAt)) return null;
  return {id, name, createdAt, updatedAt, removedAt, items: decodeEntryMap(data.items, decodeListItem)};
}

function decodeListsState(value: unknown): ListsState | null {
  const data = asRecord(value);
  if (data === null) return null;
  return {lists: decodeIdMap(data.lists, decodeUserList), clearedAt: stampOr(data.clearedAt, 0)};
}

function decodeRecentEntry(value: unknown): RecentEntry | null {
  const data = asRecord(value);
  if (data === null || !isStamp(data.viewedAt)) return null;
  const snapshot = decodeSnapshot(data.snapshot);
  return snapshot === null ? null : {viewedAt: data.viewedAt, snapshot};
}

function decodeRecentState(value: unknown): RecentState | null {
  const data = asRecord(value);
  if (data === null) return null;
  return {
    entries: decodeEntryMap(data.entries, decodeRecentEntry),
    removed: decodeEntryMap(data.removed, decodeTombstone),
    clearedAt: stampOr(data.clearedAt, 0),
  };
}

function decodeServices(value: unknown): MyServices | undefined {
  const data = asRecord(value);
  if (data === null) return undefined;
  const services: MyServices = {};
  for (const [region, ids] of Object.entries(data)) {
    if (!REGION_CODE.test(region) || !Array.isArray(ids)) continue;
    const unique = [...new Set(ids.filter(isProviderId))].slice(0, MAX_SERVICES_PER_REGION);
    if (unique.length > 0) services[region] = unique;
  }
  if (Object.keys(services).length > MAX_SERVICE_REGIONS) return undefined;
  return JSON.stringify(services).length > MAX_SERVICES_JSON_LENGTH ? undefined : services;
}

type PreferenceDecoders = {readonly [K in keyof Preferences]: (value: unknown) => Preferences[K] | undefined};

const PREFERENCE_DECODERS: PreferenceDecoders = {
  theme: (value) => (isMember(THEMES, value) ? value : undefined),
  accent: (value) => (isMember(ACCENTS, value) ? value : undefined),
  region: (value) => (value === null || isRegionCode(value) ? value : undefined),
  services: decodeServices,
  recentPaused: (value) => (typeof value === 'boolean' ? value : undefined),
  trailerCaptions: (value) => (typeof value === 'boolean' ? value : undefined),
};

const PREFERENCE_FIELDS = Object.keys(PREFERENCE_DECODERS) as (keyof Preferences)[];

function emptyPreferences(): PreferencesSectionState {
  return {
    values: {...DEFAULT_PREFERENCES, services: {}},
    stamps: {theme: 0, accent: 0, region: 0, services: 0, recentPaused: 0, trailerCaptions: 0},
  };
}

function decodePreferenceField<K extends keyof Preferences>(
  field: K,
  values: JsonRecord,
  stamps: JsonRecord,
  target: PreferencesSectionState,
): void {
  const value = PREFERENCE_DECODERS[field](values[field]);
  if (value === undefined) return;
  target.values[field] = value;
  target.stamps[field] = stampOr(stamps[field], 0);
}

function decodePreferencesState(value: unknown): PreferencesSectionState | null {
  const data = asRecord(value);
  if (data === null) return null;
  const state = emptyPreferences();
  const values = asRecord(data.values) ?? {};
  const stamps = asRecord(data.stamps) ?? {};
  for (const field of PREFERENCE_FIELDS) decodePreferenceField(field, values, stamps, state);
  return state;
}

function decodeConsent(value: unknown): Consent | null {
  const data = asRecord(value);
  if (data === null) return null;
  const {analytics, youtube, noticeVersion, decidedAt} = data;
  if (typeof analytics !== 'boolean' || typeof youtube !== 'boolean' || typeof noticeVersion !== 'string') return null;
  return decidedAt === null || isIsoTime(decidedAt) ? {analytics, youtube, noticeVersion, decidedAt} : null;
}

function decodeDetectedRegion(value: unknown): DetectedRegion | null {
  const data = asRecord(value);
  if (data === null) return null;
  const {code, source, at} = data;
  return isRegionCode(code) && isMember(REGION_SOURCES, source) && isStamp(at) ? {code, source, at} : null;
}

function decodeRecentSearches(value: unknown): RecentSearches | null {
  const data = asRecord(value);
  if (data === null || !Array.isArray(data.terms)) return null;
  const terms: string[] = [];
  const seen = new Set<string>();
  for (const term of data.terms) {
    if (terms.length === LIMITS.recentSearches) break;
    if (typeof term !== 'string' || term.trim().length === 0) continue;
    const folded = term.toLowerCase();
    if (seen.has(folded)) continue;
    seen.add(folded);
    terms.push(term);
  }
  return {terms};
}

function decodeLibraryOwner(value: unknown): LibraryOwner | null {
  const data = asRecord(value);
  if (data === null || typeof data.settled !== 'boolean') return null;
  const {uid} = data;
  return uid === null || (typeof uid === 'string' && uid.length > 0) ? {uid, settled: data.settled} : null;
}

function decodeSectionSync(value: unknown): SectionSyncRecord {
  const data = asRecord(value) ?? {};
  return {
    remoteUpdateTime: typeof data.remoteUpdateTime === 'string' ? data.remoteUpdateTime : null,
    syncedRev: stampOr(data.syncedRev, 0),
  };
}

function decodeImportBackoff(value: unknown): ImportBackoff | null {
  const data = asRecord(value);
  if (data === null) return null;
  const {attempts, nextAttemptAt} = data;
  return isStamp(attempts) && isStamp(nextAttemptAt) ? {attempts, nextAttemptAt} : null;
}

function decodeSyncRecord(value: unknown): SyncRecord | null {
  const data = asRecord(value);
  if (data === null) return null;
  const sections = asRecord(data.sections) ?? {};
  return {
    sections: {
      watchlist: decodeSectionSync(sections.watchlist),
      diary: decodeSectionSync(sections.diary),
      lists: decodeSectionSync(sections.lists),
      recent: decodeSectionSync(sections.recent),
      preferences: decodeSectionSync(sections.preferences),
    },
    lastSyncedAt: nullableStamp(data.lastSyncedAt),
    deleted: data.deleted === true,
    importPending: decodeImportBackoff(data.importPending),
    v1CheckedAt: nullableStamp(data.v1CheckedAt),
  };
}

function decodeAccountStash(value: unknown): AccountStash | null {
  const data = asRecord(value);
  if (data === null || !isStamp(data.savedAt)) return null;
  const stash: AccountStash = {savedAt: data.savedAt};
  const prefs = decodePreferencesState(data.prefs);
  const watchlist = decodeWatchlistState(data.watchlist);
  const diary = decodeDiaryState(data.diary);
  const lists = decodeListsState(data.lists);
  const recent = decodeRecentState(data.recent);
  if (prefs !== null) stash.prefs = prefs;
  if (watchlist !== null) stash.watchlist = watchlist;
  if (diary !== null) stash.diary = diary;
  if (lists !== null) stash.lists = lists;
  if (recent !== null) stash.recent = recent;
  return stash;
}

function decodeResolvedTitle(data: JsonRecord): ResolvedTitle | null {
  const parsed = typeof data.key === 'string' ? parseTitleKey(data.key) : null;
  const {slug, title, year, posterPath, imdbId} = data;
  if (parsed === null || typeof slug !== 'string' || typeof title !== 'string') return null;
  if (!(year === null || isYear(year)) || !isNullableString(posterPath) || !isNullableString(imdbId)) return null;
  return {key: parsed.key, slug, title, year, posterPath, imdbId};
}

function decodeResolution(value: unknown): LegacyResolution | null {
  const data = asRecord(value);
  if (data === null) return null;
  if (data.unresolved !== true) return decodeResolvedTitle(data);
  const {attempts, nextAttemptAt, final} = data;
  if (!isStamp(attempts) || !isStamp(nextAttemptAt) || typeof final !== 'boolean') return null;
  return {unresolved: true, attempts, nextAttemptAt, final};
}

function decodeResolutions(value: unknown): Partial<Record<LegacyKey, LegacyResolution>> {
  const result: Partial<Record<LegacyKey, LegacyResolution>> = {};
  const data = asRecord(value);
  if (data === null) return result;
  for (const [key, item] of Object.entries(data)) {
    if (!isLegacyKey(key)) continue;
    const resolution = decodeResolution(item);
    if (resolution !== null) result[key] = resolution;
  }
  return result;
}

function decodeMigrationState(value: unknown): MigrationState | null {
  const data = asRecord(value);
  if (data === null || !isMember(LOCAL_MIGRATION, data.localV1)) return null;
  return {
    localV1: data.localV1,
    completedAt: nullableStamp(data.completedAt),
    resolutions: decodeResolutions(data.resolutions),
    v1CleanupAt: nullableStamp(data.v1CleanupAt),
    noticeShown: data.noticeShown === true,
  };
}

function decodeGenre(value: unknown): Genre | null {
  const data = asRecord(value);
  if (data === null || !isPositiveId(data.id) || typeof data.name !== 'string' || !Array.isArray(data.types)) return null;
  const types = [...new Set(data.types.filter((type): type is MediaType => isMember(MEDIA_TYPES, type)))];
  return {id: data.id, name: data.name, types};
}

function decodeRegion(value: unknown): Region | null {
  const data = asRecord(value);
  if (data === null || !isRegionCode(data.code) || typeof data.name !== 'string') return null;
  return {code: data.code, name: data.name};
}

function decodeReferenceCache(value: unknown): ReferenceCache | null {
  const data = asRecord(value);
  if (data === null || !isStamp(data.savedAt) || !Array.isArray(data.genres) || !Array.isArray(data.regions)) return null;
  return {savedAt: data.savedAt, genres: decodeList(data.genres, decodeGenre), regions: decodeList(data.regions, decodeRegion)};
}

function decodeImageHost(value: unknown): ImageHostState | null {
  const data = asRecord(value);
  if (data === null) return null;
  const {mode, until} = data;
  return isMember(IMAGE_HOST_MODES, mode) && isStamp(until) ? {mode, until} : null;
}

function decodeHomeUi(value: unknown): HomeUiState | null {
  const popular = asRecord(value)?.popular;
  return isMember(MEDIA_TYPES, popular) ? {popular} : null;
}

function decodeTitleUi(value: unknown): TitleUiState | null {
  const signInHintShown = asRecord(value)?.signInHintShown;
  return typeof signInHintShown === 'boolean' ? {signInHintShown} : null;
}

function decodeLibraryUi(value: unknown): LibraryUiState | null {
  const signInRowHidden = asRecord(value)?.signInRowHidden;
  return typeof signInRowHidden === 'boolean' ? {signInRowHidden} : null;
}

function codec<T>(decode: (data: unknown) => T | null): Codec<T> {
  return {version: 1, decode, encode: (value: T) => value};
}

function revisioned<S>(decodeState: (data: unknown) => S | null): Codec<Revisioned<S>> {
  return codec((data) => {
    const record = asRecord(data);
    if (record === null || !isStamp(record.rev)) return null;
    const state = decodeState(record.state);
    return state === null ? null : {rev: record.rev, state};
  });
}

function scopedKey(prefix: string, scope: string, what: string): string {
  if (scope.length === 0) throw new RangeError(`A ${what} storage key needs a non-empty value.`);
  return prefix + scope;
}

export const KEY_PREFIXES = {
  cache: 'v2.cache.',
  homeCache: 'v2.cache.home.',
  syncState: 'v2.sync.',
  stash: 'v2.stash.',
  updatesPrompted: 'updates.prompted.',
  updatesDownloaded: 'updates.downloaded.',
} as const;

export const KEYS = {
  prefs: 'v2.prefs',
  consent: 'v2.consent',
  detectedRegion: 'v2.region.detected',
  recentSearches: 'v2.search.recent',
  watchlist: 'v2.library.watchlist',
  diary: 'v2.library.diary',
  lists: 'v2.library.lists',
  recent: 'v2.library.recent',
  libraryOwner: 'v2.library.owner',
  syncState: (uid: string): string => scopedKey(KEY_PREFIXES.syncState, uid, 'uid'),
  stash: (uid: string): string => scopedKey(KEY_PREFIXES.stash, uid, 'uid'),
  migration: 'v2.migration',
  homeCache: (region: RegionCode): string => {
    if (!isRegionCode(region)) throw new RangeError(`Invalid home cache region: ${region}`);
    return KEY_PREFIXES.homeCache + region;
  },
  referenceCache: 'v2.cache.reference',
  imageHost: 'v2.image.host',
  homeUi: 'v2.ui.home',
  titleUi: 'v2.ui.title',
  libraryUi: 'v2.ui.library',
  plusEntitlement: 'plus.entitlement.v1',
  adsLastShownAt: 'ads.lastShownAt',
  updatesPrompted: (storeVersion: string): string => scopedKey(KEY_PREFIXES.updatesPrompted, storeVersion, 'store version'),
  updatesDownloaded: (storeVersion: string): string => scopedKey(KEY_PREFIXES.updatesDownloaded, storeVersion, 'store version'),
} as const;

export const CODECS = {
  prefs: codec(decodePreferencesState),
  consent: codec(decodeConsent),
  detectedRegion: codec(decodeDetectedRegion),
  recentSearches: codec(decodeRecentSearches),
  watchlist: revisioned(decodeWatchlistState),
  diary: revisioned(decodeDiaryState),
  lists: revisioned(decodeListsState),
  recent: revisioned(decodeRecentState),
  libraryOwner: codec(decodeLibraryOwner),
  syncState: codec(decodeSyncRecord),
  stash: codec(decodeAccountStash),
  migration: codec(decodeMigrationState),
  referenceCache: codec(decodeReferenceCache),
  imageHost: codec(decodeImageHost),
  homeUi: codec(decodeHomeUi),
  titleUi: codec(decodeTitleUi),
  libraryUi: codec(decodeLibraryUi),
} as const;
