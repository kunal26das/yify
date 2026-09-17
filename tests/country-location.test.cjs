const test = require('node:test');
const assert = require('node:assert/strict');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const flush = () => new Promise(setImmediate);
const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
};
const position = {coords: {latitude: 19.07609, longitude: 72.877426}};

function native(overrides = {}) {
    const calls = [];
    const location = {
        Accuracy: {Low: 2},
        getForegroundPermissionsAsync: async () => ({granted: true}),
        requestForegroundPermissionsAsync: async () => ({granted: true}),
        getCurrentPositionAsync: async () => position,
        reverseGeocodeAsync: async () => [{isoCountryCode: 'in'}],
        ...overrides,
    };
    for (const name of Object.keys(location)) {
        if (typeof location[name] !== 'function') continue;
        const original = location[name];
        location[name] = (...args) => { calls.push([name, ...args]); return original(...args); };
    }
    const {CountryLocationImpl} = loadTypeScript('data/services/CountryLocationImpl.ts', {'expo-location': location});
    return {service: new CountryLocationImpl(), calls};
}

function web(t, geolocation, fetch = async () => ({ok: true, json: async () => ({countryCode: 'IN'})})) {
    const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {geolocation}});
    const requests = [];
    globalThis.fetch = (...args) => { requests.push(args); return fetch(...args); };
    t.after(() => {
        if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
        else delete globalThis.navigator;
        globalThis.fetch = originalFetch;
    });
    const {CountryLocationImpl} = loadTypeScript('data/services/CountryLocationImpl.web.ts');
    return {service: new CountryLocationImpl(), requests};
}

test('native location is requested only on demand, with coarse accuracy, and returns only the country', async () => {
    const {service, calls} = native();
    assert.deepEqual(calls, []);
    assert.deepEqual(await service.requestCountry(), {status: 'ready', country: 'IN'});
    assert.deepEqual(calls, [
        ['getForegroundPermissionsAsync'],
        ['getCurrentPositionAsync', {accuracy: 2, mayShowUserSettingsDialog: false}],
        ['reverseGeocodeAsync', {latitude: position.coords.latitude, longitude: position.coords.longitude}],
    ]);
});

test('native denied permission never requests coordinates or geocoding and does not repeat a blocked prompt', async () => {
    for (const canAskAgain of [false, true]) {
        const {service, calls} = native({
            getForegroundPermissionsAsync: async () => ({granted: false, canAskAgain}),
            requestForegroundPermissionsAsync: async () => ({granted: false, canAskAgain: false}),
        });
        assert.deepEqual(await service.requestCountry(), {status: 'denied'});
        assert.deepEqual(calls.map(([name]) => name), canAskAgain
            ? ['getForegroundPermissionsAsync', 'requestForegroundPermissionsAsync']
            : ['getForegroundPermissionsAsync']);
    }
});

test('native prompt may grant approximate foreground access', async () => {
    const {service, calls} = native({getForegroundPermissionsAsync: async () => ({granted: false, canAskAgain: true})});
    assert.deepEqual(await service.requestCountry(), {status: 'ready', country: 'IN'});
    assert.equal(calls.filter(([name]) => name === 'requestForegroundPermissionsAsync').length, 1);
});

test('all native SDK failures become a static result instead of an unhandled error with location data', async () => {
    for (const name of ['getForegroundPermissionsAsync', 'requestForegroundPermissionsAsync', 'getCurrentPositionAsync', 'reverseGeocodeAsync']) {
        const {service} = native({
            ...(name === 'requestForegroundPermissionsAsync'
                ? {getForegroundPermissionsAsync: async () => ({granted: false})} : {}),
            [name]: async () => { throw new Error('latitude=19.07609 longitude=72.877426'); },
        });
        assert.deepEqual(await service.requestCountry(), {status: 'unavailable'}, name);
    }
});

test('native malformed coordinates and country codes are unavailable', async () => {
    for (const coordinates of [{latitude: 91, longitude: 1}, {latitude: 1, longitude: Infinity}, {latitude: '19', longitude: 72}]) {
        const {service, calls} = native({getCurrentPositionAsync: async () => ({coords: coordinates})});
        assert.deepEqual(await service.requestCountry(), {status: 'unavailable'});
        assert.equal(calls.some(([name]) => name === 'reverseGeocodeAsync'), false);
    }
    for (const addresses of [[], null, {}, [{isoCountryCode: null}], [{isoCountryCode: 'IND'}], [{isoCountryCode: '1N'}]]) {
        const {service} = native({reverseGeocodeAsync: async () => addresses});
        assert.deepEqual(await service.requestCountry(), {status: 'unavailable'});
    }
});

test('native abort before or during permission prevents location retrieval', async () => {
    const before = new AbortController();
    before.abort();
    const first = native();
    assert.deepEqual(await first.service.requestCountry(before.signal), {status: 'unavailable'});
    assert.deepEqual(first.calls, []);
    const permission = deferred();
    const {service, calls} = native({getForegroundPermissionsAsync: () => permission.promise});
    const controller = new AbortController();
    const result = service.requestCountry(controller.signal);
    await flush();
    controller.abort();
    assert.deepEqual(await result, {status: 'unavailable'});
    permission.resolve({granted: true});
    await flush();
    assert.deepEqual(calls.map(([name]) => name), ['getForegroundPermissionsAsync']);
});

test('native abort during position prevents geocoding and allows a fresh lookup', async () => {
    const pending = deferred();
    let count = 0;
    const {service, calls} = native({getCurrentPositionAsync: () => ++count === 1 ? pending.promise : Promise.resolve(position)});
    const controller = new AbortController();
    const first = service.requestCountry(controller.signal);
    await flush();
    controller.abort();
    assert.deepEqual(await first, {status: 'unavailable'});
    const second = service.requestCountry();
    assert.deepEqual(await second, {status: 'ready', country: 'IN'});
    pending.resolve(position);
    await flush();
    assert.equal(calls.filter(([name]) => name === 'reverseGeocodeAsync').length, 1);
});

test('native concurrent callers share a lookup while one caller can cancel independently', async () => {
    const pending = deferred();
    const {service, calls} = native({getCurrentPositionAsync: () => pending.promise});
    const controller = new AbortController();
    const first = service.requestCountry(controller.signal);
    const second = service.requestCountry();
    await flush();
    controller.abort();
    assert.deepEqual(await first, {status: 'unavailable'});
    pending.resolve(position);
    assert.deepEqual(await second, {status: 'ready', country: 'IN'});
    assert.equal(calls.filter(([name]) => name === 'getCurrentPositionAsync').length, 1);
    assert.equal(calls.filter(([name]) => name === 'reverseGeocodeAsync').length, 1);
});

test('native timeout resolves all callers and prevents a late permission response from continuing', async (t) => {
    t.mock.timers.enable({apis: ['setTimeout']});
    const permission = deferred();
    const {service, calls} = native({getForegroundPermissionsAsync: () => permission.promise});
    const first = service.requestCountry();
    const second = service.requestCountry();
    await flush();
    t.mock.timers.tick(30_000);
    assert.deepEqual(await first, {status: 'timeout'});
    assert.deepEqual(await second, {status: 'timeout'});
    permission.resolve({granted: true});
    await flush();
    assert.deepEqual(calls.map(([name]) => name), ['getForegroundPermissionsAsync']);
});

test('web lookup remains idle until requested and rounds granted coordinates without cookies or cache', async (t) => {
    const positions = [];
    const {service, requests} = web(t, {getCurrentPosition: (success, failure, options) => {
        positions.push(options);
        success(position);
    }});
    assert.deepEqual(positions, []);
    assert.deepEqual(requests, []);
    assert.deepEqual(await service.requestCountry(), {status: 'ready', country: 'IN'});
    assert.deepEqual(positions, [{enableHighAccuracy: false, maximumAge: 0, timeout: 15_000}]);
    assert.equal(requests.length, 1);
    const [address, options] = requests[0];
    const url = new URL(address);
    assert.equal(url.origin + url.pathname, 'https://api.bigdatacloud.net/data/reverse-geocode-client');
    assert.deepEqual(Object.fromEntries(url.searchParams), {latitude: '19.08', longitude: '72.88', localityLanguage: 'en'});
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.referrerPolicy, 'no-referrer');
});

test('web unavailable or denied permission never sends a geocoder or IP lookup', async (t) => {
    let failure;
    const geolocation = {getCurrentPosition: (success, onError) => { failure = onError; }};
    const {service, requests} = web(t, geolocation);
    for (const [code, status] of [[1, 'denied'], [2, 'unavailable'], [3, 'timeout']]) {
        const result = service.requestCountry();
        await flush();
        failure({code});
        assert.deepEqual(await result, {status});
    }
    delete globalThis.navigator.geolocation;
    assert.deepEqual(await service.requestCountry(), {status: 'unavailable'});
    assert.deepEqual(requests, []);
});

test('web malformed positions never leave the browser', async (t) => {
    let received = position;
    const {service, requests} = web(t, {getCurrentPosition: (success) => success(received)});
    for (received of [null, {}, {coords: {latitude: NaN, longitude: 0}}, {coords: {latitude: 0, longitude: 181}}]) {
        assert.deepEqual(await service.requestCountry(), {status: 'unavailable'});
    }
    assert.deepEqual(requests, []);
});

test('web rejects failed, malformed, or missing country responses without returning their contents', async (t) => {
    let response;
    const {service} = web(t, {getCurrentPosition: (success) => success(position)}, async () => response);
    for (const body of [null, [], {}, {countryCode: ''}, {countryCode: 'IND'}, {countryCode: '1N'}, {countryCode: 12}]) {
        response = {ok: true, json: async () => body};
        assert.deepEqual(await service.requestCountry(), {status: 'unavailable'});
    }
    response = {ok: false, json: async () => ({countryCode: 'IN'})};
    assert.deepEqual(await service.requestCountry(), {status: 'unavailable'});
    response = {ok: true, json: async () => { throw new Error('coordinates in broken response'); }};
    assert.deepEqual(await service.requestCountry(), {status: 'unavailable'});
});

test('web stops waiting for the browser after 15 seconds and ignores its late callback', async (t) => {
    t.mock.timers.enable({apis: ['setTimeout']});
    let success;
    const {service, requests} = web(t, {getCurrentPosition: (callback) => { success = callback; }});
    const result = service.requestCountry();
    await flush();
    t.mock.timers.tick(15_000);
    assert.deepEqual(await result, {status: 'timeout'});
    success(position);
    await flush();
    assert.deepEqual(requests, []);
});

test('web geocoder timeout aborts the request, including a stalled response body', async (t) => {
    t.mock.timers.enable({apis: ['setTimeout']});
    const body = deferred();
    const {service, requests} = web(t, {getCurrentPosition: (success) => success(position)}, async () => ({ok: true, json: () => body.promise}));
    const result = service.requestCountry();
    await flush();
    assert.equal(requests.length, 1);
    t.mock.timers.tick(10_000);
    assert.deepEqual(await result, {status: 'timeout'});
    assert.equal(requests[0][1].signal.aborted, true);
    body.resolve({countryCode: 'IN'});
    await flush();
});

test('web cancellation before permission and during location prevents external requests', async (t) => {
    let success;
    let count = 0;
    const {service, requests} = web(t, {getCurrentPosition: (callback) => { count++; success = callback; }});
    const before = new AbortController();
    before.abort();
    assert.deepEqual(await service.requestCountry(before.signal), {status: 'unavailable'});
    assert.equal(count, 0);
    const controller = new AbortController();
    const result = service.requestCountry(controller.signal);
    await flush();
    controller.abort();
    assert.deepEqual(await result, {status: 'unavailable'});
    success(position);
    await flush();
    assert.deepEqual(requests, []);
});

test('web coalesces requests and aborts the geocoder only after every caller cancels', async (t) => {
    const response = deferred();
    let count = 0;
    const {service, requests} = web(t, {getCurrentPosition: (success) => { count++; success(position); }}, () => response.promise);
    const one = new AbortController();
    const two = new AbortController();
    const first = service.requestCountry(one.signal);
    const second = service.requestCountry(two.signal);
    await flush();
    assert.equal(count, 1);
    assert.equal(requests.length, 1);
    one.abort();
    assert.deepEqual(await first, {status: 'unavailable'});
    assert.equal(requests[0][1].signal.aborted, false);
    two.abort();
    assert.deepEqual(await second, {status: 'unavailable'});
    assert.equal(requests[0][1].signal.aborted, true);
    response.resolve({ok: true, json: async () => ({countryCode: 'IN'})});
    await flush();
});

test('web failures do not expose location errors or reject', async (t) => {
    let throwPosition = true;
    const {service, requests} = web(t, {getCurrentPosition: (success) => {
        if (throwPosition) throw new Error('location details');
        success(position);
    }}, () => { throw new Error('location details'); });
    assert.deepEqual(await service.requestCountry(), {status: 'unavailable'});
    assert.deepEqual(requests, []);
    throwPosition = false;
    assert.deepEqual(await service.requestCountry(), {status: 'unavailable'});
});
