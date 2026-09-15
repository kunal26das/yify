import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import type {InstallMode, LogLine, Workspace} from '../../domain/index.js';
import {createCancellation} from '../process/cancellationRegistry.js';
import {createInstaller} from './installerShell.js';

type TestContext = Parameters<NonNullable<Parameters<typeof test>[0]>>[0];

function fixture(t: TestContext, scenario: 'success' | 'failure' | 'cancel' = 'success', installed = true) {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yify installer '));
    const bin = path.join(repoRoot, 'bin');
    const write = (name: string, content: string) => {
        const file = path.join(repoRoot, name);
        fs.mkdirSync(path.dirname(file), {recursive: true});
        fs.writeFileSync(file, content);
    };
    const read = (name: string) => fs.readFileSync(path.join(repoRoot, name), 'utf8');
    const exists = (name: string) => fs.existsSync(path.join(repoRoot, name));
    write('package.json', '{"private":true}');
    write('yarn.lock', 'original lock\n');
    if (installed) write('node_modules/working.txt', 'previous installation');
    const childScript = `
        const fs = require('node:fs');
        console.log('installer-child-ready');
        setTimeout(() => fs.writeFileSync('escaped-write', 'unsafe'), 650);
    `;
    write('bin/yarn', `#!${process.execPath}
const fs = require('node:fs');
const {spawn} = require('node:child_process');
const scenario = ${JSON.stringify(scenario)};
fs.writeFileSync('invocation.json', JSON.stringify({
    args: process.argv.slice(2),
    hadModules: fs.existsSync('node_modules'),
    lock: fs.readFileSync('yarn.lock', 'utf8'),
}));
fs.mkdirSync('node_modules', {recursive:true});
fs.writeFileSync('node_modules/new.txt', 'replacement installation');
if (scenario !== 'success' || !process.argv.includes('--frozen-lockfile')) {
    fs.writeFileSync('yarn.lock', 'changed lock');
    fs.writeFileSync('package-lock.json', 'new lock');
}
if (scenario === 'failure') process.exit(9);
if (scenario === 'cancel') {
    spawn(process.execPath, ['-e', ${JSON.stringify(childScript)}], {stdio:'inherit'});
    setInterval(() => {}, 1000);
}
`);
    fs.chmodSync(path.join(bin, 'yarn'), 0o700);
    const originalPath = process.env.PATH;
    process.env.PATH = bin;
    const cancellation = createCancellation();
    const workspace: Workspace = {
        repoRoot,
        apps: {android: {name: 'Yify', platform: 'android'}, ios: {name: 'Yify', platform: 'ios'}},
        channels: ['Production'], channelName: (channel) => channel, currentBranch: () => 'main',
    };
    const installer = createInstaller({workspace, cancellation});
    const logs: LogLine[] = [];
    const install = (mode: InstallMode = 'frozen') => installer.cleanInstall((line) => {
        logs.push(line);
        if (line.text === 'installer-child-ready') cancellation.cancelActive();
    }, 'test release', mode);
    const noBackup = () => {
        const root = path.join(repoRoot, '.expo');
        assert.deepEqual(fs.existsSync(root) ? fs.readdirSync(root) : [], []);
    };
    t.after(() => {
        cancellation.cancelActive();
        if (originalPath === undefined) delete process.env.PATH;
        else process.env.PATH = originalPath;
        fs.rmSync(repoRoot, {recursive: true, force: true});
    });
    return {repoRoot, install, read, exists, noBackup, cancellation, logs};
}

test('successful frozen installation replaces dependencies and preserves the lockfile', async (t) => {
    const f = fixture(t);
    assert.deepEqual(await f.install(), {ok: true, code: 0});
    assert.equal(f.exists('node_modules/working.txt'), false);
    assert.equal(f.read('node_modules/new.txt'), 'replacement installation');
    assert.equal(f.read('yarn.lock'), 'original lock\n');
    assert.deepEqual(JSON.parse(f.read('invocation.json')), {
        args: ['install', '--frozen-lockfile'], hadModules: false, lock: 'original lock\n',
    });
    f.noBackup();
});

for (const mode of ['frozen', 'resolve'] as const) {
    test(`failed ${mode} installation restores working dependencies and every lockfile`, async (t) => {
        const f = fixture(t, 'failure');
        assert.deepEqual(await f.install(mode), {ok: false, code: 9});
        assert.equal(f.read('node_modules/working.txt'), 'previous installation');
        assert.equal(f.exists('node_modules/new.txt'), false);
        assert.equal(f.read('yarn.lock'), 'original lock\n');
        assert.equal(f.exists('package-lock.json'), false);
        assert.equal(f.read('package.json'), '{"private":true}');
        assert.equal(JSON.parse(f.read('invocation.json')).lock, 'original lock\n');
        f.noBackup();
    });
}

test('failed installation without previous dependencies removes the partial result', async (t) => {
    const f = fixture(t, 'failure', false);
    assert.equal((await f.install()).ok, false);
    assert.equal(f.exists('node_modules'), false);
    assert.equal(f.read('yarn.lock'), 'original lock\n');
    f.noBackup();
});

test('missing package manager restores dependencies after spawn failure', async (t) => {
    const f = fixture(t);
    fs.unlinkSync(path.join(f.repoRoot, 'bin/yarn'));
    assert.equal((await f.install()).ok, false);
    assert.equal(f.read('node_modules/working.txt'), 'previous installation');
    assert.equal(f.read('yarn.lock'), 'original lock\n');
    assert.ok(f.logs.some((line) => line.text.includes('Could not start dependency installation')));
    f.noBackup();
});

test('cancellation before installation leaves dependencies untouched', async (t) => {
    const f = fixture(t);
    f.cancellation.cancelActive();
    assert.deepEqual(await f.install(), {ok: false, code: 130});
    assert.equal(f.read('node_modules/working.txt'), 'previous installation');
    assert.equal(f.exists('invocation.json'), false);
    f.noBackup();
});

test('cancellation stops installer descendants before restoring dependencies', {
    skip: process.platform === 'win32', timeout: 5000,
}, async (t) => {
    const f = fixture(t, 'cancel');
    assert.deepEqual(await f.install(), {ok: false, code: 130});
    assert.equal(f.read('node_modules/working.txt'), 'previous installation');
    assert.equal(f.read('yarn.lock'), 'original lock\n');
    await delay(850);
    assert.equal(f.exists('escaped-write'), false);
    assert.equal(f.exists('node_modules/new.txt'), false);
    f.noBackup();
});
