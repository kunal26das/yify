import type {KeyValueStore} from './kv';
import {kv} from './kv';

export const V1_KEY_PATTERN = /^(privacy|settings|library|watchlist|history|journal|purchases|sync|nudge|streaming|search|availability-alerts|new-movies|notification-delivery):/;

export const V1_KEYS = {
  privacyChoices: 'privacy:choices',
  theme: 'settings:theme',
  watchRegion: 'settings:watchRegion',
  streamingServices: 'settings:streamingServices',
  historyPaused: 'settings:historyPaused',
  playback: 'settings:playback',
  watchlistItems: 'watchlist:items',
  watchlistMarks: 'sync:watchlistMarks',
  library: 'library:state',
  history: 'history:state',
  recentSearches: 'search:search.recents',
  linkedUid: 'sync:linkedUid',
  libraryUid: 'sync:libraryUid',
  libraryTransition: 'sync:libraryTransition',
  preferencesUpdatedAt: 'sync:preferencesUpdatedAt',
} as const;

export const V1_ACCOUNT_PREFIXES = {
  journal: 'journal:account:',
  journalDeleted: 'journal:deleted:',
  libraryAccount: 'sync:libraryAccount:',
  deletedAccount: 'sync:deletedAccount:',
} as const;

export type V1Source = keyof typeof V1_KEYS;

export interface V1AccountValue {
  uid: string;
  value: string;
}

export interface V1Snapshot {
  values: Partial<Record<V1Source, string>>;
  journals: V1AccountValue[];
  libraryAccounts: V1AccountValue[];
  deletedJournals: string[];
  deletedAccounts: string[];
}

export interface V1EntitlementCache {
  adsRemoved: boolean;
  expiresAt: string | null;
}

const RETIRED_V1_KEYS: readonly string[] = [
  'settings:notifications',
  'settings:confirmWatchlistRemoval',
  'settings:browseDefaults',
  'settings:notify',
  'watchlist:funnel_saved_milestones_v1',
  'library:mutationBlocked',
  'purchases:app_user_id',
];

const RETIRED_V1_PREFIXES: readonly string[] = ['nudge:', 'streaming:', 'availability-alerts:', 'new-movies:', 'notification-delivery:'];

const BACKUP_V1_PREFIXES: readonly string[] = ['privacy:', 'settings:', 'watchlist:', 'library:', 'history:', 'journal:', 'search:', 'sync:'];

const PURCHASES_PREFIX = 'purchases:';
const ENTITLEMENT_PREFIX = 'purchases:ads_removed:v2:';

function accountValues(store: KeyValueStore, keys: readonly string[], prefix: string): V1AccountValue[] {
  const values: V1AccountValue[] = [];
  for (const key of keys) {
    if (!key.startsWith(prefix) || key.length === prefix.length) continue;
    const value = store.getString(key);
    if (value !== undefined) values.push({uid: key.slice(prefix.length), value});
  }
  return values;
}

function flaggedAccounts(store: KeyValueStore, keys: readonly string[], prefix: string): string[] {
  return accountValues(store, keys, prefix).filter((entry) => entry.value === 'true').map((entry) => entry.uid);
}

function removeMatching(store: KeyValueStore, prefixes: readonly string[]): void {
  for (const key of store.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) store.remove(key);
  }
}

export function hasV1Data(store: KeyValueStore = kv): boolean {
  return store.keys().some((key) => V1_KEY_PATTERN.test(key));
}

export function readV1Snapshot(store: KeyValueStore = kv): V1Snapshot {
  const keys = [...store.keys()].sort();
  const values: Partial<Record<V1Source, string>> = {};
  for (const source of Object.keys(V1_KEYS) as V1Source[]) {
    const value = store.getString(V1_KEYS[source]);
    if (value !== undefined) values[source] = value;
  }
  return {
    values,
    journals: accountValues(store, keys, V1_ACCOUNT_PREFIXES.journal),
    libraryAccounts: accountValues(store, keys, V1_ACCOUNT_PREFIXES.libraryAccount),
    deletedJournals: flaggedAccounts(store, keys, V1_ACCOUNT_PREFIXES.journalDeleted),
    deletedAccounts: flaggedAccounts(store, keys, V1_ACCOUNT_PREFIXES.deletedAccount),
  };
}

export function removeRetiredV1Keys(store: KeyValueStore = kv): void {
  for (const key of RETIRED_V1_KEYS) store.remove(key);
  removeMatching(store, RETIRED_V1_PREFIXES);
}

export function removeV1Backup(store: KeyValueStore = kv): void {
  removeMatching(store, BACKUP_V1_PREFIXES);
}

export function removeV1PurchaseKeys(store: KeyValueStore = kv): void {
  removeMatching(store, [PURCHASES_PREFIX]);
}

export function readV1EntitlementCache(uid: string, store: KeyValueStore = kv): V1EntitlementCache | null {
  if (uid.length === 0) return null;
  const text = store.getString(ENTITLEMENT_PREFIX + encodeURIComponent(uid));
  if (text === undefined) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const {adsRemoved, expiresAt} = parsed as {adsRemoved?: unknown; expiresAt?: unknown};
  if (typeof adsRemoved !== 'boolean') return null;
  if (expiresAt === null) return {adsRemoved, expiresAt: null};
  return typeof expiresAt === 'string' && Number.isFinite(Date.parse(expiresAt)) ? {adsRemoved, expiresAt} : null;
}
