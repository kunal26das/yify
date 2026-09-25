const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {UpdatesLogEntryCode} = loadTypeScript('node_modules/expo-updates/src/Updates.types.ts');
const phases = {
    UpdateAssetsNotAvailable: 'asset', UpdateServerUnreachable: 'update', UpdateHasInvalidSignature: 'signature',
    UpdateCodeSigningError: 'signature', UpdateFailedToLoad: 'update', AssetsFailedToLoad: 'asset',
    JSRuntimeError: 'runtime', InitializationError: 'initialization', Unknown: 'unknown',
};
const entry = (timestamp, code = 'AssetsFailedToLoad', level = 'error') => ({timestamp, code, level});
const load = readLogEntriesAsync => loadTypeScript('data/services/ExpoUpdateFailureDetails.ts', {
    'expo-updates': {readLogEntriesAsync},
}).readExpoUpdateFailureDetails;

test('only installed SDK failure codes become bounded categories without guessing transport or storage causes', async () => {
    for (const code of Object.values(UpdatesLogEntryCode)) {
        const read = load(async maxAge => {
            assert.equal(maxAge, 60000);
            return [entry(1500, code)];
        });
        assert.deepEqual(await read(1000, 2000), phases[code] ? {
            updates_log_status: 'captured', updates_log_code: code, updates_phase: phases[code],
        } : {updates_log_status: 'empty'});
    }
    assert.deepEqual(Object.keys(phases).filter(code => !Object.values(UpdatesLogEntryCode).includes(code)), []);
});

test('operation timestamps exclude earlier checks, startup, future logs and old records from long-running operations', async () => {
    const read = load(async () => [
        entry(500), entry(999, 'UpdateHasInvalidSignature'), entry(1200, 'AssetsFailedToLoad'),
        entry(2001, 'InitializationError'), entry(NaN), entry(Infinity), entry('1500'),
    ]);
    assert.deepEqual(await read(1000, 2000), {
        updates_log_status: 'captured', updates_log_code: 'AssetsFailedToLoad', updates_phase: 'asset',
    });
    assert.deepEqual(await load(async () => [entry(139999)])(0, 200000), {updates_log_status: 'empty'});
    assert.deepEqual(await load(async () => [entry(140000)])(0, 200000), {
        updates_log_status: 'captured', updates_log_code: 'AssetsFailedToLoad', updates_phase: 'asset',
    });
    let calls = 0;
    const invalid = load(async () => {calls++; return [];});
    for (const times of [[2000, 1000], [NaN, 2000], [1000, Infinity]]) {
        assert.deepEqual(await invalid(...times), {updates_log_status: 'invalid'});
    }
    assert.equal(calls, 0);
});

test('latest meaningful error wins despite unordered timestamps or generic wrapper codes', async () => {
    const read = load(async () => [
        entry(1900, 'AssetsFailedToLoad'), entry(1800, 'UpdateFailedToLoad'), entry(2000, 'None'),
        entry(1950, 'Unknown'), entry(1999, 'UpdateFailedToLoad'), entry(2000, 'UpdateCodeSigningError', 'info'),
        entry(2000, 'UpdateCodeSigningError', 'warn'), entry(2000, 'UnexpectedPrivateCode'),
    ]);
    assert.deepEqual(await read(1000, 2000), {
        updates_log_status: 'captured', updates_log_code: 'AssetsFailedToLoad', updates_phase: 'asset',
    });
    assert.deepEqual(await load(async () => [entry(1200, 'Unknown'), entry(1100, 'UpdateFailedToLoad', 'fatal')])(1000, 2000), {
        updates_log_status: 'captured', updates_log_code: 'UpdateFailedToLoad', updates_phase: 'update',
    });
});

test('inspects at most the last50 entries and never accesses raw payload fields', async () => {
    let forbiddenReads = 0;
    const forbid = () => {forbiddenReads++; throw new Error('Private payload');};
    const record = entry(1500);
    for (const key of ['message', 'assetId', 'updateId', 'stacktrace', 'authorization', 'headers']) {
        Object.defineProperty(record, key, {get: forbid});
    }
    const entries = Array.from({length: 100}, () => record);
    for (let index = 0; index < 50; index++) Object.defineProperty(entries, index, {get: forbid});
    assert.deepEqual(await load(async () => entries)(1000, 2000), {
        updates_log_status: 'captured', updates_log_code: 'AssetsFailedToLoad', updates_phase: 'asset',
    });
    assert.equal(forbiddenReads, 0);
});

test('malformed data, absent APIs and native log read failures cannot replace the original update failure', async () => {
    assert.deepEqual(await load(undefined)(1000, 2000), {updates_log_status: 'unavailable'});
    for (const payload of [undefined, null, {}, 'private']) {
        assert.deepEqual(await load(async () => payload)(1000, 2000), {updates_log_status: 'invalid'});
    }
    for (const read of [() => {throw new Error('Private native message');}, async () => {throw new Error('Private native message');}]) {
        assert.deepEqual(await load(read)(1000, 2000), {updates_log_status: 'error'});
    }
    const hostile = Object.defineProperty({}, 'timestamp', {get() {throw new Error('Private');}});
    assert.deepEqual(await load(async () => [null, hostile, {}, entry(1500, 'constructor'), entry(1500, '__proto__')])(1000, 2000),
        {updates_log_status: 'empty'});
});

test('native log reads have a250ms deadline and late fulfillment or rejection has no effect', async t => {
    t.mock.timers.enable({apis: ['setTimeout']});
    for (const rejectLate of [false, true]) {
        let resolve;
        let reject;
        const pending = new Promise((yes, no) => {resolve = yes; reject = no;});
        let completed = false;
        const result = load(() => pending)(1000, 2000).then(value => {completed = true; return value;});
        await Promise.resolve();
        t.mock.timers.tick(249);
        await Promise.resolve();
        assert.equal(completed, false);
        t.mock.timers.tick(1);
        assert.deepEqual(await result, {updates_log_status: 'timeout'});
        if (rejectLate) reject(new Error('Late private native failure'));
        else resolve([entry(1500)]);
        await new Promise(done => setImmediate(done));
        assert.deepEqual(await result, {updates_log_status: 'timeout'});
    }
});
