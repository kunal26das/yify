const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const modulePromise = import('../scripts/expo-native-compat.mjs');
const repository = path.resolve(__dirname, '..');

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

async function patchedSource(packageName, file) {
  const directory = path.join(repository, 'patches/expo-rn87');
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  const entry = manifest.files.find((entry) => entry.package === packageName && entry.file === file);
  assert.ok(entry);
  const source = await fs.readFile(path.join(repository, 'node_modules', packageName, file), 'utf8');
  const { applyUnifiedPatch, sha256 } = await modulePromise;
  if (sha256(source) === entry.after) return source;
  assert.equal(sha256(source), entry.before);
  return applyUnifiedPatch(source, await fs.readFile(path.join(directory, entry.patch), 'utf8'));
}

test('Expo server frame shim schedules no work and preserves browser/native APIs', async () => {
  const source = await patchedSource('expo', 'src/winter/runtime.ts');
  const shim = source.slice(source.indexOf("if (process.env.EXPO_SERVER && typeof globalThis.requestAnimationFrame"));
  assert.ok(shim.startsWith('if ('));
  let calls = 0;
  const server = vm.createContext({ process: { env: { EXPO_SERVER: 'true' } }, callback: () => { calls += 1; } });
  vm.runInContext(shim, server);
  assert.equal(vm.runInContext('requestAnimationFrame(callback)', server), 0);
  vm.runInContext('cancelAnimationFrame(0)', server);
  assert.equal(calls, 0);
  const browser = vm.createContext({ process: { env: {} } });
  vm.runInContext(shim, browser);
  assert.equal(vm.runInContext('typeof requestAnimationFrame', browser), 'undefined');
  const existing = () => 42;
  const native = vm.createContext({ process: { env: { EXPO_SERVER: 'true' } }, requestAnimationFrame: existing });
  vm.runInContext(shim, native);
  assert.equal(native.requestAnimationFrame, existing);
});

test('Metro and React Native share the same asset registry and accepted import routes', async () => {
  const source = await patchedSource('@expo/cli', 'build/src/start/server/metro/withMetroMultiPlatform.js');
  const registry = /const ASSET_REGISTRY_SRC = `([^`]+)`;/.exec(source)?.[1];
  assert.ok(registry);
  const context = vm.createContext({ module: { exports: {} } });
  vm.runInContext(registry, context);
  const exports = context.module.exports;
  const asset = { uri: 'catalog.png' };
  assert.equal(exports.AssetRegistry.getAssetByID(exports.registerAsset(asset)), asset);
  assert.equal(exports.getAssetByID(exports.AssetRegistry.registerAsset(asset)), asset);
  const start = source.indexOf('if (moduleName === config.transformer.assetRegistryPath ||');
  const end = source.indexOf("if (platform === 'web'", start);
  assert.ok(start >= 0 && end > start);
  const resolve = new Function('moduleName', 'context', 'config', 'getAssetRegistryModule', source.slice(start, end));
  const config = { transformer: { assetRegistryPath: 'custom-registry' } };
  for (const specifier of ['custom-registry', 'react-native/asset-registry', '@react-native/assets-registry/registry', '@react-native/assets-registry/registry.js']) {
    assert.equal(resolve(specifier, {}, config, () => 'shared'), 'shared');
  }
  for (const [specifier, origin] of [
    ['../../src/private/assets/AssetRegistry', '/app/node_modules/react-native/Libraries/Image/source.js'],
    ['..\\..\\src\\private\\assets\\AssetRegistry.js', 'C:\\app\\node_modules\\react-native\\src\\Image.js'],
  ]) assert.equal(resolve(specifier, { originModulePath: origin }, config, () => 'shared'), 'shared');
  assert.equal(resolve('../../src/private/assets/AssetRegistry', { originModulePath: '/app/other/Image.js' }, config, () => 'shared'), undefined);
});

test('native Metro polyfills resolve the matching supported package', async () => {
  const source = await patchedSource('@expo/metro-config', 'build/ExpoMetroConfig.js');
  const body = /getPolyfills: \(\{ platform \}\) => \{([\s\S]*?)\n            \},/.exec(source)?.[1];
  assert.ok(body);
  const required = [];
  const get = new Function('platform', 'require', body);
  const loader = (name) => { required.push(name); return () => ['guard.js']; };
  assert.deepEqual(get(null, loader), []);
  assert.deepEqual(get('android', loader), ['guard.js']);
  assert.deepEqual(get('ios', loader), ['guard.js']);
  assert.deepEqual(required, ['@react-native/js-polyfills', '@react-native/js-polyfills']);
});
