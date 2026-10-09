import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {loadTypeScript} = require('../../../tests/helpers/load-typescript.cjs');
const {SubscriberAccessError} = loadTypeScript('data/server/subscribers/errors.ts');
const {createCatalogHandler} = loadTypeScript('data/server/catalog/handler.ts', {
    '../subscribers/errors': {SubscriberAccessError}, './nyaa': {NyaaFeedError: class extends Error {}},
});
const HASH = '0123456789abcdef0123456789abcdef01234567';
const MAGNET = `magnet:?xt=urn:btih:${HASH}`;

function request(operation: string, query = 'v=2'): Request {
    return new Request(`https://yify.expo.app/api/native-subscriber-catalog/${operation}?${query}`,
        {headers: {Authorization: 'Bearer verified-token'}});
}

function clean(response: Response, body: string): void {
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('CDN-Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Vary'), 'Authorization');
    assert.doesNotMatch(body, /"(?:raw|responses|infoHash|info_hash|link|url|hash|magnetUrl|magnet_url)"/i);
    assert.doesNotMatch(body, /magnet\s*:|urn:btih:|\.torrent|0123456789abcdef0123456789abcdef01234567/i);
}

test('native subscriber route serializes only projected Anime metadata after authorization', async () => {
    let authorized = false;
    const handler = createCatalogHandler((_signal: AbortSignal, capture: unknown) => {
        assert.equal(authorized, true);
        assert.equal(capture, undefined);
        return {movies: {}, shows: {}, anime: {async listAnime() {
            return {releases: [{id: 'nyaa:123', title: `Sample ${MAGNET} https://nyaa.si/download/123.torrent`,
                category: 'english', uploadedAt: new Date('2026-09-19T03:27:22.000Z'), size: '320 MiB',
                seeds: 5, peers: 2, downloadCount: 20, infoHash: HASH,
                link: 'https://nyaa.si/download/123.torrent'}], limit: 75};
        }}};
    }, {subscriber: {authorize: async () => {authorized = true; return {uid: 'verified'};}}, nativeMetadataOnly: true});
    const response = await handler(request('anime'), 'anime');
    assert.equal(response.status, 200);
    const body = await response.text();
    clean(response, body);
    assert.deepEqual(Object.keys(JSON.parse(body)), ['metadata']);
    assert.equal(JSON.parse(body).metadata.releases[0].id, 'nyaa:123');
});

test('native subscriber access never initializes the source and rejects other operations', async () => {
    let created = 0;
    const handler = createCatalogHandler(() => {created++; throw new Error('Unexpected source access');},
        {subscriber: {authorize: async () => ({uid: 'verified'})}, nativeMetadataOnly: true});
    const access = await handler(request('access'), 'access');
    assert.equal(access.status, 200);
    const body = await access.text();
    clean(access, body);
    assert.deepEqual(JSON.parse(body), {metadata: {allowed: true}});
    for (const operation of ['movies', 'movie', 'suggestions', 'parental-guides', 'shows', 'episodes']) {
        const response = await handler(request(operation), operation);
        assert.equal(response.status, 400);
        clean(response, await response.text());
    }
    assert.equal(created, 0);
});

test('native subscriber denial and restore preserve authorization without source disclosure', async () => {
    let allowed = true;
    let created = 0;
    const handler = createCatalogHandler(() => {
        created++;
        return {movies: {}, shows: {}, anime: {async listAnime() {return {releases: [], limit: 75};}}};
    }, {subscriber: {authorize: async () => {
        if (!allowed) throw new SubscriberAccessError(403);
        return {uid: 'verified'};
    }}, nativeMetadataOnly: true});
    const initial = await handler(request('anime'), 'anime');
    assert.equal(initial.status, 200);
    clean(initial, await initial.text());
    assert.equal(created, 1);
    allowed = false;
    for (const operation of ['access', 'anime']) {
        const denied = await handler(request(operation), operation);
        assert.equal(denied.status, 403);
        clean(denied, await denied.text());
    }
    assert.equal(created, 1);
    allowed = true;
    const restored = await handler(request('anime'), 'anime');
    assert.equal(restored.status, 200);
    clean(restored, await restored.text());
    assert.equal(created, 2);
});
