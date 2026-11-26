import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {checkOtaCompat, describe, NATIVE_PACKAGE_SECTIONS, releaseTag} from '../../scripts/check-ota-compat.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const gitEnv = {
    ...process.env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
};
const PACKAGE = {
    name: 'fixture',
    version: '2.0.0',
    versionCode: 116,
    private: true,
    workspaces: ['tooling'],
    scripts: {test: 'node --test'},
    dependencies: {expo: '58.1.0', 'react-native': '0.88.1'},
    devDependencies: {typescript: '7.0.2'},
    resolutions: {'expo-modules-core': '58.2.0'},
    expo: {install: {exclude: ['typescript']}, autolinking: {android: {buildFromSource: ['.*']}}},
};

function git(cwd, ...args) {
    return execFileSync('git', args, {cwd, encoding: 'utf8', env: gitEnv});
}

function write(cwd, file, contents) {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), {recursive: true});
    fs.writeFileSync(path.join(cwd, file), contents);
}

function writePackage(cwd, pkg) {
    write(cwd, 'package.json', `${JSON.stringify(pkg, null, 2)}\n`);
}

function commit(cwd, message) {
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-q', '-m', message);
}

function fixture(t, {tag = true} = {}) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'yify-ota-'));
    t.after(() => fs.rmSync(cwd, {recursive: true, force: true}));
    git(cwd, 'init', '-q', '-b', 'main');
    writePackage(cwd, PACKAGE);
    write(cwd, 'yarn.lock', 'expo@58.1.0:\n  version "58.1.0"\n');
    write(cwd, 'app.json', '{"expo": {"slug": "fixture"}}\n');
    write(cwd, 'app.config.js', 'module.exports = require(\'./app.json\');\n');
    write(cwd, 'plugins/withFixture.js', 'module.exports = (config) => config;\n');
    write(cwd, 'patches/expo-native/manifest.json', '{"files": []}\n');
    write(cwd, 'src/screen.ts', 'export const title = 1;\n');
    write(cwd, 'android/app/build.gradle', 'android {}\n');
    write(cwd, '.gitignore', 'android/app/build/\nnode_modules/\n');
    commit(cwd, 'Release 2.0.0');
    if (tag) git(cwd, 'tag', releaseTag('2.0.0'));
    return cwd;
}

test('a missing release tag refuses and names the tagging command', (t) => {
    const cwd = fixture(t, {tag: false});
    const result = checkOtaCompat({cwd});
    assert.equal(result.ok, false);
    assert.equal(result.missingTag, true);
    assert.equal(result.tag, 'android-v2.0.0');
    assert.match(describe(result), /git tag android-v2\.0\.0 <sha> && git push origin android-v2\.0\.0/);
});

test('an unchanged tree and JavaScript-only commits are compatible', (t) => {
    const cwd = fixture(t);
    assert.deepEqual(checkOtaCompat({cwd}), {ok: true, version: '2.0.0', tag: 'android-v2.0.0', differences: [], missingTag: false});
    write(cwd, 'src/screen.ts', 'export const title = 2;\n');
    writePackage(cwd, {...PACKAGE, scripts: {test: 'node --test --watch'}, versionCode: 117});
    commit(cwd, 'JavaScript only');
    assert.equal(checkOtaCompat({cwd}).ok, true);
});

test('every native input path blocks an update and is listed', (t) => {
    const edits = [
        ['yarn.lock', 'expo@58.1.1:\n  version "58.1.1"\n'],
        ['app.json', '{"expo": {"slug": "fixture", "scheme": "x"}}\n'],
        ['app.config.js', 'module.exports = {...require(\'./app.json\')};\n'],
        ['plugins/withFixture.js', 'module.exports = (config) => ({...config});\n'],
        ['plugins/withNew.js', 'module.exports = (config) => config;\n'],
        ['patches/expo-native/manifest.json', '{"files": [{"package": "x"}]}\n'],
        ['android/app/build.gradle', 'android { compileSdk 37 }\n'],
    ];
    for (const [file, contents] of edits) {
        const cwd = fixture(t);
        write(cwd, file, contents);
        commit(cwd, `Change ${file}`);
        const result = checkOtaCompat({cwd});
        assert.equal(result.ok, false, file);
        assert.deepEqual(result.differences, [file]);
        assert.match(describe(result), new RegExp(`native inputs changed since android-v2\\.0\\.0\\.\\n  ${file.replaceAll('.', '\\.')}`));
    }
});

test('package.json native sections block an update while key order and other fields do not', (t) => {
    const changes = {
        dependencies: {...PACKAGE.dependencies, 'expo-image': '58.0.19'},
        devDependencies: {typescript: '7.0.3'},
        resolutions: {'expo-modules-core': '58.2.1'},
        workspaces: ['tooling', 'other'],
        expo: {...PACKAGE.expo, install: {exclude: []}},
    };
    assert.deepEqual(Object.keys(changes), NATIVE_PACKAGE_SECTIONS);
    for (const [section, value] of Object.entries(changes)) {
        const cwd = fixture(t);
        writePackage(cwd, {...PACKAGE, [section]: value});
        commit(cwd, `Change ${section}`);
        assert.deepEqual(checkOtaCompat({cwd}).differences, [`package.json ${section}`]);
    }
    const cwd = fixture(t);
    writePackage(cwd, {...PACKAGE, dependencies: {'react-native': '0.88.1', expo: '58.1.0'}});
    commit(cwd, 'Reorder');
    assert.equal(checkOtaCompat({cwd}).ok, true);
});

test('uncommitted and untracked native files count, ignored build output does not', (t) => {
    const cwd = fixture(t);
    write(cwd, 'android/app/build/generated.txt', 'ignored\n');
    assert.equal(checkOtaCompat({cwd}).ok, true);
    write(cwd, 'app.json', '{"expo": {"slug": "changed"}}\n');
    write(cwd, 'plugins/withUntracked.js', 'module.exports = (config) => config;\n');
    assert.deepEqual(checkOtaCompat({cwd}).differences, ['app.json', 'plugins/withUntracked.js']);
});

test('android/ counts only while it is tracked', (t) => {
    const cwd = fixture(t);
    git(cwd, 'rm', '-r', '-q', '--cached', 'android');
    write(cwd, '.gitignore', '/android\nnode_modules/\n');
    commit(cwd, 'Continuous native generation');
    git(cwd, 'tag', '-f', releaseTag('2.0.0'));
    write(cwd, 'android/app/build.gradle', 'android { compileSdk 99 }\n');
    assert.equal(checkOtaCompat({cwd}).ok, true);
});

test('a version bump needs its own release tag', (t) => {
    const cwd = fixture(t);
    writePackage(cwd, {...PACKAGE, version: '2.0.1', versionCode: 117});
    commit(cwd, 'Bump');
    const result = checkOtaCompat({cwd});
    assert.equal(result.missingTag, true);
    assert.equal(result.tag, 'android-v2.0.1');
});

function wrapper(t, cwd) {
    write(cwd, 'scripts/eas.sh', fs.readFileSync(path.join(repository, 'scripts/eas.sh'), 'utf8'));
    write(cwd, 'scripts/check-ota-compat.mjs', fs.readFileSync(path.join(repository, 'scripts/check-ota-compat.mjs'), 'utf8'));
    write(cwd, 'scripts/check-live-privacy.mjs', [
        `export {requiresLivePrivacyCheck} from ${JSON.stringify(path.join(repository, 'scripts/check-live-privacy.mjs'))};`,
        'import fs from \'node:fs\';',
        'export async function checkLivePrivacy() {',
        '  fs.appendFileSync(process.env.PRIVACY_LOG, \'checked\\n\');',
        '  if (process.env.PRIVACY_FAILS) throw new Error(\'Live privacy check failed\');',
        '}',
        '',
    ].join('\n'));
    commit(cwd, 'Wrapper');
    git(cwd, 'tag', '-f', releaseTag('2.0.0'));
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'yify-ota-bin-'));
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'yify-ota-home-'));
    t.after(() => {
        fs.rmSync(bin, {recursive: true, force: true});
        fs.rmSync(home, {recursive: true, force: true});
    });
    write(bin, 'npx', '#!/bin/sh\nprintf \'%s\\n\' "$@" > "$NPX_LOG"\n');
    fs.chmodSync(path.join(bin, 'npx'), 0o755);
    const npxLog = path.join(bin, 'npx.log');
    const privacyLog = path.join(bin, 'privacy.log');
    return (args, extra = {}) => {
        fs.rmSync(npxLog, {force: true});
        fs.rmSync(privacyLog, {force: true});
        const env = {...gitEnv, HOME: home, PATH: `${bin}${path.delimiter}${process.env.PATH}`, NPX_LOG: npxLog, PRIVACY_LOG: privacyLog, ...extra};
        delete env.EXPO_TOKEN;
        const run = spawnSync('bash', ['scripts/eas.sh', ...args], {cwd, env, encoding: 'utf8'});
        return {
            status: run.status,
            stderr: run.stderr,
            npx: fs.existsSync(npxLog) ? fs.readFileSync(npxLog, 'utf8').trim().split('\n') : null,
            privacy: fs.existsSync(privacyLog),
        };
    };
}

test('eas.sh runs the OTA guard before update and never reaches eas-cli when it fails', (t) => {
    const cwd = fixture(t);
    const eas = wrapper(t, cwd);
    const clean = eas(['update', '--channel', 'Production', '--platform', 'android']);
    assert.equal(clean.status, 0, clean.stderr);
    assert.deepEqual(clean.npx, ['--yes', 'eas-cli@27.11.0', 'update', '--channel', 'Production', '--platform', 'android']);
    write(cwd, 'plugins/withFixture.js', 'module.exports = (config) => ({...config, changed: true});\n');
    const blocked = eas(['update', '--channel', 'Production']);
    assert.notEqual(blocked.status, 0);
    assert.equal(blocked.npx, null);
    assert.match(blocked.stderr, /Refusing to publish an update for runtime 2\.0\.0[\s\S]*plugins\/withFixture\.js/);
    const help = eas(['update', '--help']);
    assert.equal(help.status, 0, help.stderr);
    assert.deepEqual(help.npx.slice(2), ['update', '--help']);
    const build = eas(['build', '--platform', 'android', '--profile', 'preview']);
    assert.equal(build.status, 0, build.stderr);
    assert.equal(build.privacy, false);
});

test('eas.sh runs the live privacy preflight before production builds and Play submissions', (t) => {
    const cwd = fixture(t);
    const eas = wrapper(t, cwd);
    for (const args of [['build', '--platform', 'android', '--profile', 'production'], ['submit', '--platform', 'android', '--profile', 'play-production', '--id', 'build-id']]) {
        const passed = eas(args);
        assert.equal(passed.status, 0, passed.stderr);
        assert.equal(passed.privacy, true);
        assert.deepEqual(passed.npx.slice(2), args);
        const failed = eas(args, {PRIVACY_FAILS: '1'});
        assert.notEqual(failed.status, 0);
        assert.equal(failed.npx, null);
        assert.match(failed.stderr, /Live privacy check failed/);
    }
    const development = eas(['build', '--platform', 'android', '--profile', 'development']);
    assert.equal(development.privacy, false);
    assert.equal(development.status, 0, development.stderr);
});

test('the repository wrapper keeps the token lookup and the pinned eas-cli', () => {
    const script = fs.readFileSync(path.join(repository, 'scripts/eas.sh'), 'utf8');
    assert.match(script, /^#!\/usr\/bin\/env bash\nset -euo pipefail\n/);
    assert.match(script, /\$HOME\/\.yify-release\.json/);
    assert.match(script, /node scripts\/check-ota-compat\.mjs/);
    assert.match(script, /exec npx --yes eas-cli@27\.11\.0 "\$@"\n$/);
    const pkg = JSON.parse(fs.readFileSync(path.join(repository, 'package.json'), 'utf8'));
    assert.equal(pkg.scripts['update:android'].startsWith('bash scripts/eas.sh update '), true);
});
