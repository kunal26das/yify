import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {PreferencesSectionState} from '@/core/domain/preferences';
import type {TitleSnapshot} from '@/core/domain/library';
import type {Codec} from './json';
import {readValue, writeValue} from './json';
import type {KeyValueStore} from './kv';
import {CODECS, KEY_PREFIXES, KEYS} from './keys';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & {data: Map<string, string>} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getString: (key) => data.get(key),
    setString: (key, value) => {
      data.set(key, value);
      return true;
    },
    remove: (key) => {
      data.delete(key);
    },
    keys: () => [...data.keys()],
  };
}

function roundTrip<T>(codec: Codec<T>, value: T): T | null {
  const store = memoryStore();
  assert.equal(writeValue(store, 'v2.probe', codec, value), true);
  return readValue(store, 'v2.probe', codec);
}

function decodeData<T>(codec: Codec<T>, data: unknown): T | null {
  return readValue(memoryStore({'v2.probe': JSON.stringify({v: codec.version, d: data})}), 'v2.probe', codec);
}

const matrix: TitleSnapshot = {title: 'The Matrix', year: 1999, posterPath: '/matrix.jpg', slug: 'the-matrix'};
const legacy: TitleSnapshot = {title: 'Title unavailable', year: null, posterPath: null, slug: ''};

const prefs: PreferencesSectionState = {
  values: {theme: 'light', accent: 'accent2', region: 'IN', services: {IN: [8, 119], US: [9]}, recentPaused: true, trailerCaptions: true},
  stamps: {theme: 10, accent: 11, region: 12, services: 13, recentPaused: 14, trailerCaptions: 15},
};

test('the key catalogue names every A5.2 key exactly', () => {
  assert.deepEqual({
    prefs: KEYS.prefs,
    consent: KEYS.consent,
    detectedRegion: KEYS.detectedRegion,
    recentSearches: KEYS.recentSearches,
    watchlist: KEYS.watchlist,
    diary: KEYS.diary,
    lists: KEYS.lists,
    recent: KEYS.recent,
    libraryOwner: KEYS.libraryOwner,
    syncState: KEYS.syncState('uid123'),
    stash: KEYS.stash('uid123'),
    migration: KEYS.migration,
    homeCache: KEYS.homeCache('IN'),
    referenceCache: KEYS.referenceCache,
    imageHost: KEYS.imageHost,
    homeUi: KEYS.homeUi,
    titleUi: KEYS.titleUi,
    libraryUi: KEYS.libraryUi,
    plusEntitlement: KEYS.plusEntitlement,
    adsLastShownAt: KEYS.adsLastShownAt,
    updatesPrompted: KEYS.updatesPrompted('117'),
    updatesDownloaded: KEYS.updatesDownloaded('117'),
  }, {
    prefs: 'v2.prefs',
    consent: 'v2.consent',
    detectedRegion: 'v2.region.detected',
    recentSearches: 'v2.search.recent',
    watchlist: 'v2.library.watchlist',
    diary: 'v2.library.diary',
    lists: 'v2.library.lists',
    recent: 'v2.library.recent',
    libraryOwner: 'v2.library.owner',
    syncState: 'v2.sync.uid123',
    stash: 'v2.stash.uid123',
    migration: 'v2.migration',
    homeCache: 'v2.cache.home.IN',
    referenceCache: 'v2.cache.reference',
    imageHost: 'v2.image.host',
    homeUi: 'v2.ui.home',
    titleUi: 'v2.ui.title',
    libraryUi: 'v2.ui.library',
    plusEntitlement: 'plus.entitlement.v1',
    adsLastShownAt: 'ads.lastShownAt',
    updatesPrompted: 'updates.prompted.117',
    updatesDownloaded: 'updates.downloaded.117',
  });
});

test('scoped keys share their prefixes and reject empty or malformed scopes', () => {
  assert.ok(KEYS.syncState('a').startsWith(KEY_PREFIXES.syncState));
  assert.ok(KEYS.stash('a').startsWith(KEY_PREFIXES.stash));
  assert.ok(KEYS.homeCache('US').startsWith(KEY_PREFIXES.homeCache));
  assert.ok(KEYS.homeCache('US').startsWith(KEY_PREFIXES.cache));
  assert.ok(KEYS.referenceCache.startsWith(KEY_PREFIXES.cache));
  assert.ok(KEYS.updatesPrompted('1').startsWith(KEY_PREFIXES.updatesPrompted));
  assert.ok(KEYS.updatesDownloaded('1').startsWith(KEY_PREFIXES.updatesDownloaded));
  assert.throws(() => KEYS.syncState(''), RangeError);
  assert.throws(() => KEYS.stash(''), RangeError);
  assert.throws(() => KEYS.updatesPrompted(''), RangeError);
  assert.throws(() => KEYS.updatesDownloaded(''), RangeError);
  for (const region of ['', 'in', 'IND', 'I1']) assert.throws(() => KEYS.homeCache(region), RangeError, region);
});

test('only the caches use the evictable prefix and every envelope key is a v2 key', () => {
  const fixed = Object.values(KEYS).filter((value): value is string => typeof value === 'string');
  assert.equal(new Set(fixed).size, fixed.length);
  const cached = fixed.filter((key) => key.startsWith(KEY_PREFIXES.cache));
  assert.deepEqual(cached, ['v2.cache.reference']);
  for (const name of Object.keys(CODECS) as (keyof typeof CODECS)[]) {
    assert.equal(CODECS[name].version, 1, name);
    const key = KEYS[name];
    const resolved = typeof key === 'function' ? key(name === 'homeCache' ? 'IN' : 'uid123') : key;
    assert.ok(resolved.startsWith('v2.'), name);
  }
  for (const raw of [KEYS.plusEntitlement, KEYS.adsLastShownAt, KEYS.updatesPrompted('1'), KEYS.updatesDownloaded('1')]) {
    assert.equal(raw.startsWith('v2.'), false, raw);
  }
});

test('valid values round-trip through every codec unchanged', () => {
  const cases: [string, Codec<never>, unknown][] = [
    ['prefs', CODECS.prefs as Codec<never>, prefs],
    ['consent', CODECS.consent as Codec<never>, {analytics: true, youtube: false, noticeVersion: 'v3', decidedAt: '2026-11-26T10:00:00.000Z'}],
    ['detectedRegion', CODECS.detectedRegion as Codec<never>, {code: 'IN', source: 'geo', at: 1764150000000}],
    ['recentSearches', CODECS.recentSearches as Codec<never>, {terms: ['dune', 'The Matrix']}],
    ['watchlist', CODECS.watchlist as Codec<never>, {rev: 3, state: {entries: {'movie:603': {addedAt: 5, snapshot: matrix}, 'v1:8462': {addedAt: 4, snapshot: legacy}}, removed: {'tv:1399': 9}}}],
    ['diary', CODECS.diary as Codec<never>, {rev: 1, state: {clearedAt: 0, entries: {d_1: {
      id: 'd_1', key: 'movie:603', snapshot: matrix, watchedOn: '2026-11-20', rating: 9, note: 'Again', rewatch: true,
      createdAt: 10, updatedAt: 11, deletedAt: 0,
    }, w1_8462: {
      id: 'w1_8462', key: 'imdb:tt0133093', snapshot: legacy, watchedOn: null, rating: null, note: '', rewatch: false,
      createdAt: 5, updatedAt: 5, deletedAt: 0,
    }}}}],
    ['lists', CODECS.lists as Codec<never>, {rev: 2, state: {clearedAt: 1, lists: {l_1: {
      id: 'l_1', name: 'Weekend', createdAt: 1, updatedAt: 2, removedAt: 0,
      items: {'movie:603': {at: 3, value: true, snapshot: matrix}, 'tv:1399': {at: 4, value: false, snapshot: legacy}},
    }}}}],
    ['recent', CODECS.recent as Codec<never>, {rev: 4, state: {entries: {'movie:603': {viewedAt: 8, snapshot: matrix}}, removed: {'tv:1399': 7}, clearedAt: 2}}],
    ['libraryOwner', CODECS.libraryOwner as Codec<never>, {uid: 'uid123', settled: false}],
    ['syncState', CODECS.syncState as Codec<never>, {
      sections: {
        watchlist: {remoteUpdateTime: '2026-11-26T10:00:00.123456Z', syncedRev: 3},
        diary: {remoteUpdateTime: null, syncedRev: 0},
        lists: {remoteUpdateTime: null, syncedRev: 1},
        recent: {remoteUpdateTime: null, syncedRev: 0},
        preferences: {remoteUpdateTime: null, syncedRev: 2},
      },
      lastSyncedAt: 1764150000000,
      deleted: false,
      importPending: {attempts: 2, nextAttemptAt: 1764160000000},
      v1CheckedAt: null,
    }],
    ['stash', CODECS.stash as Codec<never>, {savedAt: 1, prefs, watchlist: {entries: {}, removed: {}}, recent: {entries: {}, removed: {}, clearedAt: 0}}],
    ['migration', CODECS.migration as Codec<never>, {
      localV1: 'done',
      completedAt: 100,
      resolutions: {
        'imdb:tt0133093': {key: 'movie:603', slug: 'the-matrix', title: 'The Matrix', year: 1999, posterPath: '/matrix.jpg', imdbId: 'tt0133093'},
        'v1:8462': {unresolved: true, attempts: 2, nextAttemptAt: 200, final: false},
      },
      v1CleanupAt: 300,
      noticeShown: false,
    }],
    ['homeCache', CODECS.homeCache as Codec<never>, {savedAt: 5, data: {v: 2, region: 'IN', generatedAt: '2026-11-26T10:00:00Z', hero: [], rails: []}}],
    ['referenceCache', CODECS.referenceCache as Codec<never>, {savedAt: 5, genres: [{id: 28, name: 'Action', types: ['movie']}], regions: [{code: 'IN', name: 'India'}]}],
    ['imageHost', CODECS.imageHost as Codec<never>, {mode: 'proxy', until: 1764150000000}],
    ['homeUi', CODECS.homeUi as Codec<never>, {popular: 'tv'}],
    ['titleUi', CODECS.titleUi as Codec<never>, {signInHintShown: true}],
    ['libraryUi', CODECS.libraryUi as Codec<never>, {signInRowHidden: false}],
  ];
  assert.deepEqual(cases.map(([name]) => name).sort(), Object.keys(CODECS).sort());
  for (const [name, codec, value] of cases) assert.deepEqual(roundTrip(codec, value as never), value, name);
});

test('preferences decode field by field and an invalid field falls back to its default with stamp 0', () => {
  const decoded = decodeData(CODECS.prefs, {
    values: {theme: 'sepia', accent: 'rust', region: 'india', services: {IN: [8, 8, -1, 'x', 119], in: [1], US: 'all', GB: []}, recentPaused: 'yes', trailerCaptions: true},
    stamps: {theme: 5, accent: 6, region: 7, services: 8, recentPaused: 9, trailerCaptions: -1},
  });
  assert.deepEqual(decoded, {
    values: {theme: 'dark', accent: 'default', region: null, services: {IN: [8, 119]}, recentPaused: false, trailerCaptions: true},
    stamps: {theme: 0, accent: 0, region: 0, services: 8, recentPaused: 0, trailerCaptions: 0},
  });
  assert.deepEqual(decodeData(CODECS.prefs, {}), decodeData(CODECS.prefs, {values: null, stamps: []}));
  assert.equal(decodeData(CODECS.prefs, 'dark'), null);
  const tooMany = Object.fromEntries(Array.from({length: 251}, (_, index) => [`${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`, [1]]));
  assert.deepEqual(decodeData(CODECS.prefs, {values: {services: tooMany}, stamps: {services: 4}})?.values.services, {});
  const capped = decodeData(CODECS.prefs, {values: {services: {IN: Array.from({length: 70}, (_, index) => index + 1)}}, stamps: {services: 4}});
  assert.equal(capped?.values.services.IN?.length, 64);
  assert.equal(capped?.stamps.services, 4);
});

test('consent, detected region, owner, image host and UI flags reject invalid records whole', () => {
  const consent = {analytics: false, youtube: true, noticeVersion: '', decidedAt: null};
  assert.deepEqual(decodeData(CODECS.consent, consent), consent);
  for (const invalid of [{...consent, analytics: 'no'}, {...consent, decidedAt: '2026-11-26'}, {...consent, decidedAt: 1}, {...consent, noticeVersion: 3}, null]) {
    assert.equal(decodeData(CODECS.consent, invalid), null, JSON.stringify(invalid));
  }
  assert.equal(decodeData(CODECS.detectedRegion, {code: 'IN', source: 'gps', at: 1}), null);
  assert.equal(decodeData(CODECS.detectedRegion, {code: 'in', source: 'geo', at: 1}), null);
  assert.equal(decodeData(CODECS.detectedRegion, {code: 'IN', source: 'geo', at: -1}), null);
  assert.equal(decodeData(CODECS.libraryOwner, {uid: '', settled: true}), null);
  assert.deepEqual(decodeData(CODECS.libraryOwner, {uid: null, settled: true}), {uid: null, settled: true});
  assert.equal(decodeData(CODECS.imageHost, {mode: 'cdn', until: 1}), null);
  assert.equal(decodeData(CODECS.imageHost, {mode: 'direct', until: 1.5}), null);
  assert.equal(decodeData(CODECS.homeUi, {popular: 'anime'}), null);
  assert.equal(decodeData(CODECS.titleUi, {signInHintShown: 1}), null);
  assert.equal(decodeData(CODECS.libraryUi, {}), null);
});

test('recent searches keep the newest ten distinct terms, ignoring case', () => {
  const terms = ['Dune', 'dune', 'Matrix', '', '   ', 7, 'matrix', ...Array.from({length: 12}, (_, index) => `term ${index}`)];
  const decoded = decodeData(CODECS.recentSearches, {terms});
  assert.deepEqual(decoded?.terms, ['Dune', 'Matrix', 'term 0', 'term 1', 'term 2', 'term 3', 'term 4', 'term 5', 'term 6', 'term 7']);
  assert.equal(decodeData(CODECS.recentSearches, {terms: 'dune'}), null);
});

test('library sections drop invalid records and keep the valid ones', () => {
  const watchlist = decodeData(CODECS.watchlist, {rev: 2, state: {
    entries: {
      'movie:603': {addedAt: 5, snapshot: matrix, extra: true},
      'movie:0': {addedAt: 5, snapshot: matrix},
      'person:1': {addedAt: 5, snapshot: matrix},
      'tv:1399': {addedAt: -1, snapshot: matrix},
      'tv:1400': {addedAt: 1, snapshot: {title: 'Untitled', year: '1999', posterPath: 3, slug: null, extra: 'dropped'}},
      'tv:1401': {addedAt: 1, snapshot: {...matrix, title: null}},
      'imdb:tt0944947': {addedAt: 1},
    },
    removed: {'movie:604': 4, 'movie:605': 'yesterday'},
  }});
  assert.deepEqual(watchlist, {rev: 2, state: {
    entries: {
      'movie:603': {addedAt: 5, snapshot: matrix},
      'tv:1400': {addedAt: 1, snapshot: {title: 'Untitled', year: null, posterPath: null, slug: ''}},
    },
    removed: {'movie:604': 4},
  }});
  const entry = {id: 'd_1', key: 'movie:603', snapshot: matrix, watchedOn: '2026-02-28', rating: 9, note: '', rewatch: false, createdAt: 1, updatedAt: 1, deletedAt: 0};
  const diary = decodeData(CODECS.diary, {rev: 1, state: {clearedAt: 'never', entries: {
    d_1: entry,
    d_2: {...entry, id: 'd_2', watchedOn: '2026-11-31'},
    d_3: {...entry, id: 'd_3', rating: 11},
    d_4: {...entry, id: 'd_x'},
    d_5: {...entry, id: 'd_5', key: 'person:1'},
    'bad id': {...entry, id: 'bad id'},
    d_6: {...entry, id: 'd_6', watchedOn: '2026-11-20', rating: 1, note: 'Fine'},
  }}});
  assert.deepEqual(Object.keys(diary?.state.entries ?? {}), ['d_1', 'd_6']);
  assert.equal(diary?.state.clearedAt, 0);
  const lists = decodeData(CODECS.lists, {rev: 1, state: {clearedAt: 0, lists: {
    l_1: {id: 'l_1', name: 'Keep', createdAt: 1, updatedAt: 1, removedAt: 0, items: {'movie:603': {at: 1, value: true, snapshot: matrix}, 'v2:1': {at: 1, value: true, snapshot: matrix}, 'tv:1': {at: 1, value: 'yes', snapshot: matrix}}},
    l_2: {id: 'l_2', name: 3, createdAt: 1, updatedAt: 1, removedAt: 0, items: {}},
    l_3: {id: 'l_3', name: 'No items', createdAt: 1, updatedAt: 1, removedAt: 2},
  }}});
  assert.deepEqual(lists?.state.lists, {
    l_1: {id: 'l_1', name: 'Keep', createdAt: 1, updatedAt: 1, removedAt: 0, items: {'movie:603': {at: 1, value: true, snapshot: matrix}}},
    l_3: {id: 'l_3', name: 'No items', createdAt: 1, updatedAt: 1, removedAt: 2, items: {}},
  });
  assert.deepEqual(decodeData(CODECS.recent, {rev: 0, state: {entries: {'movie:603': {viewedAt: 'now', snapshot: matrix}}}}), {
    rev: 0, state: {entries: {}, removed: {}, clearedAt: 0},
  });
});

test('a __proto__ record id is dropped instead of replacing the prototype', () => {
  const entry = {id: '__proto__', key: 'movie:603', snapshot: matrix, watchedOn: null, rating: null, note: '', rewatch: false, createdAt: 1, updatedAt: 1, deletedAt: 0};
  const list = {id: '__proto__', name: 'Sneaky', createdAt: 1, updatedAt: 1, removedAt: 0, items: {}};
  const store = memoryStore({
    [KEYS.diary]: `{"v":1,"d":{"rev":1,"state":{"clearedAt":0,"entries":{"__proto__":${JSON.stringify(entry)}}}}}`,
    [KEYS.lists]: `{"v":1,"d":{"rev":1,"state":{"clearedAt":0,"lists":{"__proto__":${JSON.stringify(list)}}}}}`,
  });
  const diary = readValue(store, KEYS.diary, CODECS.diary);
  const lists = readValue(store, KEYS.lists, CODECS.lists);
  assert.deepEqual(diary, {rev: 1, state: {clearedAt: 0, entries: {}}});
  assert.deepEqual(lists, {rev: 1, state: {clearedAt: 0, lists: {}}});
  assert.equal(Object.getPrototypeOf(diary?.state.entries), Object.prototype);
  assert.equal(Object.getPrototypeOf(lists?.state.lists), Object.prototype);
});

test('section envelopes need an integer revision and a state object', () => {
  for (const data of [{state: {entries: {}, removed: {}}}, {rev: -1, state: {}}, {rev: 1.5, state: {}}, {rev: 1, state: []}, {rev: 1}, []]) {
    assert.equal(decodeData(CODECS.watchlist, data), null, JSON.stringify(data));
  }
});

test('sync records fill missing sections and drop malformed bookkeeping', () => {
  assert.deepEqual(decodeData(CODECS.syncState, {sections: {diary: {remoteUpdateTime: 5, syncedRev: 4}}, lastSyncedAt: 'today', deleted: 'yes', importPending: {attempts: 1}}), {
    sections: {
      watchlist: {remoteUpdateTime: null, syncedRev: 0},
      diary: {remoteUpdateTime: null, syncedRev: 4},
      lists: {remoteUpdateTime: null, syncedRev: 0},
      recent: {remoteUpdateTime: null, syncedRev: 0},
      preferences: {remoteUpdateTime: null, syncedRev: 0},
    },
    lastSyncedAt: null,
    deleted: false,
    importPending: null,
    v1CheckedAt: null,
  });
  assert.equal(decodeData(CODECS.syncState, 'synced'), null);
});

test('stashes keep their valid sections and need a save time', () => {
  assert.deepEqual(decodeData(CODECS.stash, {savedAt: 9, prefs: 'light', diary: {clearedAt: 0, entries: {}}, lists: null}), {
    savedAt: 9,
    diary: {clearedAt: 0, entries: {}},
  });
  assert.equal(decodeData(CODECS.stash, {diary: {clearedAt: 0, entries: {}}}), null);
});

test('migration records validate the phase and every resolution', () => {
  const decoded = decodeData(CODECS.migration, {
    localV1: 'pending',
    completedAt: 'soon',
    resolutions: {
      'imdb:tt0133093': {key: 'movie:603', slug: 'the-matrix', title: 'The Matrix', year: 1999, posterPath: null, imdbId: null},
      'v1:1': {key: 'person:1', slug: '', title: 'Nobody', year: null, posterPath: null, imdbId: null},
      'v1:2': {unresolved: true, attempts: 1, nextAttemptAt: 2},
      'movie:603': {unresolved: true, attempts: 1, nextAttemptAt: 2, final: true},
      'v1:3': {unresolved: true, attempts: 1, nextAttemptAt: 2, final: true},
    },
  });
  assert.deepEqual(decoded, {
    localV1: 'pending',
    completedAt: null,
    resolutions: {
      'imdb:tt0133093': {key: 'movie:603', slug: 'the-matrix', title: 'The Matrix', year: 1999, posterPath: null, imdbId: null},
      'v1:3': {unresolved: true, attempts: 1, nextAttemptAt: 2, final: true},
    },
    v1CleanupAt: null,
    noticeShown: false,
  });
  assert.equal(decodeData(CODECS.migration, {localV1: 'running'}), null);
});

test('home caches keep a v2 home response and reject anything else whole', () => {
  const data = {v: 2, region: 'IN', generatedAt: '2026-11-26T10:00:00Z', hero: [], rails: []};
  assert.deepEqual(decodeData(CODECS.homeCache, {savedAt: 5, data}), {savedAt: 5, data});
  assert.equal(decodeData(CODECS.homeCache, {savedAt: 5, data: {...data, v: 1}}), null);
  assert.equal(decodeData(CODECS.homeCache, {savedAt: 5, data: {...data, region: 'india'}}), null);
  assert.equal(decodeData(CODECS.homeCache, {savedAt: 5, data: {...data, rails: null}}), null);
  assert.equal(decodeData(CODECS.homeCache, {data}), null);
});

test('reference caches drop malformed genres and regions', () => {
  assert.deepEqual(decodeData(CODECS.referenceCache, {
    savedAt: 1,
    genres: [{id: 28, name: 'Action', types: ['movie', 'movie', 'anime']}, {id: 0, name: 'None', types: []}, {id: 18, name: 'Drama'}],
    regions: [{code: 'IN', name: 'India'}, {code: 'IND', name: 'India'}, 'US'],
  }), {savedAt: 1, genres: [{id: 28, name: 'Action', types: ['movie']}], regions: [{code: 'IN', name: 'India'}]});
  assert.equal(decodeData(CODECS.referenceCache, {savedAt: 1, genres: []}), null);
});
