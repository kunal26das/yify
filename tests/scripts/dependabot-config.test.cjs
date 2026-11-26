const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readdirSync, readFileSync} = require('node:fs');
const {join} = require('node:path');
const {load} = require('js-yaml');

const root = join(__dirname, '../..');
const config = load(readFileSync(join(root, '.github/dependabot.yml'), 'utf8'));
const app = config.updates.find((entry) => entry['package-ecosystem'] === 'npm' && entry.directory === '/');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const LEVELS = ['patch', 'minor', 'major'];

const matches = (pattern, name) => new RegExp(`^${pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(name);

function groupFor(entry, name, update, kind = 'version-updates') {
  return Object.entries(entry.groups).find(([, group]) =>
    (group['applies-to'] ?? 'version-updates') === kind &&
    (!group['update-types'] || group['update-types'].includes(update)) &&
    group.patterns.some((pattern) => matches(pattern, name)) &&
    !(group['exclude-patterns'] ?? []).some((pattern) => matches(pattern, name)))?.[0];
}

function registryDependencies() {
  const manifests = ['package.json', 'tooling/package.json'].map((file) => JSON.parse(readFileSync(join(root, file), 'utf8')));
  return [...new Set(manifests.flatMap((manifest) =>
    Object.entries({...manifest.dependencies, ...manifest.devDependencies, ...manifest.optionalDependencies})
      .filter(([, version]) => !version.startsWith('npm:'))
      .map(([name]) => name)))].sort();
}

const INTENDED = new Map([
  ['expo-sdk', ['@expo/metro-runtime', '@expo/vector-icons', '@react-native/metro-config', '@types/react', 'eslint-config-expo',
    'expo', 'expo-build-properties', 'expo-constants', 'expo-dev-client', 'expo-font', 'expo-haptics', 'expo-image',
    'expo-keep-awake', 'expo-linking', 'expo-localization', 'expo-navigation-bar', 'expo-network', 'expo-router',
    'expo-splash-screen', 'expo-sqlite', 'expo-status-bar', 'expo-system-ui', 'expo-updates', 'expo-web-browser', 'react',
    'react-dom', 'react-native', 'react-native-gesture-handler', 'react-native-reanimated', 'react-native-safe-area-context',
    'react-native-screens', 'react-native-web', 'react-native-webview', 'react-native-worklets', 'react-test-renderer']],
  ['firebase-native', ['@react-native-firebase/analytics', '@react-native-firebase/app', '@react-native-firebase/auth', 'firebase']],
  ['native-sdks', ['@react-native-google-signin/google-signin', '@revenuecat/purchases-js', '@sentry/browser',
    '@sentry/react-native', 'expo-in-app-updates', 'react-native-google-mobile-ads', 'react-native-purchases',
    'react-native-youtube-iframe']],
  ['tooling', ['@babel/core', '@babel/plugin-transform-dynamic-import', '@babel/plugin-transform-modules-commonjs',
    '@babel/preset-react', '@babel/preset-typescript', '@eslint/compat', 'eslint', 'eslint-import-resolver-typescript',
    'subset-font', 'typescript']],
  [undefined, ['@expo-google-fonts/archivo', '@tanstack/react-query']],
]);

test('Dependabot checks the root workspace and Actions monthly without suppressing updates', () => {
  assert.deepEqual(config.updates.map((entry) => `${entry['package-ecosystem']}:${entry.directory}`).sort(),
    ['github-actions:/', 'npm:/']);
  assert.deepEqual(pkg.workspaces, ['tooling']);
  for (const entry of config.updates) {
    assert.equal(entry.schedule.interval, 'monthly');
    assert.equal(entry.schedule.timezone, 'Asia/Kolkata');
    assert.ok(entry['open-pull-requests-limit'] >= 10);
    assert.equal(entry.ignore, undefined);
    assert.equal(entry.allow, undefined);
    assert.equal(entry['target-branch'], undefined);
    assert.equal(entry['exclude-paths'], undefined);
    if (entry['package-ecosystem'] === 'npm') assert.equal(entry['versioning-strategy'], 'increase');
    assert.deepEqual(entry.cooldown, {'default-days': 3});
    for (const [name, group] of Object.entries(entry.groups)) {
      assert.equal(group['dependency-type'], undefined, `${name} must not filter by dependency type`);
    }
  }
});

test('group order and pattern specificity agree, so the first matching group is the one Dependabot picks', () => {
  for (const entry of config.updates) {
    const groups = Object.entries(entry.groups);
    const seen = new Map();
    groups.forEach(([name, group], index) => {
      const kind = group['applies-to'] ?? 'version-updates';
      const types = group['update-types'] ?? LEVELS;
      for (const pattern of group.patterns.filter((item) => !item.includes('*'))) {
        const key = `${kind}:${pattern}`;
        assert.equal(seen.get(key), undefined, `${pattern} is listed in ${seen.get(key)} and ${name}`);
        seen.set(key, name);
        for (const [earlierName, earlier] of groups.slice(0, index)) {
          if ((earlier['applies-to'] ?? 'version-updates') !== kind) continue;
          const earlierTypes = earlier['update-types'] ?? LEVELS;
          if (!types.some((type) => earlierTypes.includes(type))) continue;
          const shadowing = earlier.patterns.filter((item) => item.includes('*') && matches(item, pattern));
          assert.deepEqual(shadowing, [], `${pattern} in ${name} is shadowed by ${earlierName}`);
        }
      }
    });
  }
});

test('firebase-native precedes native-sdks and coupled dependencies stay together at every update level', () => {
  const order = Object.keys(app.groups);
  assert.ok(order.indexOf('firebase-native') >= 0 && order.indexOf('firebase-native') < order.indexOf('native-sdks'));
  const families = [
    ['expo', 'expo-router', 'expo-build-properties', '@expo/metro-runtime', 'eslint-config-expo', 'react-native', '@react-native/metro-config'],
    ['react', 'react-dom', 'react-test-renderer', '@types/react'],
    ['@react-native-firebase/app', '@react-native-firebase/auth', '@react-native-firebase/analytics', 'firebase'],
    ['react-native-reanimated', 'react-native-worklets'],
  ];
  for (const names of families) {
    for (const level of LEVELS) {
      const groups = names.map((name) => groupFor(app, name, level));
      assert.ok(groups[0], `${names[0]} ${level} needs a coordinated group`);
      assert.equal(new Set(groups).size, 1, `${names.join(', ')} must update together`);
      assert.notEqual(groups[0], 'everything-else');
    }
  }
  assert.notEqual(groupFor(app, 'firebase', 'major'), groupFor(app, '@sentry/react-native', 'major'));
  assert.notEqual(groupFor(app, 'expo-in-app-updates', 'major'), groupFor(app, 'expo', 'major'));
});

test('the reviewed Expo deviations stay out of the catch-all group and uncoupled majors get their own pull request', () => {
  const deviations = pkg.expo.install.exclude;
  assert.ok(deviations.length > 0);
  for (const name of deviations) {
    for (const level of LEVELS) {
      const group = groupFor(app, name, level);
      assert.ok(group, `${name} ${level} needs a reviewed group`);
      assert.notEqual(group, 'everything-else', `${name} ${level}`);
    }
  }
  for (const name of ['@tanstack/react-query', '@expo-google-fonts/archivo']) {
    assert.equal(groupFor(app, name, 'patch'), 'everything-else');
    assert.equal(groupFor(app, name, 'minor'), 'everything-else');
    assert.equal(groupFor(app, name, 'major'), undefined);
  }
});

test('every registry dependency of the root and tooling manifests takes its intended group at every update level', () => {
  const expected = new Map([...INTENDED].flatMap(([group, names]) => names.map((name) => [name, group])));
  assert.equal(expected.size, [...INTENDED.values()].flat().length, 'each dependency needs exactly one intended group');
  const installed = registryDependencies();
  assert.deepEqual(installed, [...expected.keys()].sort());
  for (const name of installed) {
    assert.equal(groupFor(app, name, 'major'), expected.get(name), `${name} major`);
    for (const level of ['patch', 'minor']) {
      assert.equal(groupFor(app, name, level), expected.get(name) ?? 'everything-else', `${name} ${level}`);
    }
  }
});

test('every exact group pattern names a dependency the app still installs', () => {
  const installed = new Set(registryDependencies());
  for (const [name, group] of Object.entries(app.groups)) {
    for (const pattern of group.patterns.filter((item) => !item.includes('*'))) {
      assert.ok(installed.has(pattern), `${pattern} in ${name} names a package that is no longer a dependency`);
    }
  }
});

test('security groups cover every ecosystem independently of normal update levels', () => {
  for (const entry of config.updates) {
    for (const level of LEVELS) {
      assert.ok(groupFor(entry, 'future-dependency', level, 'security-updates'), `${entry['package-ecosystem']} ${level}`);
    }
  }
});

test('workflows pin every action to a full commit, and deploy-web uses the commits CI uses', () => {
  const directory = join(root, '.github/workflows');
  const pins = new Map();
  for (const file of readdirSync(directory).filter((name) => /\.ya?ml$/.test(name))) {
    const workflow = load(readFileSync(join(directory, file), 'utf8'));
    const uses = Object.values(workflow.jobs).flatMap((job) => job.steps ?? []).map((step) => step.uses).filter(Boolean);
    for (const action of uses) assert.match(action, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.\/-]+@[0-9a-f]{40}$/, `${file}: ${action}`);
    pins.set(file, new Set(uses));
  }
  assert.ok(pins.has('ci.yml') && pins.has('deploy-web.yml'));
  for (const action of pins.get('deploy-web.yml')) assert.ok(pins.get('ci.yml').has(action), `deploy-web.yml uses ${action}, which ci.yml does not`);
});

test('deploy-web deploys pushes to main and manual dispatches with pinned tools and live checks', () => {
  const workflow = load(readFileSync(join(root, '.github/workflows/deploy-web.yml'), 'utf8'));
  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.deepEqual(workflow.on.push['paths-ignore'], ['docs/**', '**/*.md', 'store-artifacts/**', '.github/dependabot.yml']);
  assert.equal(workflow.on.workflow_dispatch.inputs.production.type, 'boolean');
  assert.equal(workflow.on.workflow_dispatch.inputs.production.default, false);
  assert.deepEqual(workflow.permissions, {contents: 'read'});
  assert.deepEqual(workflow.concurrency, {group: 'deploy-web', 'cancel-in-progress': false});
  const job = workflow.jobs.deploy;
  assert.equal(job.environment, 'production');
  const runs = job.steps.map((step) => step.run ?? '').join('\n');
  for (const command of ['yarn install --frozen-lockfile', 'yarn export:web', 'yarn check:web', 'npx sentry-expo-upload-sourcemaps dist',
    "find dist -name '*.map' -delete", 'npx --yes eas-cli@27.11.0 deploy --export-dir dist --environment production --non-interactive',
    'node scripts/check-live-web.mjs --origin https://yify.expo.app', 'node scripts/check-live-privacy.mjs --url https://yify.expo.app/privacy.html',
    'node scripts/check-legacy-contract.mjs --origin https://yify.expo.app', 'node scripts/check-live-web.mjs --origin https://yify--v2.expo.app --preview']) {
    assert.ok(runs.includes(command), command);
  }
  const names = job.steps.map((step) => step.name);
  assert.ok(names.indexOf('Check export') < names.indexOf('Deploy'), 'the export is checked before it is deployed');
  assert.ok(names.indexOf('Remove source maps from the deployment') < names.indexOf('Deploy'), 'source maps never reach the deployment');
  const exportStep = job.steps.find((step) => step.name === 'Export');
  assert.equal(exportStep.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, undefined, 'the web build derives authDomain from its host');
  assert.ok(!/YIFY_API_FIXTURES|EXPO_PUBLIC_API_ORIGIN|EXPO_PUBLIC_WEB_CHECKOUT/.test(JSON.stringify(workflow)));
});
