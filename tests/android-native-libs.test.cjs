const assert = require('node:assert/strict');
const {mkdtempSync, writeFileSync, rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const path = require('node:path');
const {test} = require('node:test');
const {deflateRawSync} = require('node:zlib');

const load = () => import('../scripts/check-android-native-libs.mjs');
const architectures = {'armeabi-v7a': [1, 40], 'arm64-v8a': [2, 183], x86: [1, 3], x86_64: [2, 62]};
const required = ['libreactnative.so', 'libc++_shared.so', 'libhermesvm.so'];

function elf(abi) {
    const bytes = Buffer.alloc(64);
    bytes.set([127, 69, 76, 70, architectures[abi][0], 1, 1]);
    bytes.writeUInt16LE(3, 16);
    bytes.writeUInt16LE(architectures[abi][1], 18);
    return bytes;
}

function crc(bytes) {
    let sum = 0xffffffff;
    for (const byte of bytes) {
        sum ^= byte;
        for (let bit = 0; bit < 8; bit++) sum = sum & 1 ? (sum >>> 1) ^ 0xedb88320 : sum >>> 1;
    }
    return (sum ^ 0xffffffff) >>> 0;
}

function zip(entries) {
    const files = [];
    const directory = [];
    let offset = 0;
    for (const {name, bytes, method = 8, checksum = crc(bytes), localMethod = method} of entries) {
        const filename = Buffer.from(name);
        const compressed = method === 8 ? deflateRawSync(bytes) : bytes;
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(localMethod, 8);
        local.writeUInt32LE(checksum, 14);
        local.writeUInt32LE(compressed.length, 18);
        local.writeUInt32LE(bytes.length, 22);
        local.writeUInt16LE(filename.length, 26);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(method, 10);
        central.writeUInt32LE(checksum, 16);
        central.writeUInt32LE(compressed.length, 20);
        central.writeUInt32LE(bytes.length, 24);
        central.writeUInt16LE(filename.length, 28);
        central.writeUInt32LE(offset, 42);
        files.push(local, filename, compressed);
        directory.push(central, filename);
        offset += local.length + filename.length + compressed.length;
    }
    const listing = Buffer.concat(directory);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(listing.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...files, listing, end]);
}

function nativeEntries(abis, options = {}) {
    return abis.flatMap(abi => required.map(name => ({name: `lib/${abi}/${name}`, bytes: elf(abi), ...options})));
}

function fixture(t) {
    const directory = mkdtempSync(path.join(tmpdir(), 'yify-android-artifact-'));
    t.after(() => rmSync(directory, {force: true, recursive: true}));
    const manifests = new Map();
    return {
        apk(name, entries, manifest = {packageName: 'test.yify', split: '', extractNativeLibs: true}) {
            const file = path.join(directory, name);
            writeFileSync(file, zip([{name: 'AndroidManifest.xml', bytes: Buffer.from('manifest fixture')}, ...entries]));
            manifests.set(file, {longVersionCode: '94', ...manifest});
            return file;
        },
        readManifest: file => manifests.get(file),
    };
}

test('universal APK validates real compressed ZIP payloads and ELF architecture for all four ABIs', async t => {
    const {verifyAndroidNativeLibraries} = await load();
    const f = fixture(t);
    const abis = Object.keys(architectures);
    const apk = f.apk('universal.apk', nativeEntries(abis));
    const result = verifyAndroidNativeLibraries([apk], {...f, abis});
    assert.deepEqual(result.abis, Object.fromEntries(abis.map(abi => [abi, 3])));
    assert.equal(result.artifacts[0].nativeLibraries, 12);
    assert.match(result.artifacts[0].sha256, /^[a-f0-9]{64}$/);
});

test('base and selected ABI split validate as one device package without requiring absent device ABIs', async t => {
    const {verifyAndroidNativeLibraries} = await load();
    const f = fixture(t);
    const base = f.apk('base.apk', []);
    const split = f.apk('config.arm64.apk', nativeEntries(['arm64-v8a']), {packageName: 'test.yify', split: 'config.arm64_v8a'});
    const language = f.apk('config.en.apk', [], {packageName: 'test.yify', split: 'config.en'});
    const result = verifyAndroidNativeLibraries([split, language, base], {...f, abis: ['arm64-v8a']});
    assert.deepEqual(result.abis, {'arm64-v8a': 3});
});

test('an extraction-enabled manifest cannot conceal stored native libraries', async t => {
    const {verifyAndroidNativeLibraries} = await load();
    const f = fixture(t);
    const apk = f.apk('stored.apk', nativeEntries(['x86_64'], {method: 0}));
    assert.throws(() => verifyAndroidNativeLibraries([apk], {...f, abis: ['x86_64']}), /must be compressed/);
});

for (const extractNativeLibs of [false, undefined]) {
    test(`compressed native bytes require explicit base extraction flag ${extractNativeLibs}`, async t => {
        const {verifyAndroidNativeLibraries} = await load();
        const f = fixture(t);
        const apk = f.apk('base.apk', nativeEntries(['x86']), {packageName: 'test.yify', split: '', extractNativeLibs});
        assert.throws(() => verifyAndroidNativeLibraries([apk], {...f, abis: ['x86']}), /must enable extractNativeLibs/);
    });
}

test('missing dependencies and missing expected ABI splits fail', async t => {
    const {verifyAndroidNativeLibraries} = await load();
    const f = fixture(t);
    const missing = f.apk('missing.apk', nativeEntries(['arm64-v8a']).filter(entry => !entry.name.endsWith('libc++_shared.so')));
    assert.throws(() => verifyAndroidNativeLibraries([missing], {...f, abis: ['arm64-v8a']}), /Missing required native library.*libc\+\+_shared/);
    const apk = f.apk('arm64.apk', nativeEntries(['arm64-v8a']));
    assert.throws(() => verifyAndroidNativeLibraries([apk], {...f, abis: ['arm64-v8a', 'x86_64']}), /Missing required native library.*x86_64/);
});

test('an ABI directory label cannot conceal a different ELF architecture', async t => {
    const {verifyAndroidNativeLibraries} = await load();
    const f = fixture(t);
    const entries = nativeEntries(['x86_64']);
    entries[0].bytes = elf('arm64-v8a');
    const apk = f.apk('mismatched.apk', entries);
    assert.throws(() => verifyAndroidNativeLibraries([apk], {...f, abis: ['x86_64']}), /ELF does not match ABI/);
});

test('corrupt payloads and conflicting local ZIP headers cannot pass', async t => {
    const {verifyAndroidNativeLibraries} = await load();
    const f = fixture(t);
    const corrupt = f.apk('corrupt.apk', nativeEntries(['x86'], {checksum: 1}));
    assert.throws(() => verifyAndroidNativeLibraries([corrupt], {...f, abis: ['x86']}), /Invalid ZIP payload/);
    const headers = f.apk('headers.apk', nativeEntries(['x86'], {localMethod: 0}));
    assert.throws(() => verifyAndroidNativeLibraries([headers], {...f, abis: ['x86']}), /ZIP headers disagree/);
});

test('incomplete, mixed, duplicate and extraction-disabled split sets fail', async t => {
    const {verifyAndroidNativeLibraries} = await load();
    const f = fixture(t);
    const base = f.apk('base.apk', []);
    const split = f.apk('split.apk', nativeEntries(['x86']), {packageName: 'test.yify', split: 'config.x86'});
    assert.throws(() => verifyAndroidNativeLibraries([split], {...f, abis: ['x86']}), /exactly one base APK/);
    assert.throws(() => verifyAndroidNativeLibraries([base, split, split], {...f, abis: ['x86']}), /one package and split set/);
    const other = f.apk('other.apk', [], {packageName: 'other.app', split: 'config.en'});
    assert.throws(() => verifyAndroidNativeLibraries([base, split, other], {...f, abis: ['x86']}), /one package and split set/);
    const disabled = f.apk('disabled.apk', nativeEntries(['x86']), {packageName: 'test.yify', split: 'config.x86', extractNativeLibs: false});
    assert.throws(() => verifyAndroidNativeLibraries([base, disabled], {...f, abis: ['x86']}), /Split APK disables/);
});

test('duplicate native entries and unexpected ABIs are rejected', async t => {
    const {verifyAndroidNativeLibraries} = await load();
    const f = fixture(t);
    const entries = nativeEntries(['x86']);
    const duplicate = f.apk('duplicate.apk', [...entries, entries[0]]);
    assert.throws(() => verifyAndroidNativeLibraries([duplicate], {...f, abis: ['x86']}), /Duplicate or invalid ZIP name/);
    const apk = f.apk('unexpected.apk', nativeEntries(['x86', 'arm64-v8a']));
    assert.throws(() => verifyAndroidNativeLibraries([apk], {...f, abis: ['x86']}), /Unexpected packaged ABI/);
});

test('compiled manifest parsing distinguishes base/split and strict application extraction booleans', async () => {
    const {parseManifestTree} = await load();
    const tree = value => `N: android=http://schemas.android.com/apk/res/android\n  E: manifest (line=1)\n    A: package="test.yify" (Raw: "test.yify")\n    A: android:versionCode(0x0101021b)=94\n    E: application (line=3)\n      A: android:extractNativeLibs(0x010104ea)=${value}\n      E: meta-data (line=4)\n        A: android:name(0x01010003)="test"\n`;
    assert.deepEqual(parseManifestTree(tree('(type 0x12)0xffffffff')), {packageName: 'test.yify', split: '', longVersionCode: '94', extractNativeLibs: true});
    assert.equal(parseManifestTree(tree('(type 0x12)0x0')).extractNativeLibs, false);
    assert.equal(parseManifestTree(tree('true').replace('A: android:extractNativeLibs', 'A: http://schemas.android.com/apk/res/android:extractNativeLibs')).extractNativeLibs, true);
    assert.equal(parseManifestTree(tree('false').replace('A: android:extractNativeLibs', 'A: http://schemas.android.com/apk/res/android:extractNativeLibs')).extractNativeLibs, false);
    assert.equal(parseManifestTree(tree('true').replace('    E: application', '    A: split="config.arm64_v8a"\n    E: application')).split, 'config.arm64_v8a');
    assert.throws(() => parseManifestTree(tree('"true"')), /Invalid native extraction attribute/);
    assert.throws(() => parseManifestTree(''), /Expected one manifest/);
});

test('compiled version codes are exact across base and ABI splits including the major component', async t => {
    const {parseManifestTree, verifyAndroidNativeLibraries} = await load();
    const f = fixture(t);
    const tree = (version, major = '') => `E: manifest\n  A: package="test.yify"\n  A: http://schemas.android.com/apk/res/android:versionCode(0x0101021b)=${version}\n${major}  E: application\n    A: android:extractNativeLibs(0x010104ea)=true\n`;
    const parse = (version, major = '') => parseManifestTree(tree(version, major));
    const baseManifest = parse('94');
    const base = f.apk('base.apk', [], baseManifest);
    const matching = f.apk('matching.apk', nativeEntries(['arm64-v8a']), {...parse('(type 0x10)0x5e'), split: 'config.arm64_v8a'});
    assert.equal(verifyAndroidNativeLibraries([base, matching], {...f, abis: ['arm64-v8a']}).longVersionCode, '94');
    for (const manifest of [parse('93'), parse('94', '  A: android:versionCodeMajor(0x01010576)=1\n')]) {
        const split = f.apk('mixed.apk', nativeEntries(['arm64-v8a']), {...manifest, split: 'config.arm64_v8a'});
        assert.throws(() => verifyAndroidNativeLibraries([base, split], {...f, abis: ['arm64-v8a']}), /same compiled long version code/);
    }
    assert.equal(parse('94', '  A: android:versionCodeMajor(0x01010576)=(type 0x11)0x200000\n').longVersionCode, '9007199254741086');
    for (const value of ['-1', '4294967296', '1.5', '"94"']) assert.throws(() => parse(value), /Invalid manifest versionCode/);
    assert.throws(() => parse('94', '  A: android:versionCodeMajor(0x01010576)=4294967296\n'), /Invalid manifest versionCodeMajor/);
    assert.throws(() => parseManifestTree(tree('94').replace(/.*:versionCode\(.*\n/, '')), /Expected one manifest versionCode/);
});

test('native artifact validation propagates manifest inspection failures', async t => {
    const {verifyAndroidNativeLibraries} = await load();
    const f = fixture(t);
    const apk = f.apk('valid.apk', nativeEntries(['x86']));
    assert.throws(() => verifyAndroidNativeLibraries([apk], {abis: ['x86'], readManifest() {throw new Error('aapt2 unavailable');}}), /aapt2 unavailable/);
});
