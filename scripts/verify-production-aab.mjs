import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createWriteStream, readFileSync, statSync} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {Readable, Transform} from 'node:stream';
import {fileURLToPath} from 'node:url';

export const BUILD_ID = 'ee1be7b3-c44c-4956-a1ac-a676243db901';
export const SOURCE_SHA = '956d6bdb0d74ed0f63309cf05592d67086d3a843';
export const PROJECT_ID = '130cfded-cef0-49b3-94a4-82d3a3852ef5';
export const PACKAGE_NAME = 'io.github.kunal26das.yify';
export const VERSION = '1.8.15';
export const VERSION_CODE = '97';
export const RUNTIME = '1.8.15';
export const UPLOAD_CERT_SHA256 = 'EC97730BA790E825A7F777507AA2E7188F7EF2104CF64F9FCCA8BBFF8902E79F';
const MAX_AAB_BYTES = 1024 * 1024 * 1024;

function requireEqual(actual, expected, label) {
    if (actual !== expected) throw new Error(`${label} mismatch`);
}

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options});
    if (result.error || result.status !== 0) throw new Error(`${command} failed`);
    return result.stdout.trim();
}

export function verifyBuildMetadata(build) {
    requireEqual(build?.id, BUILD_ID, 'Build ID');
    requireEqual(build?.status, 'FINISHED', 'Build status');
    requireEqual(build?.platform, 'ANDROID', 'Platform');
    requireEqual(build?.app?.id, PROJECT_ID, 'Expo project ID');
    requireEqual(build?.appIdentifier, PACKAGE_NAME, 'Package');
    requireEqual(build?.buildProfile, 'production', 'Build profile');
    requireEqual(build?.appVersion, VERSION, 'Version');
    requireEqual(String(build?.appBuildVersion), VERSION_CODE, 'Version code');
    requireEqual(build?.runtime?.version, RUNTIME, 'Runtime');
    requireEqual(build?.updateChannel?.name, 'Production', 'Update channel');
    requireEqual(build?.gitCommitHash, SOURCE_SHA, 'Source commit');
    if (typeof build?.fingerprint?.hash !== 'string' || !build.fingerprint.hash) throw new Error('Missing build fingerprint');
    const artifact = build?.artifacts?.buildUrl;
    if (typeof artifact !== 'string') throw new Error('Missing AAB URL');
    const url = new URL(artifact);
    if (!isAllowedArtifactUrl(url)) {
        throw new Error('Unexpected AAB URL host');
    }
    if (!url.pathname.endsWith('.aab')) throw new Error('Build artifact is not an AAB');
    return url;
}

function isAllowedArtifactUrl(url) {
    return url.protocol === 'https:' && !url.username && !url.password &&
        (url.hostname === 'expo.dev' || url.hostname.endsWith('.expo.dev'));
}

export function isAllowedDownloadUrl(url) {
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    return host === 'expo.dev' || host.endsWith('.expo.dev') ||
        host === 'eascdn.net' || host.endsWith('.eascdn.net') ||
        host === 'expousercontent.com' || host.endsWith('.expousercontent.com') ||
        host === 'storage.googleapis.com' || host.endsWith('.storage.googleapis.com') ||
        host === 's3.amazonaws.com' || /^s3\.[a-z0-9-]+\.amazonaws\.com$/.test(host) ||
        /^[a-z0-9.-]+\.s3(?:\.[a-z0-9-]+)?\.amazonaws\.com$/.test(host);
}

export function verifySourceFiles() {
    run('git', ['cat-file', '-e', `${SOURCE_SHA}^{commit}`]);
    const pkg = JSON.parse(run('git', ['show', `${SOURCE_SHA}:package.json`]));
    const app = JSON.parse(run('git', ['show', `${SOURCE_SHA}:app.json`]));
    const eas = JSON.parse(run('git', ['show', `${SOURCE_SHA}:eas.json`]));
    requireEqual(pkg.version, VERSION, 'Source version');
    requireEqual(String(pkg.versionCode), VERSION_CODE, 'Source version code');
    requireEqual(app.expo.android.package, PACKAGE_NAME, 'Source package');
    requireEqual(app.expo.extra.eas.projectId, PROJECT_ID, 'Source project');
    requireEqual(eas.build.production.env.EXPO_UPDATE_CHANNEL, 'Production', 'Source update channel');
    requireEqual(eas.build.production.android.buildType, 'app-bundle', 'Source build type');
    requireEqual(eas.build.production.android.credentialsSource, 'remote', 'Source credential source');
}

export function verifyBundleManifest(xml, runtimeResourceId) {
    const opening = xml.match(/<manifest\b[^>]*>/)?.[0];
    if (!opening) throw new Error('Missing bundle manifest');
    const attr = (element, name) => element.match(new RegExp(`(?:^|\\s)(?:android:)?${name}="([^"]+)"`))?.[1];
    requireEqual(attr(opening, 'package'), PACKAGE_NAME, 'Bundle package');
    requireEqual(attr(opening, 'versionCode'), VERSION_CODE, 'Bundle version code');
    requireEqual(attr(opening, 'versionName'), VERSION, 'Bundle version name');
    const metadata = [...xml.matchAll(/<meta-data\b[^>]*>/g)].map(match => match[0]);
    const entry = name => {
        const matching = metadata.filter(element => attr(element, 'name') === name);
        if (matching.length !== 1) throw new Error(`Bundle metadata mismatch: ${name}`);
        return attr(matching[0], 'value');
    };
    const runtimeReference = entry('expo.modules.updates.EXPO_RUNTIME_VERSION');
    if (runtimeReference !== '@string/expo_runtime_version' &&
        runtimeReference?.toLowerCase() !== `@${runtimeResourceId}` &&
        runtimeReference?.toLowerCase() !== `@ref/${runtimeResourceId}`) throw new Error('Bundle runtime reference mismatch');
    let channel;
    try { channel = JSON.parse(entry('expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY').replaceAll('&quot;', '"')); }
    catch { throw new Error('Invalid bundle update channel metadata'); }
    requireEqual(channel['expo-channel-name'], 'Production', 'Bundle update channel');
}

export function verifyRuntimeResources(resources) {
    if (!resources.includes(`Package '${PACKAGE_NAME}':`)) throw new Error('Bundle runtime resource package mismatch');
    const lines = resources.split(/\r?\n/);
    const headers = lines.flatMap((line, index) => /^0x([0-9a-fA-F]{8}) - string\/expo_runtime_version$/.test(line) ? [index] : []);
    if (headers.length !== 1) throw new Error('Missing unique bundle runtime resource');
    const resourceId = lines[headers[0]].slice(0, 10).toLowerCase();
    const values = [];
    for (const line of lines.slice(headers[0] + 1)) {
        if (/^(?:0x[0-9a-fA-F]{8} - |Package ')/.test(line)) break;
        if (line.includes(' - [')) values.push(line.trim());
    }
    if (!values.length || values.some(value => !value.endsWith(` - [STR] "${RUNTIME}"`))) {
        throw new Error('Bundle runtime resource config mismatch');
    }
    return resourceId;
}

export function verifyCertificate(text) {
    const match = text.match(/SHA256:\s*((?:[0-9A-F]{2}:){31}[0-9A-F]{2})/i);
    if (!match) throw new Error('Missing upload certificate fingerprint');
    requireEqual(match[1].replaceAll(':', '').toUpperCase(), UPLOAD_CERT_SHA256, 'Upload certificate');
}

async function fetchAab(url, path) {
    let response;
    let current = url;
    for (let redirect = 0; redirect <= 5; redirect++) {
        try {
            response = await fetch(current, {redirect: 'manual', signal: AbortSignal.timeout(180000)});
        } catch {
            throw new Error('AAB download failed');
        }
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get('location');
        if (!location) throw new Error('AAB redirect is invalid');
        try { current = new URL(location, current); } catch { throw new Error('AAB redirect is invalid'); }
        if (!isAllowedDownloadUrl(current)) throw new Error('AAB redirect host is not allowed');
    }
    if (!response?.ok || !response.body) throw new Error('AAB download failed');
    if (Number(response.headers.get('content-length')) > MAX_AAB_BYTES) throw new Error('AAB exceeds size limit');
    let size = 0;
    const hash = createHash('sha256');
    const meter = new Transform({transform(chunk, encoding, callback) {
        size += chunk.length;
        if (size > MAX_AAB_BYTES) return callback(new Error('AAB exceeds size limit'));
        hash.update(chunk);
        callback(null, chunk);
    }});
    try {
        await pipeline(Readable.fromWeb(response.body), meter, createWriteStream(path, {mode: 0o600, flags: 'wx'}));
    } catch {
        throw new Error('AAB download failed');
    }
    if (size < 1024 || statSync(path).size !== size) throw new Error('AAB download is incomplete');
    return {size, sha256: hash.digest('hex')};
}

async function main() {
    const [mode, ...args] = process.argv.slice(2);
    if (mode === 'fetch' && args.length === 1) {
        if (!process.env.EXPO_TOKEN) throw new Error('EXPO_TOKEN is unavailable');
        verifySourceFiles();
        const stdout = run('bash', ['scripts/eas.sh', 'build:view', BUILD_ID, '--json'], {
            env: {...process.env, EXPO_TOKEN: process.env.EXPO_TOKEN},
        });
        let build;
        try { build = JSON.parse(stdout); } catch { throw new Error('EAS build metadata is invalid'); }
        const url = verifyBuildMetadata(build);
        const downloaded = await fetchAab(url, args[0]);
        console.log(`Verified exact finished EAS build; AAB bytes ${downloaded.size}; SHA256 ${downloaded.sha256}`);
    } else if (mode === 'bundle' && args.length === 2) {
        const [jar, aab] = args;
        const resources = run('java', ['-jar', jar, 'dump', 'resources', `--bundle=${aab}`, '--resource=string/expo_runtime_version', '--values']);
        const runtimeResourceId = verifyRuntimeResources(resources);
        const manifest = run('java', ['-jar', jar, 'dump', 'manifest', `--bundle=${aab}`]);
        verifyBundleManifest(manifest, runtimeResourceId);
        run('java', ['scripts/VerifySignedAab.java', aab, UPLOAD_CERT_SHA256]);
        verifyCertificate(run('keytool', ['-printcert', '-jarfile', aab]));
        console.log('Verified AAB manifest, runtime resource, every signed entry and upload certificate');
    } else if (mode === 'apks' && args.length === 1) {
        const result = JSON.parse(readFileSync(args[0], 'utf8'));
        requireEqual(result.packageName, PACKAGE_NAME, 'APK package');
        requireEqual(result.longVersionCode, VERSION_CODE, 'APK version code');
        requireEqual(result.extractNativeLibs, true, 'Native extraction');
        console.log('Verified APK package, version code and native extraction');
    } else {
        throw new Error('Usage: verify-production-aab.mjs fetch <aab> | bundle <bundletool.jar> <aab> | apks <native-check.json>');
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main().catch(error => {
        console.error(`Production AAB verification failed: ${error.message}`);
        process.exitCode = 1;
    });
}
