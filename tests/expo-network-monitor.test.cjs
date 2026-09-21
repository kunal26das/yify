const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const settled = () => new Promise(resolve => setImmediate(resolve));
const state = online => ({isConnected: online, isInternetReachable: online});

function fixture(read) {
    let foreground;
    let notify;
    let reads = 0;
    const {ExpoNetworkMonitor} = loadTypeScript('data/services/ExpoNetworkMonitor.ts', {
        'expo-network': {
            getNetworkStateAsync: () => { reads++; return read(); },
            addNetworkStateListener: listener => { notify = listener; },
        },
        '../datasources/platform/ForegroundWatcher': {watchForeground: listener => { foreground = listener; }},
    });
    const monitor = new ExpoNetworkMonitor();
    return {monitor, foreground: () => foreground(), notify: value => notify(state(value)), reads: () => reads};
}

test('foreground refresh recovers a stale native event snapshot and notifies subscribers', async () => {
    let online = false;
    const f = fixture(async () => state(online));
    await settled();
    assert.equal(f.monitor.isOnline(), false);
    const observed = [];
    f.monitor.subscribe(() => observed.push(f.monitor.isOnline()));
    online = true; // Android withheld the reconnect callback while the process was frozen.
    f.foreground();
    await settled();
    assert.equal(f.monitor.isOnline(), true);
    assert.deepEqual(observed, [true]);
});

test('concurrent callers share a read and a racing callback triggers one corrective snapshot', async () => {
    let resolve;
    const f = fixture(() => new Promise(done => { resolve = done; }));
    await settled();
    const first = f.monitor.refresh();
    const second = f.monitor.refresh();
    assert.equal(first, second);
    assert.equal(f.reads(), 1);
    f.notify(false);
    resolve(state(true));
    await settled();
    // The first snapshot cannot override a callback that arrived after that read began.
    assert.equal(f.monitor.isOnline(), false);
    assert.equal(f.reads(), 2);
    // A fresh read also repairs a deferred stale onLost callback after Android resumes.
    resolve(state(true));
    assert.equal(await first, true);
    assert.equal(f.monitor.isOnline(), true);
});

test('snapshot failures keep the last known state instead of inventing connectivity', async () => {
    const f = fixture(async () => { throw new Error('Native snapshot unavailable'); });
    f.notify(false);
    await settled();
    assert.equal(await f.monitor.refresh(), false);
    assert.equal(f.monitor.isOnline(), false);
});

test('a hung native snapshot is bounded and its late result cannot overwrite the recovered state', async t => {
    t.mock.timers.enable({apis: ['setTimeout']});
    let resolve;
    const f = fixture(() => new Promise(done => { resolve = done; }));
    await settled();
    const pending = f.monitor.refresh();
    const late = resolve;
    t.mock.timers.tick(3000);
    assert.equal(await pending, true);
    const recovery = f.monitor.refresh();
    await settled();
    resolve(state(false));
    assert.equal(await recovery, false);
    late(state(true));
    await settled();
    assert.equal(f.monitor.isOnline(), false);
    assert.equal(f.reads(), 2);
});
