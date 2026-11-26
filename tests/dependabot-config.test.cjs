const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { load } = require('js-yaml');

const root = join(__dirname, '..');
const config = load(readFileSync(join(root, '.github/dependabot.yml'), 'utf8'));
const app = config.updates.find((entry) => entry['package-ecosystem'] === 'npm' && entry.directory === '/');
const release = config.updates.find((entry) => entry['package-ecosystem'] === 'npm' && entry.directory === '/release');
const matches = (pattern, name) => new RegExp(`^${pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(name);

function groupFor(entry, name, update, kind = 'version-updates') {
  return Object.entries(entry.groups).find(([, group]) =>
    (group['applies-to'] ?? 'version-updates') === kind &&
    (!group['update-types'] || group['update-types'].includes(update)) &&
    group.patterns.some((pattern) => matches(pattern, name)) &&
    !(group['exclude-patterns'] ?? []).some((pattern) => matches(pattern, name)))?.[0];
}

test('Dependabot checks every installed workspace and Actions monthly without suppressing updates', () => {
  assert.deepEqual(config.updates.map((entry) => `${entry['package-ecosystem']}:${entry.directory}`).sort(),
    ['github-actions:/', 'npm:/', 'npm:/release']);
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.ok(pkg.workspaces.includes('crashreporting'));
  assert.ok(pkg.workspaces.includes('tooling'));
  for (const entry of config.updates) {
    assert.equal(entry.schedule.interval, 'monthly');
    assert.equal(entry.schedule.timezone, 'Asia/Kolkata');
    assert.ok(entry['open-pull-requests-limit'] >= 10);
    assert.equal(entry.ignore, undefined);
    assert.equal(entry.allow, undefined);
    assert.equal(entry['target-branch'], undefined);
    assert.equal(entry['exclude-paths'], undefined);
    if (entry['package-ecosystem'] === 'npm') assert.equal(entry['versioning-strategy'], 'increase');
  }
});

test('coupled dependencies stay together for patch, minor and major proposals', () => {
  const families = [
    ['expo', 'expo-router', 'expo-build-properties', '@expo/metro-runtime', 'eslint-config-expo', 'react-native', '@react-native/metro-config', '@react-native/js-polyfills'],
    ['react', 'react-dom', 'react-test-renderer', '@types/react'],
    ['@react-native-firebase/app', '@react-native-firebase/auth', '@react-native-firebase/crashlytics', 'firebase'],
    ['react-native-reanimated', 'react-native-worklets'],
  ];
  for (const names of families) {
    for (const level of ['patch', 'minor', 'major']) {
      const groups = names.map((name) => groupFor(app, name, level));
      assert.ok(groups[0], `${names[0]} ${level} needs a coordinated group`);
      assert.equal(new Set(groups).size, 1, `${names.join(', ')} must update together`);
      assert.notEqual(groups[0], 'everything-else');
    }
  }
  assert.notEqual(groupFor(app, 'expo-in-app-updates', 'major'), groupFor(app, 'expo', 'major'));
  assert.notEqual(groupFor(app, 'expo-device-corner-radius', 'major'), groupFor(app, 'expo', 'major'));
});

test('reviewed compatibility exceptions cannot block the unrelated patch group', () => {
  const policy = JSON.parse(readFileSync(join(root, 'scripts/expo-dependency-policy.json'), 'utf8'));
  assert.ok(Object.keys(policy.packages).length > 0);
  for (const name of Object.keys(policy.packages)) {
    assert.notEqual(groupFor(app, name, 'patch'), 'everything-else', name);
  }
  assert.equal(groupFor(app, 'jose', 'patch'), 'everything-else');
  assert.equal(groupFor(app, 'jose', 'minor'), 'everything-else');
  assert.equal(groupFor(app, 'jose', 'major'), undefined);
  for (const level of ['patch', 'minor', 'major']) {
    assert.ok(groupFor(release, 'react', level), `release react ${level} needs a group`);
    assert.equal(groupFor(release, 'react', level), groupFor(release, 'ink', level));
  }
});

test('every application dependency takes its intended group for major updates', () => {
  const intended = new Map([
    ['expo-sdk', ['@expo/log-box', '@expo/metro-runtime', '@expo/ui', '@expo/vector-icons', '@react-native/js-polyfills',
      '@react-native/metro-config', '@types/react', 'eslint-config-expo', 'expo', 'expo-background-task', 'expo-blur',
      'expo-build-properties', 'expo-constants', 'expo-dev-client', 'expo-font', 'expo-glass-effect', 'expo-haptics',
      'expo-image', 'expo-insights', 'expo-keep-awake', 'expo-linking', 'expo-localization', 'expo-location',
      'expo-navigation-bar', 'expo-network', 'expo-notifications', 'expo-router', 'expo-splash-screen', 'expo-sqlite',
      'expo-status-bar', 'expo-store-review', 'expo-symbols', 'expo-system-ui', 'expo-task-manager', 'expo-updates',
      'expo-web-browser', 'react', 'react-dom', 'react-native', 'react-native-gesture-handler', 'react-native-reanimated',
      'react-native-safe-area-context', 'react-native-screens', 'react-native-web', 'react-native-webview',
      'react-native-worklets', 'react-test-renderer']],
    ['native-sdks', ['@gorhom/bottom-sheet', '@react-native-firebase/analytics', '@react-native-firebase/app',
      '@react-native-firebase/auth', '@react-native-firebase/crashlytics', '@react-native-firebase/remote-config',
      '@react-native-google-signin/google-signin', '@revenuecat/purchases-js', '@sentry/react-native',
      'expo-device-corner-radius', 'expo-in-app-updates', 'firebase', 'react-native-google-mobile-ads',
      'react-native-purchases', 'react-native-web-webview', 'react-native-youtube-iframe']],
    ['tooling', ['@babel/core', '@babel/plugin-transform-dynamic-import', '@babel/plugin-transform-modules-commonjs',
      '@babel/preset-react', '@babel/preset-typescript', '@eslint/compat', 'electron', 'electron-builder', 'eslint',
      'eslint-import-resolver-typescript', 'expo-doctor', 'typescript']],
    [undefined, ['@expo-google-fonts/hanken-grotesk', '@expo-google-fonts/lora', '@xmldom/xmldom', '@yify/crashreporting',
      'error-stack-parser', 'jose']],
  ]);
  const expected = new Map([...intended].flatMap(([group, names]) => names.map((name) => [name, group])));
  assert.equal(expected.size, [...intended.values()].flat().length, 'each dependency needs exactly one intended group');
  const manifests = ['package.json', 'crashreporting/package.json', 'tooling/package.json']
    .map((file) => JSON.parse(readFileSync(join(root, file), 'utf8')));
  const installed = [...new Set(manifests.flatMap((manifest) =>
    Object.entries({ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.optionalDependencies })
      .filter(([, version]) => !version.startsWith('npm:'))
      .map(([name]) => name)))].sort();
  assert.deepEqual(installed, [...expected.keys()].sort());
  for (const name of installed) assert.equal(groupFor(app, name, 'major'), expected.get(name), name);
});

test('security groups cover every ecosystem independently of normal update levels', () => {
  for (const entry of config.updates) {
    for (const level of ['patch', 'minor', 'major']) {
      assert.ok(groupFor(entry, 'future-dependency', level, 'security-updates'));
    }
  }
});

test('Hosting takes its EAS CLI from the Dependabot-managed release lockfile', () => {
  const workflow = load(readFileSync(join(root, '.github/workflows/deploy-hosting.yml'), 'utf8'));
  const steps = workflow.jobs.deploy.steps;
  assert.ok(steps.some((step) => step['working-directory'] === 'release' && /yarn install.*--frozen-lockfile/.test(step.run)));
  assert.ok(!steps.some((step) => /npm install.*eas-cli@/.test(step.run ?? '')));
  assert.ok(steps.some((step) => /bash scripts\/eas\.sh deploy/.test(step.run ?? '')));
});

test('root clean reinstall removes installed files from every app workspace before resolving', async t => {
  const {mkdir, mkdtemp, readFile, rm, writeFile} = require('node:fs/promises');
  const {tmpdir} = require('node:os');
  const {spawnSync} = require('node:child_process');
  const directory = await mkdtemp(join(tmpdir(), 'yify-dependency-cleanup-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  for (const name of ['node_modules', 'crashreporting/node_modules', 'tooling/node_modules', 'release/node_modules', 'bin']) {
    await mkdir(join(directory, name), {recursive: true});
    await writeFile(join(directory, name, 'stale'), 'previous installation');
  }
  await writeFile(join(directory, 'yarn.lock'), 'original lockfile');
  await writeFile(join(directory, 'bin/node'), '#!/bin/sh\nexit 0\n', {mode: 0o755});
  await writeFile(join(directory, 'bin/yarn'), '#!/bin/sh\nset -eu\nfor file in node_modules crashreporting/node_modules tooling/node_modules yarn.lock; do test ! -e "$file"; done\nprintf fresh > yarn.lock\n', {mode: 0o755});
  const workflow = load(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8'));
  const reinstall = Object.values(workflow.jobs).flatMap(job => job.steps ?? []).find(step => step.name === 'Reinstall dependencies from scratch');
  const result = spawnSync('/bin/bash', ['-e', '-c', reinstall.run], {
    cwd: directory,
    env: {...process.env, DEPENDENCY_SCOPE: 'root', RUNNER_TEMP: join(directory, 'runner'), PATH: `${join(directory, 'bin')}:/usr/bin:/bin`},
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(join(directory, 'yarn.lock'), 'utf8'), 'fresh');
  assert.equal(await readFile(join(directory, 'runner/dependabot-clean-install/original-yarn.lock'), 'utf8'), 'original lockfile');
  assert.equal(await readFile(join(directory, 'release/node_modules/stale'), 'utf8'), 'previous installation');
});
