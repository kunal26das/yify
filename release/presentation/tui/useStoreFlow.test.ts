import assert from 'node:assert/strict';
import {PassThrough, Writable} from 'node:stream';
import {setImmediate} from 'node:timers/promises';
import test from 'node:test';
import React from 'react';
import {render} from 'ink';
import type {ReleaseCoverage, RunStoreReleaseOptions} from '../../domain/index.js';
import {StoreConfirm} from './StoreConfirm.js';
import {type StoreFlowViewModel, useStoreFlow} from './useStoreFlow.js';

type TestContext = Parameters<NonNullable<Parameters<typeof test>[0]>>[0];

async function fixture(t: TestContext, options: {
    coverage?: () => Promise<ReleaseCoverage>;
    validationFails?: boolean;
} = {}) {
    let current: StoreFlowViewModel | undefined;
    const output: string[] = [];
    const stdout = Object.assign(new Writable({
        write(chunk, _encoding, callback) {
            output.push(String(chunk));
            callback();
        },
    }), {columns: 120, rows: 50, isTTY: false});
    const stdin = Object.assign(new PassThrough(), {
        isTTY: true,
        setRawMode() {
            return this;
        },
        ref() {
            return this;
        },
        unref() {
            return this;
        },
    });
    const calls: RunStoreReleaseOptions[] = [];
    const deps: NonNullable<Parameters<typeof useStoreFlow>[0]> = {
        validateBinaries: async () => {
            if (options.validationFails) throw new Error('Could not read package.json');
            return {ok: true, version: '1.8.1', apkPath: '', ipaPath: ''};
        },
        releaseCoverage: options.coverage ?? (async () => {
            throw new Error('expo-updates is missing');
        }),
        runStoreRelease: async (opts) => {
            calls.push(opts);
            return {ok: false, steps: []};
        },
    };

    function Probe() {
        current = useStoreFlow(deps);
        return current.step === 'confirm'
            ? React.createElement(StoreConfirm, {
                vm: current, onDone: () => {
                }
            })
            : null;
    }

    const app = render(React.createElement(Probe), {
        stdout: stdout as unknown as NodeJS.WriteStream,
        stderr: stdout as unknown as NodeJS.WriteStream,
        stdin: stdin as unknown as NodeJS.ReadStream,
        debug: true,
        patchConsole: false,
        exitOnCtrlC: false,
    });
    const exited = app.waitUntilExit();
    t.after(async () => {
        app.unmount();
        await exited;
        app.cleanup();
        stdin.destroy();
        stdout.destroy();
    });
    await setImmediate();
    const vm = () => {
        assert.ok(current);
        return current;
    };
    vm().choosePlatforms(['android']);
    await setImmediate();
    return {vm, output, calls};
}

test('TUI offers recovery when coverage cannot load without claiming a release is absent', async (t) => {
    const f = await fixture(t);
    await f.vm().submitChannels(['Production']);
    await setImmediate();
    assert.equal(f.vm().step, 'confirm');
    assert.equal(f.vm().error, '');
    assert.equal(f.vm().version, '1.8.1');
    assert.equal(f.vm().allCovered, false);
    assert.equal(f.vm().existingSummary, '');
    assert.match(f.vm().coverageWarning, /Release history is unavailable/);
    assert.match(f.output.join(''), /Release history is unavailable/);
    assert.equal(f.output.join('').includes('No release recorded for this runtime version.'), false);
    assert.deepEqual(f.calls, []);
    await f.vm().start();
    await setImmediate();
    assert.equal(f.vm().step, 'result');
    assert.equal(f.vm().ok, false);
    assert.equal(f.vm().queuedCount, 0);
    assert.deepEqual(f.calls, [{
        apkPath: '',
        ipaPath: '',
        version: '1.8.1',
        platforms: ['android'],
        channels: ['Production']
    }]);
});

test('TUI keeps known release coverage and clears a previous advisory failure on retry', async (t) => {
    let unavailable = true;
    const f = await fixture(t, {
        coverage: async () => {
            if (unavailable) throw new Error('Unavailable');
            return {have: 1, total: 1, covered: true, existing: [{platform: 'android', channel: 'Production'}]};
        }
    });
    await f.vm().submitChannels(['Production']);
    await setImmediate();
    assert.notEqual(f.vm().coverageWarning, '');
    unavailable = false;
    await f.vm().submitChannels(['Production']);
    await setImmediate();
    assert.equal(f.vm().coverageWarning, '');
    assert.equal(f.vm().allCovered, true);
    assert.equal(f.vm().existingSummary, 'Production (android)');
    assert.deepEqual(f.calls, []);
});

test('TUI exits validation with the actual input error instead of leaving an unhandled rejection', async (t) => {
    const f = await fixture(t, {
        validationFails: true,
        coverage: async () => assert.fail('Invalid inputs must not reach coverage'),
    });
    await f.vm().submitChannels(['Production']);
    await setImmediate();
    assert.equal(f.vm().step, 'confirm');
    assert.equal(f.vm().error, 'Could not read package.json');
    assert.equal(f.vm().version, '');
    assert.equal(f.vm().coverageWarning, '');
    assert.deepEqual(f.calls, []);
});
