import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inflateRawSync} from 'node:zlib';

const ABI_ELF = {'armeabi-v7a': [1, 40], 'arm64-v8a': [2, 183], x86: [1, 3], x86_64: [2, 62]};
const REQUIRED_LIBRARIES = ['libreactnative.so', 'libc++_shared.so', 'libhermesvm.so'];
const CRC_TABLE = Array.from({length: 256}, (_, value) => {
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
});

function crc32(bytes) {
    let value = 0xffffffff;
    for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 255] ^ (value >>> 8);
    return (value ^ 0xffffffff) >>> 0;
}

function zipEntries(bytes) {
    let end = -1;
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
        if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) {
            end = offset;
            break;
        }
    }
    if (end < 0) throw new Error('Missing ZIP directory');
    const count = bytes.readUInt16LE(end + 10);
    const size = bytes.readUInt32LE(end + 12);
    const start = bytes.readUInt32LE(end + 16);
    if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) || bytes.readUInt16LE(end + 8) !== count ||
        count === 65535 || start === 0xffffffff || size === 0xffffffff || start + size !== end) {
        throw new Error('Unsupported or inconsistent ZIP directory');
    }
    const entries = new Map();
    let offset = start;
    for (let index = 0; index < count; index++) {
        if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP entry');
        const flags = bytes.readUInt16LE(offset + 8);
        const method = bytes.readUInt16LE(offset + 10);
        const crc = bytes.readUInt32LE(offset + 16);
        const compressedSize = bytes.readUInt32LE(offset + 20);
        const size = bytes.readUInt32LE(offset + 24);
        const nameLength = bytes.readUInt16LE(offset + 28);
        const extraLength = bytes.readUInt16LE(offset + 30);
        const commentLength = bytes.readUInt16LE(offset + 32);
        const local = bytes.readUInt32LE(offset + 42);
        const next = offset + 46 + nameLength + extraLength + commentLength;
        if (next > end || flags & 1 || bytes.readUInt16LE(offset + 34) || local + 30 > start ||
            compressedSize === 0xffffffff || size === 0xffffffff) throw new Error('Unsupported ZIP entry');
        const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLength);
        const name = nameBytes.toString('utf8');
        if (entries.has(name) || name.includes('\0')) throw new Error('Duplicate or invalid ZIP name');
        if (bytes.readUInt32LE(local) !== 0x04034b50 || bytes.readUInt16LE(local + 6) !== flags ||
            bytes.readUInt16LE(local + 8) !== method || bytes.readUInt16LE(local + 26) !== nameLength ||
            !bytes.subarray(local + 30, local + 30 + nameLength).equals(nameBytes)) throw new Error('ZIP headers disagree');
        const dataOffset = local + 30 + nameLength + bytes.readUInt16LE(local + 28);
        if (dataOffset + compressedSize > start) throw new Error('ZIP entry exceeds data area');
        entries.set(name, {method, crc, size, compressed: bytes.subarray(dataOffset, dataOffset + compressedSize)});
        offset = next;
    }
    if (offset !== end) throw new Error('ZIP directory size disagrees');
    return entries;
}

function readEntry(entry) {
    if (entry.size === 0 || entry.size > 256 * 1024 * 1024) throw new Error('Invalid native library size');
    const bytes = entry.method === 8
        ? inflateRawSync(entry.compressed, {maxOutputLength: entry.size})
        : entry.method === 0 ? entry.compressed : null;
    if (!bytes || bytes.length !== entry.size || crc32(bytes) !== entry.crc) throw new Error('Invalid ZIP payload');
    return bytes;
}

export function parseManifestTree(tree) {
    const lines = tree.split(/\r?\n/);
    function attributes(element) {
        const matches = lines.flatMap((line, index) => new RegExp(`^\\s*E: ${element}(?: |$)`).test(line) ? [index] : []);
        if (matches.length !== 1) throw new Error(`Expected one manifest ${element} element`);
        const index = matches[0];
        const indent = lines[index].match(/^\s*/)[0].length;
        const found = [];
        for (const line of lines.slice(index + 1)) {
            const depth = line.match(/^\s*/)[0].length;
            if (line.trim() && depth <= indent) break;
            if (depth === indent + 2 && /^\s*A: /.test(line)) found.push(line.trim());
        }
        return found;
    }
    const root = attributes('manifest');
    const application = attributes('application');
    const packageName = root.find(line => /^A: package=/.test(line))?.match(/="([^"\r\n]+)"/)?.[1];
    if (!packageName) throw new Error('Missing manifest package');
    const split = root.find(line => /^A: split=/.test(line))?.match(/="([^"\r\n]*)"/)?.[1] ?? '';
    const extraction = application.filter(line => /^A: (?:android|http:\/\/schemas\.android\.com\/apk\/res\/android):extractNativeLibs(?:\(|=)/.test(line));
    if (extraction.length > 1) throw new Error('Duplicate native extraction attribute');
    let extractNativeLibs;
    if (extraction.length) {
        const value = extraction[0].split('=').slice(1).join('=').trim();
        if (/^(?:true|\(type 0x12\)0xffffffff)$/.test(value)) extractNativeLibs = true;
        else if (/^(?:false|\(type 0x12\)0x0)$/.test(value)) extractNativeLibs = false;
        else throw new Error('Invalid native extraction attribute');
    }
    return {packageName, split, extractNativeLibs};
}

function manifestFromAapt(apk, aapt2) {
    return parseManifestTree(execFileSync(aapt2, ['dump', 'xmltree', apk, '--file', 'AndroidManifest.xml'], {
        encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    }));
}

export function verifyAndroidNativeLibraries(apks, {abis, aapt2 = 'aapt2', readManifest = manifestFromAapt} = {}) {
    if (!apks?.length || !abis?.length || new Set(abis).size !== abis.length ||
        abis.some(abi => !Object.hasOwn(ABI_ELF, abi))) throw new Error('Supply APKs and an explicit supported ABI list');
    const libraries = new Map();
    const splits = new Set();
    const artifacts = [];
    let packageName;
    let bases = 0;
    for (const apk of apks) {
        const bytes = readFileSync(apk);
        const entries = zipEntries(bytes);
        if (!entries.has('AndroidManifest.xml')) throw new Error('APK has no Android manifest');
        const manifest = readManifest(apk, aapt2);
        packageName ??= manifest.packageName;
        if (packageName !== manifest.packageName || splits.has(manifest.split)) throw new Error('APKs do not form one package and split set');
        splits.add(manifest.split);
        if (!manifest.split) {
            bases++;
            if (manifest.extractNativeLibs !== true) throw new Error('Base APK must enable extractNativeLibs');
        } else if (manifest.extractNativeLibs === false) throw new Error('Split APK disables native extraction');
        let count = 0;
        for (const [name, entry] of entries) {
            const match = /^lib\/([^/]+)\/([^/]+\.so)$/.exec(name);
            if (!match) continue;
            const [, abi, library] = match;
            if (!abis.includes(abi)) throw new Error(`Unexpected packaged ABI: ${abi}`);
            if (entry.method !== 8) throw new Error(`Native library must be compressed: ${name}`);
            const payload = readEntry(entry);
            const [elfClass, machine] = ABI_ELF[abi];
            if (payload.length < (elfClass === 2 ? 64 : 52) || !payload.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70])) ||
                payload[4] !== elfClass || payload[5] !== 1 || payload[6] !== 1 ||
                payload.readUInt16LE(16) !== 3 || payload.readUInt16LE(18) !== machine) {
                throw new Error(`Native library ELF does not match ABI: ${name}`);
            }
            const names = libraries.get(abi) ?? new Set();
            if (names.has(library)) throw new Error(`Duplicate native library across APKs: ${name}`);
            names.add(library);
            libraries.set(abi, names);
            count++;
        }
        artifacts.push({path: resolve(apk), sha256: createHash('sha256').update(bytes).digest('hex'), split: manifest.split, nativeLibraries: count});
    }
    if (bases !== 1) throw new Error('Supply exactly one base APK with its selected splits');
    for (const abi of abis) {
        for (const library of REQUIRED_LIBRARIES) {
            if (!libraries.get(abi)?.has(library)) throw new Error(`Missing required native library: lib/${abi}/${library}`);
        }
    }
    return {packageName, extractNativeLibs: true, abis: Object.fromEntries(abis.map(abi => [abi, libraries.get(abi).size])), artifacts};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const args = process.argv.slice(2);
        const apks = [];
        let abis;
        let aapt2;
        while (args.length) {
            const value = args.shift();
            if (value === '--abis') abis = args.shift()?.split(',');
            else if (value === '--aapt2') aapt2 = args.shift();
            else if (value.startsWith('-')) throw new Error(`Unknown option: ${value}`);
            else apks.push(value);
        }
        console.log(JSON.stringify(verifyAndroidNativeLibraries(apks, {abis, aapt2}), null, 2));
    } catch (error) {
        console.error(`Android native library verification failed: ${error.message}`);
        console.error('Usage: node scripts/check-android-native-libs.mjs --abis arm64-v8a [--aapt2 path] base.apk [split.apk ...]');
        process.exitCode = 1;
    }
}
