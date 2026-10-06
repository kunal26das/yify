const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const helpers = import('../scripts/dependabot-root-policy.mjs');
const integrity = `sha512-${Buffer.alloc(64, 1).toString('base64')}`;

function entry(name, version, dependencies = {}, selectors = [`${name}@${version}`]) {
  const tarball = name.split('/').at(-1);
  const fields = Object.entries(dependencies).length ? `  dependencies:\n${Object.entries(dependencies).map(([name, range]) => `    ${JSON.stringify(name)} ${JSON.stringify(range)}\n`).join('')}` : '';
  return `${selectors.map((key) => JSON.stringify(key)).join(', ')}:\n  version "${version}"\n  resolved "https://registry.yarnpkg.com/${name}/-/${tarball}-${version}.tgz#${'a'.repeat(40)}"\n  integrity ${integrity}\n${fields}\n`;
}

function lock(...values) {
  return `# yarn lockfile v1\n\n${values.join('')}`;
}

function fixture(name = 'eslint', before = '10.11.0', after = '10.12.0') {
  const field = name === 'eslint' ? 'devDependencies' : 'dependencies';
  const manifest = (version) => ({ 'package.json': JSON.stringify({ name: 'yify', [field]: { [name]: version } }),
    'crashreporting/package.json': '{"name":"@yify/crashreporting"}', 'tooling/package.json': '{"name":"@yify/tooling"}' });
  return { baseManifests: manifest(before), headManifests: manifest(after),
    baseLockfile: lock(entry(name, before), entry('expo-application', '58.0.3')),
    headLockfile: lock(entry(name, after), entry('expo-application', '58.0.3')) };
}

test('allows reviewed ESLint minor and scoped RevenueCat JS patch/minor pins', async () => {
  const { evaluateRootUpdate } = await helpers;
  for (const input of [fixture(), fixture('@revenuecat/purchases-js', '1.66.0', '1.67.1')]) {
    const result = evaluateRootUpdate(input);
    assert.equal(result.allowed, true, result.reason);
    assert.equal(result.updates.length, 1);
  }
});

for (const [label, mutate, message] of [
  ['major', (f) => { f.headManifests['package.json'] = '{"name":"yify","devDependencies":{"eslint":"11.0.0"}}'; }, /reviewed series/],
  ['prerelease', (f) => { f.headManifests['package.json'] = '{"name":"yify","devDependencies":{"eslint":"10.12.0-beta.1"}}'; }, /exact stable/],
  ['range', (f) => { f.headManifests['package.json'] = '{"name":"yify","devDependencies":{"eslint":"^10.12.0"}}'; }, /exact stable/],
  ['downgrade', (f) => { f.headManifests['package.json'] = '{"name":"yify","devDependencies":{"eslint":"10.10.0"}}'; }, /reviewed series/],
  ['script mutation', (f) => { const p = JSON.parse(f.headManifests['package.json']); p.scripts = { postinstall: 'anything' }; f.headManifests['package.json'] = JSON.stringify(p); }, /manifest content/],
  ['workspace mutation', (f) => { f.headManifests['tooling/package.json'] = '{"name":"@yify/tooling","version":"2"}'; }, /manifest content/],
  ['missing workspace', (f) => { delete f.headManifests['tooling/package.json']; }, /Every root workspace/],
  ['native drift', (f) => { f.headLockfile = lock(entry('eslint', '10.12.0'), entry('expo-application', '58.0.4')); }, /expo-application/],
  ['native removal', (f) => { f.headLockfile = lock(entry('eslint', '10.12.0')); }, /expo-application/],
  ['native addition', (f) => { f.headLockfile += entry('expo-file-system', '58.0.6'); }, /expo-file-system/],
  ['build tooling drift', (f) => { f.baseLockfile += entry('regexpu-core', '6.5.2'); f.headLockfile += entry('regexpu-core', '6.5.3'); }, /regexpu-core/],
  ['same-version native integrity drift', (f) => { f.headLockfile = f.headLockfile.replace(/sha512-[A-Za-z0-9+/=]+(?=\n\n$)/, `sha512-${Buffer.alloc(64, 2).toString('base64')}`); }, /expo-application/],
  ['native edge to an already locked package', (f) => { f.headLockfile = lock(entry('eslint', '10.12.0', { 'expo-application': '58.0.3' }), entry('expo-application', '58.0.3')); }, /dependency edge/],
  ['new unknown JS edge', (f) => { f.headLockfile = lock(entry('eslint', '10.12.0', { unknown: '^1.0.0' }), entry('expo-application', '58.0.3')); }, /dependency edge/],
  ['unmatched direct lock pin', (f) => { f.headLockfile = lock(entry('eslint', '10.11.0'), entry('expo-application', '58.0.3')); }, /manifest pins/],
  ['registry redirect', (f) => { f.headLockfile = f.headLockfile.replace('https://registry.yarnpkg.com/eslint', 'https://example.com/eslint'); }, /exact npm registry/],
  ['wrong tarball name', (f) => { f.headLockfile = f.headLockfile.replace('/eslint-10.12.0.tgz', '/another-10.12.0.tgz'); }, /exact npm registry/],
  ['invalid digest', (f) => { f.headLockfile = f.headLockfile.replace(integrity, 'sha512-YQ=='); }, /strong integrity/],
]) test(`blocks ${label}`, async () => {
  const { evaluateRootUpdate } = await helpers;
  const input = fixture(); mutate(input);
  const result = evaluateRootUpdate(input);
  assert.equal(result.allowed, false);
  assert.match(result.reason, message);
});

test('allows explicitly reviewed Radix changes with unchanged React edges', async () => {
  const { evaluateRootUpdate } = await helpers;
  const input = fixture();
  input.baseLockfile += entry('@radix-ui/react-slot', '1.3.3', { react: '^19.0.0' });
  input.headLockfile += entry('@radix-ui/react-slot', '1.4.0', { react: '^19.0.0' });
  const result = evaluateRootUpdate(input);
  assert.equal(result.allowed, true, result.reason);
  assert.deepEqual(result.changedLockfilePackages, ['@radix-ui/react-slot', 'eslint']);
});

test('blocks a new native optional edge from an approved transitive package', async () => {
  const { evaluateRootUpdate } = await helpers;
  const input = fixture();
  input.baseLockfile += entry('@radix-ui/react-slot', '1.3.3');
  input.headLockfile += entry('@radix-ui/react-slot', '1.4.0', { 'expo-application': '58.0.3' }).replace('  dependencies:', '  optionalDependencies:');
  const result = evaluateRootUpdate(input);
  assert.equal(result.allowed, false);
  assert.match(result.reason, /dependency edge/);
});

test('allows reviewed Radix-to-Radix dependency range updates', async () => {
  const { evaluateRootUpdate } = await helpers;
  const input = fixture();
  input.baseLockfile += entry('@radix-ui/react-primitive', '2.1.10', { '@radix-ui/react-slot': '1.3.3' }) + entry('@radix-ui/react-slot', '1.3.3');
  input.headLockfile += entry('@radix-ui/react-primitive', '2.1.11', { '@radix-ui/react-slot': '1.4.0' }) + entry('@radix-ui/react-slot', '1.4.0');
  const result = evaluateRootUpdate(input);
  assert.equal(result.allowed, true, result.reason);
});

for (const [label, before, after, message] of [
  ['Radix major', '1.3.3', '2.0.0', /major or preview/],
  ['Radix downgrade', '1.3.3', '1.3.2', /downgrade/],
  ['Radix preview', '1.3.3', '1.4.0-rc.1', /exact stable/],
]) test(`blocks ${label} transitive updates`, async () => {
  const { evaluateRootUpdate } = await helpers;
  const input = fixture();
  input.baseLockfile += entry('@radix-ui/react-slot', before);
  input.headLockfile += entry('@radix-ui/react-slot', after);
  const result = evaluateRootUpdate(input);
  assert.equal(result.allowed, false);
  assert.match(result.reason, message);
});

test('blocks same-version source mutation in an approved transitive package', async () => {
  const { evaluateRootUpdate } = await helpers;
  const input = fixture();
  input.baseLockfile += entry('@radix-ui/react-slot', '1.3.3');
  input.headLockfile += entry('@radix-ui/react-slot', '1.3.3').replace(integrity, `sha512-${Buffer.alloc(64, 2).toString('base64')}`);
  const result = evaluateRootUpdate(input);
  assert.equal(result.allowed, false);
  assert.match(result.reason, /Same-version source/);
});

test('blocks a protected edge moved onto a newer reviewed package version despite an unchanged edge union', async () => {
  const { evaluateRootUpdate } = await helpers;
  const input = fixture();
  input.baseLockfile += entry('@radix-ui/react-slot', '1.3.3', { 'expo-application': '58.0.3' }) + entry('@radix-ui/react-slot', '1.4.0');
  input.headLockfile += entry('@radix-ui/react-slot', '1.3.3', { 'expo-application': '58.0.3' }) + entry('@radix-ui/react-slot', '1.5.0', { 'expo-application': '58.0.3' });
  const result = evaluateRootUpdate(input);
  assert.equal(result.allowed, false);
  assert.match(result.reason, /dependency edge across versions/);
});

test('blocks an existing reviewed selector downgrade hidden by a newer parallel version', async () => {
  const { evaluateRootUpdate } = await helpers;
  const input = fixture();
  input.baseLockfile += entry('@radix-ui/react-slot', '1.3.3') + entry('@radix-ui/react-slot', '1.4.0', {}, ['@radix-ui/react-slot@^1.0.0']);
  input.headLockfile += entry('@radix-ui/react-slot', '1.3.3', {}, ['@radix-ui/react-slot@1.3.3', '@radix-ui/react-slot@^1.0.0']) + entry('@radix-ui/react-slot', '1.5.0');
  const result = evaluateRootUpdate(input);
  assert.equal(result.allowed, false);
  assert.match(result.reason, /selector downgrade/);
});

test('permits upgrading a direct RevenueCat pin to a version already locked for another selector', async () => {
  const { evaluateRootUpdate } = await helpers;
  const input = fixture('@revenuecat/purchases-js', '1.66.0', '1.67.1');
  input.baseLockfile += entry('@revenuecat/purchases-js', '1.67.1', {}, ['@revenuecat/purchases-js@^1.67.1']);
  input.headLockfile = lock(entry('@revenuecat/purchases-js', '1.67.1', {}, ['@revenuecat/purchases-js@1.67.1', '@revenuecat/purchases-js@^1.67.1']), entry('expo-application', '58.0.3'));
  const result = evaluateRootUpdate(input);
  assert.equal(result.allowed, true, result.reason);
});

test('ignores grouped selector split/merge and identical resolution selector additions/removals', async () => {
  const { evaluateRootUpdate } = await helpers;
  const input = fixture();
  input.baseLockfile = lock(entry('eslint', '10.11.0'), entry('expo-application', '58.0.3', {}, ['expo-application@^58.0.0', 'expo-application@58.0.3']));
  input.headLockfile = lock(entry('eslint', '10.12.0'), entry('expo-application', '58.0.3', {}, ['expo-application@^58.0.0']), entry('expo-application', '58.0.3', {}, ['expo-application@^58.0.2']));
  const result = evaluateRootUpdate(input);
  assert.equal(result.allowed, true, result.reason);
});

test('blocks retargeting an existing selector between unchanged native versions', async () => {
  const { evaluateRootUpdate } = await helpers;
  const input = fixture();
  input.baseLockfile = lock(entry('eslint', '10.11.0'), entry('expo-application', '58.0.3', {}, ['expo-application@^58']), entry('expo-application', '58.0.4', {}, ['expo-application@58.0.4']));
  input.headLockfile = lock(entry('eslint', '10.12.0'), entry('expo-application', '58.0.3', {}, ['expo-application@58.0.3']), entry('expo-application', '58.0.4', {}, ['expo-application@^58', 'expo-application@58.0.4']));
  const result = evaluateRootUpdate(input);
  assert.equal(result.allowed, false);
  assert.match(result.reason, /selector retargeting/);
});

test('retains outgoing dependency and optional dependency records of protected packages', async () => {
  const { evaluateRootUpdate } = await helpers;
  const input = fixture();
  input.baseLockfile += entry('@expo/config', '58.0.3', { 'expo-application': '^58.0.0' });
  input.headLockfile += entry('@expo/config', '58.0.3', { 'expo-application': '^58.0.3' });
  assert.match(evaluateRootUpdate(input).reason, /@expo\/config/);
});

for (const [label, mutate] of [
  ['duplicate selector', (s) => s + entry('eslint', '10.12.0')],
  ['duplicate field', (s) => s.replace('  version "10.12.0"', '  version "10.12.0"\n  version "10.12.1"')],
  ['unknown field', (s) => s + '  nativeCode true\n'],
  ['nested unknown field', (s) => s + '    arbitrary "value"\n'],
  ['mixed package grouping', (s) => s.replace('"eslint@10.12.0":', '"eslint@10.12.0", "expo@58":')],
  ['invalid quote', (s) => s.replace('  version "10.12.0"', '  version "10.12.0')],
  ['duplicate dependency', (s) => s + '  dependencies:\n    x "1"\n    x "2"\n'],
  ['unsupported format', (s) => s.replace('# yarn lockfile v1', '# yarn lockfile v2')],
  ['trailing header comma', (s) => s.replace('"eslint@10.12.0":', '"eslint@10.12.0", :')],
  ['conflict markers', (s) => s + '<<<<<<< HEAD\n'],
]) test(`fails closed on ${label}`, async () => {
  const { evaluateRootUpdate } = await helpers;
  const input = fixture(); input.headLockfile = mutate(input.headLockfile);
  assert.equal(evaluateRootUpdate(input).allowed, false);
});

test('parses the complete committed Yarn v1 grammar including aliases and grouped selectors', async () => {
  const { parseYarnLockfile } = await helpers;
  const source = await readFile(join(__dirname, '..', 'yarn.lock'));
  const parsed = parseYarnLockfile(source);
  assert.ok(parsed.size > 1000);
  assert.ok([...parsed.values()].some((entry) => entry.name === 'react-native'));
  assert.ok([...parsed.keys()].some((key) => key.startsWith('babel7@npm:')));
});

test('does not mutate caller inputs and accepts UTF-8 buffers and CRLF', async () => {
  const { evaluateRootUpdate } = await helpers;
  const input = fixture();
  input.headLockfile = Buffer.from(input.headLockfile.replace(/\n/g, '\r\n'));
  const original = structuredClone(input.headManifests);
  assert.equal(evaluateRootUpdate(input).allowed, true);
  assert.deepEqual(input.headManifests, original);
});
