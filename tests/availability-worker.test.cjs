const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../public/availability-worker.js'), 'utf8');

function storage(values = new Map()) {
    return {values, open() {
        const request = {};
        queueMicrotask(() => {
            request.result = {close() {}, transaction() {
                const transaction = {objectStore() {return {
                    get(key) {
                        const read = {};
                        queueMicrotask(() => {read.result = values.get(key); read.onsuccess();});
                        return read;
                    },
                    put(value, key) {
                        values.set(key, value);
                        queueMicrotask(() => transaction.oncomplete());
                    },
                };}};
                return transaction;
            }};
            request.onsuccess();
        });
        return request;
    }};
}

function fixture({base = '', database = storage(), clients = [], showFails = false} = {}) {
    const events = new Map();
    const shown = [];
    const opened = [];
    const self = {
        location: {href: `https://yify.example${base}/availability-worker.js`, origin: 'https://yify.example'},
        registration: {
            async getNotifications({tag} = {}) {return shown.filter(item => !item.closed && (!tag || item.options.tag === tag));},
            async showNotification(title, options) {
                if (showFails) throw new Error('display failed');
                shown.push({title, options, closed: false});
            },
        },
        clients: {async matchAll() {return clients;}, async openWindow(url) {opened.push(url);}},
        addEventListener: (name, callback) => events.set(name, callback),
    };
    vm.runInNewContext(source, {self, indexedDB: database, URL, Date, Promise, Error});
    return {shown, opened, events, database,
        async push(payload) {
            let result;
            events.get('push')({data: {json: () => payload}, waitUntil(value) {result = value;}});
            if (result) await result;
        },
        async click(data, tag = `yify-availability:${data.eventId}`) {
            let result;
            let closed = false;
            events.get('notificationclick')({notification: {data, tag, close() {closed = true;}}, waitUntil(value) {result = value;}});
            if (result) await result;
            return closed;
        },
    };
}

const payload = (eventId = 'event-123') => ({from: 'firebase', data: {
    kind: 'availability', eventId, title: 'A saved film is on your services', body: 'See where you can watch it.', path: '/movie/123', count: '1', movieId: '123',
}});

test('data-only FCM push shows a silent tagged notification without fetch handlers or remote scripts', async () => {
    const f = fixture();
    assert.deepEqual([...f.events.keys()], ['push', 'notificationclick']);
    await f.push(payload());
    assert.equal(f.shown.length, 1);
    assert.equal(f.shown[0].options.tag, 'yify-availability:event-123');
    assert.equal(f.shown[0].options.silent, true);
    assert.equal(f.shown[0].options.data.path, '/movie/123');
});

test('duplicate messages are suppressed concurrently, after dismissal and after worker restart', async () => {
    const f = fixture();
    await Promise.all([f.push(payload()), f.push(payload())]);
    assert.equal(f.shown.length, 1);
    f.shown[0].closed = true;
    await f.push(payload());
    assert.equal(f.shown.length, 1);
    const restarted = fixture({database: f.database});
    await restarted.push(payload());
    assert.equal(restarted.shown.length, 0);
    await restarted.push(payload('next-event'));
    assert.equal(restarted.shown.length, 1);
});

test('failed notification display releases its claim so delivery can retry', async () => {
    const f = fixture({showFails: true});
    await assert.rejects(f.push(payload()), /display failed/);
    const restarted = fixture({database: f.database});
    await restarted.push(payload());
    assert.equal(restarted.shown.length, 1);
});

test('invalid data and malicious navigation paths are rejected before showing or opening', async () => {
    const f = fixture();
    for (const path of ['https://attacker.example/movie/1', '//attacker.example', '/movie/../settings', '/movie/1?next=https://attacker.example', '/movie/%31', '/watchlist#x', '/movie/0', '/movie/1/']) {
        const data = {...payload().data, path};
        await f.push({data});
        await f.click(data);
    }
    await f.push({data: {...payload().data, kind: 'other'}});
    await f.push({data: {...payload().data, eventId: '../unsafe'}});
    await f.push({data: {...payload().data, body: 'x'.repeat(601)}});
    await f.push({data: {...payload().data, title: ''}});
    await f.push(null);
    assert.equal(f.shown.length, 0);
    assert.deepEqual(f.opened, []);
});

test('closed-browser clicks open only the local movie route with availability attribution', async () => {
    const f = fixture();
    assert.equal(await f.click(payload().data), true);
    assert.deepEqual(f.opened, ['https://yify.example/movie/123?notification_kind=availability&notification_event=event-123']);
});

test('GitHub Pages notification clicks keep the app prefix and ignore unrelated tabs', async () => {
    const calls = [];
    const f = fixture({base: '/yify', clients: [
        {url: 'https://attacker.example/yify/', async navigate() {throw new Error('must not navigate');}},
        {url: 'https://yify.example/other-project/', async navigate() {throw new Error('must not navigate');}},
        {url: 'https://yify.example/yify/movies', async navigate(url) {calls.push(url); return {async focus() {calls.push('focus');}};}},
    ]});
    await f.click({...payload().data, path: '/watchlist'});
    assert.deepEqual(calls, ['https://yify.example/yify/watchlist?notification_kind=availability&notification_event=event-123', 'focus']);
    assert.deepEqual(f.opened, []);
});

test('foreign notification clicks are not claimed', async () => {
    const f = fixture();
    assert.equal(await f.click(payload().data, 'unrelated'), false);
    assert.equal(await f.click({...payload().data, kind: 'daily-pick'}), false);
    assert.deepEqual(f.opened, []);
});

test('notification event identifiers are validated and encoded into the local click URL', async () => {
    const f = fixture();
    for (const eventId of ['', 'x'.repeat(129), 'event&next=https://attacker.example']) await f.click({...payload().data, eventId});
    assert.deepEqual(f.opened, []);
    await f.click({...payload().data, eventId: 'event:123'});
    assert.deepEqual(f.opened, ['https://yify.example/movie/123?notification_kind=availability&notification_event=event%3A123']);
});

test('the persistent event ledger stays bounded', async () => {
    const f = fixture();
    for (let index = 0; index < 140; index++) await f.push(payload(`event-${index}`));
    assert.equal(f.database.values.get('recent').length, 128);
});
