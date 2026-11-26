const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const semver = require('semver');
const { test } = require('node:test');

const modulePromise = import('../../scripts/expo-native-compat.mjs');
const repository = path.resolve(__dirname, '../..');

async function fixture(t) {
  const { sha256 } = await modulePromise;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-compat-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const patchDirectory = path.join(root, 'patches');
  await fs.mkdir(patchDirectory);
  for (const name of ['react-native', 'expo']) {
    await fs.mkdir(path.join(root, 'node_modules', name), { recursive: true });
    await fs.writeFile(path.join(root, 'node_modules', name, 'package.json'), JSON.stringify({ version: name === 'react-native' ? '0.87.1' : '57.0.25' }));
  }
  const manifest = { reactNative: '0.87.1', files: [] };
  for (const file of ['a.js', 'b.js']) {
    const before = 'first\nold\nlast\n';
    const after = 'first\nnew\nlast\n';
    await fs.writeFile(path.join(root, 'node_modules/expo', file), before);
    await fs.writeFile(path.join(patchDirectory, `${file}.patch`), `--- a/${file}\n+++ b/${file}\n@@ -1,3 +1,3 @@\n first\n-old\n+new\n last\n`);
    manifest.files.push({ package: 'expo', version: '57.0.25', file, before: sha256(before), after: sha256(after), patch: `${file}.patch` });
  }
  const save = () => fs.writeFile(path.join(patchDirectory, 'manifest.json'), JSON.stringify(manifest));
  await save();
  return { root, patchDirectory, manifest, save, target: (file) => path.join(root, 'node_modules/expo', file) };
}

test('applies exact sources once and verifies repeated install', async (t) => {
  const f = await fixture(t);
  const { applyCompatibility } = await modulePromise;
  assert.deepEqual(await applyCompatibility(f), { applied: 2, verified: 2, reactNative: '0.87.1' });
  assert.equal(await fs.readFile(f.target('a.js'), 'utf8'), 'first\nnew\nlast\n');
  assert.equal((await applyCompatibility({ ...f, check: true })).applied, 0);
  assert.equal((await applyCompatibility(f)).applied, 0);
});

test('unknown later source fails before changing any file', async (t) => {
  const f = await fixture(t);
  const { applyCompatibility } = await modulePromise;
  await fs.writeFile(f.target('b.js'), 'unexpected\n');
  await assert.rejects(applyCompatibility(f), /Unrecognized compatibility source/);
  assert.equal(await fs.readFile(f.target('a.js'), 'utf8'), 'first\nold\nlast\n');
});

test('mixed clean and applied sources recover an interrupted install', async (t) => {
  const f = await fixture(t);
  const { applyCompatibility } = await modulePromise;
  await fs.writeFile(f.target('a.js'), 'first\nnew\nlast\n');
  assert.equal((await applyCompatibility(f)).applied, 1);
});

test('check reports missing patches without applying them', async (t) => {
  const f = await fixture(t);
  const { applyCompatibility } = await modulePromise;
  await assert.rejects(applyCompatibility({ ...f, check: true }), /have not been applied/);
  assert.equal(await fs.readFile(f.target('a.js'), 'utf8'), 'first\nold\nlast\n');
});

for (const name of ['react-native', 'expo']) {
  test(`rejects an unreviewed ${name} version`, async (t) => {
    const f = await fixture(t);
    const { applyCompatibility } = await modulePromise;
    await fs.writeFile(path.join(f.root, 'node_modules', name, 'package.json'), JSON.stringify({ version: '99.0.0' }));
    await assert.rejects(applyCompatibility(f), /compatibility requires/);
    assert.equal(await fs.readFile(f.target('a.js'), 'utf8'), 'first\nold\nlast\n');
  });
}

test('rejects corrupted patch payload before changing any file', async (t) => {
  const f = await fixture(t);
  const { applyCompatibility } = await modulePromise;
  const p = path.join(f.patchDirectory, 'b.js.patch');
  await fs.writeFile(p, (await fs.readFile(p, 'utf8')).replace('+new', '+unreviewed'));
  await assert.rejects(applyCompatibility(f), /patch digest does not match/);
  assert.equal(await fs.readFile(f.target('a.js'), 'utf8'), 'first\nold\nlast\n');
});

test('rejects duplicate targets and paths outside the package', async (t) => {
  const f = await fixture(t);
  const { applyCompatibility } = await modulePromise;
  f.manifest.files[1] = { ...f.manifest.files[0] };
  await f.save();
  await assert.rejects(applyCompatibility(f), /Duplicate compatibility target/);
  f.manifest.files[1].file = '../outside';
  await f.save();
  await assert.rejects(applyCompatibility(f), /Invalid compatibility path/);
});

test('strict hunk application preserves final newline and rejects shifted context', async () => {
  const { applyUnifiedPatch } = await modulePromise;
  const patch = '--- a/file\n+++ b/file\n@@ -1,1 +1,1 @@\n-old\n+new\n';
  assert.equal(applyUnifiedPatch('old', patch), 'new');
  assert.equal(applyUnifiedPatch('old\n', patch), 'new\n');
  assert.throws(() => applyUnifiedPatch('other\n', patch), /context does not match/);
  assert.throws(() => applyUnifiedPatch('old\n', patch.replace('-1,1', '-1,2')), /line count/);
});

test('reviewed new native source files are created once and unknown existing files are rejected', async (t) => {
  const f = await fixture(t);
  const { applyCompatibility, sha256 } = await modulePromise;
  const after = 'package expo\nclass GeneratedTask\n';
  const entry = { package: 'expo', version: '57.0.25', file: 'tasks/New.kt', before: null, after: sha256(after), patch: 'New.patch' };
  f.manifest.files.push(entry);
  await f.save();
  await fs.writeFile(path.join(f.patchDirectory, entry.patch), '--- /dev/null\n+++ b/tasks/New.kt\n@@ -0,0 +1,2 @@\n+package expo\n+class GeneratedTask\n');
  await assert.rejects(applyCompatibility({ ...f, check: true }), /have not been applied/);
  await assert.rejects(fs.readFile(f.target(entry.file)), { code: 'ENOENT' });
  assert.equal((await applyCompatibility(f)).applied, 3);
  assert.equal(await fs.readFile(f.target(entry.file), 'utf8'), after);
  assert.equal((await applyCompatibility(f)).applied, 0);
  await fs.writeFile(f.target(entry.file), 'unexpected user source\n');
  await assert.rejects(applyCompatibility(f), /Unrecognized compatibility source/);
  assert.equal(await fs.readFile(f.target(entry.file), 'utf8'), 'unexpected user source\n');
});

test('reviewed upstream sources fail before patches and enforce removed-file absence', async (t) => {
  const f = await fixture(t);
  const { applyCompatibility, sha256 } = await modulePromise;
  f.manifest.sources = [
    { package: 'expo', version: '57.0.25', file: 'upstream.js', sha256: sha256('reviewed\n') },
    { package: 'expo', version: '57.0.25', file: 'removed.js', sha256: null },
  ];
  await f.save();
  await fs.writeFile(f.target('upstream.js'), 'unreviewed\n');
  await assert.rejects(applyCompatibility(f), /Unrecognized compatibility source/);
  assert.equal(await fs.readFile(f.target('a.js'), 'utf8'), 'first\nold\nlast\n');
  await fs.writeFile(f.target('upstream.js'), 'reviewed\n');
  await fs.writeFile(f.target('removed.js'), 'restored legacy bridge\n');
  await assert.rejects(applyCompatibility(f), /Unrecognized compatibility source/);
  await fs.rm(f.target('removed.js'));
  assert.deepEqual(await applyCompatibility(f), { applied: 2, verified: 4, reactNative: '0.87.1' });
  assert.equal((await applyCompatibility({ ...f, check: true })).applied, 0);
});

test('the manifest keeps only the reviewed Reanimated lifecycle patch and it is applied', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(repository, 'patches/expo-native/manifest.json'), 'utf8'));
  assert.equal(manifest.sources, undefined);
  assert.deepEqual(manifest.files.map((entry) => `${entry.package}/${entry.file}`), [
    'react-native-reanimated/android/src/main/java/com/swmansion/reanimated/NodesManager.kt',
  ]);
  const { applyCompatibility } = await modulePromise;
  assert.deepEqual(await applyCompatibility({ check: true }), { applied: 0, verified: 1, reactNative: manifest.reactNative });
});

test('the patched animation libraries explicitly support the selected React Native runtime', async () => {
  const read = async (name) => JSON.parse(await fs.readFile(path.join(repository, 'node_modules', name, 'compatibility.json'), 'utf8'));
  const reanimated = await read('react-native-reanimated');
  const worklets = await read('react-native-worklets');
  const pkg = JSON.parse(await fs.readFile(path.join(repository, 'package.json'), 'utf8'));
  const minor = (version) => version.split('.').slice(0, 2).join('.');
  const reactNative = minor(pkg.dependencies['react-native']);
  const reanimatedVersion = `${minor(pkg.dependencies['react-native-reanimated'])}.x`;
  const workletsVersion = `${minor(pkg.dependencies['react-native-worklets'])}.x`;
  assert.ok(reanimated.fabric[reanimatedVersion]['react-native'].includes(reactNative));
  assert.ok(reanimated.fabric[reanimatedVersion]['react-native-worklets'].includes(workletsVersion));
  assert.ok(worklets[workletsVersion]['react-native'].includes(reactNative));
});

test('every patched package has an exact installation pin', async () => {
  const pkg = JSON.parse(await fs.readFile(path.join(repository, 'package.json'), 'utf8'));
  const manifest = JSON.parse(await fs.readFile(path.join(repository, 'patches/expo-native/manifest.json'), 'utf8'));
  const pins = {...pkg.dependencies, ...pkg.devDependencies, ...pkg.resolutions};
  assert.equal(pins['react-native'], manifest.reactNative);
  for (const entry of [...(manifest.sources ?? []), ...manifest.files]) {
    assert.equal(pins[entry.package], entry.version, `${entry.package} must stay at its reviewed version after a clean resolution`);
  }
});

test('coordinated Expo resolutions satisfy their installed parent requirements', async () => {
  const pkg = JSON.parse(await fs.readFile(path.join(repository, 'package.json'), 'utf8'));
  const pairs = [
    ['expo-modules-core', 'expo-modules-jsi'],
    ['@expo/cli', '@expo/inline-modules'],
    ['@expo/cli', '@expo/prebuild-config'],
    ['@expo/cli', '@expo/router-server'],
  ];
  for (const [parent, child] of pairs) {
    const parentPkg = JSON.parse(await fs.readFile(path.join(repository, 'node_modules', parent, 'package.json'), 'utf8'));
    const childPkg = JSON.parse(await fs.readFile(path.join(repository, 'node_modules', child, 'package.json'), 'utf8'));
    const required = parentPkg.dependencies[child];
    const pinned = pkg.resolutions[child];
    assert.ok(required, `${parent} must declare ${child}`);
    assert.ok(pinned && semver.valid(pinned), `${child} must have an exact resolution`);
    assert.ok(semver.satisfies(pinned, required), `${parent}@${parentPkg.version} requires ${child}@${required}; pinned ${pinned}`);
    assert.equal(childPkg.version, pinned, `${child} installation must match its exact resolution`);
  }
});

test('React Native and its Metro tooling share one version', async () => {
  const pkg = JSON.parse(await fs.readFile(path.join(repository, 'package.json'), 'utf8'));
  const reactNative = pkg.dependencies['react-native'];
  assert.equal(pkg.devDependencies['@react-native/metro-config'], reactNative);
  assert.equal(Object.hasOwn(pkg.devDependencies, '@react-native/js-polyfills'), false);
  for (const name of ['@react-native/asset-utils', '@react-native/dev-middleware', '@react-native/babel-plugin-codegen',
    '@react-native/codegen', '@react-native/normalize-colors']) {
    assert.equal(pkg.resolutions[name], reactNative);
  }
});
