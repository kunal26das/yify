import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createWriteStream, readFileSync, statSync} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {Readable, Transform} from 'node:stream';
import {fileURLToPath} from 'node:url';

const MAX_AAB_BYTES = 1024 * 1024 * 1024;
const CANDIDATE_FIELDS = ['buildId', 'sourceSha', 'aabSha256', 'projectId', 'packageName', 'version', 'versionCode', 'runtime', 'uploadCertSha256'];

export function validateCandidate(candidate) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) ||
        Object.keys(candidate).sort().join(',') !== [...CANDIDATE_FIELDS].sort().join(',')) {
        throw new Error('Candidate identity fields are incomplete or unexpected');
    }
    for (const field of CANDIDATE_FIELDS) {
        if (typeof candidate[field] !== 'string' || !candidate[field]) throw new Error(`Invalid candidate ${field}`);
    }
    if (!/^[0-9a-f]{40}$/.test(candidate.sourceSha) || !/^[0-9a-f]{64}$/.test(candidate.aabSha256) ||
        !/^[0-9A-F]{64}$/.test(candidate.uploadCertSha256) || !/^[1-9][0-9]*$/.test(candidate.versionCode) ||
        !/^[0-9a-f-]{36}$/.test(candidate.buildId) || !/^[0-9a-f-]{36}$/.test(candidate.projectId)) {
        throw new Error('Candidate identity has invalid format');
    }
    return candidate;
}

export function loadCandidate(path) {
    return validateCandidate(JSON.parse(readFileSync(path, 'utf8')));
}

export function verifyAabHash(path, candidate) {
    const bytes = readFileSync(path);
    if (bytes.length < 1024 || bytes.length > MAX_AAB_BYTES) throw new Error('AAB size is invalid');
    const actual = createHash('sha256').update(bytes).digest('hex');
    requireEqual(actual, candidate.aabSha256, 'AAB SHA256');
    return actual;
}

function requireEqual(actual, expected, label) {
    if (actual !== expected) throw new Error(`${label} mismatch`);
}

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options});
    if (result.error || result.status !== 0) throw new Error(`${command} failed`);
    return result.stdout.trim();
}

export function verifyBuildMetadata(build, candidate) {
    validateCandidate(candidate);
    requireEqual(build?.id, candidate.buildId, 'Build ID');
    requireEqual(build?.status, 'FINISHED', 'Build status');
    requireEqual(build?.platform, 'ANDROID', 'Platform');
    requireEqual(build?.app?.id, candidate.projectId, 'Expo project ID');
    requireEqual(build?.appIdentifier, candidate.packageName, 'Package');
    requireEqual(build?.buildProfile, 'production', 'Build profile');
    requireEqual(build?.appVersion, candidate.version, 'Version');
    requireEqual(String(build?.appBuildVersion), candidate.versionCode, 'Version code');
    requireEqual(build?.runtime?.version, candidate.runtime, 'Runtime');
    requireEqual(build?.updateChannel?.name, 'Production', 'Update channel');
    requireEqual(build?.gitCommitHash, candidate.sourceSha, 'Source commit');
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

export function verifySourceFiles(candidate) {
    validateCandidate(candidate);
    run('git', ['cat-file', '-e', `${candidate.sourceSha}^{commit}`]);
    const pkg = JSON.parse(run('git', ['show', `${candidate.sourceSha}:package.json`]));
    const app = JSON.parse(run('git', ['show', `${candidate.sourceSha}:app.json`]));
    const eas = JSON.parse(run('git', ['show', `${candidate.sourceSha}:eas.json`]));
    requireEqual(pkg.version, candidate.version, 'Source version');
    requireEqual(String(pkg.versionCode), candidate.versionCode, 'Source version code');
    requireEqual(app.expo.android.package, candidate.packageName, 'Source package');
    requireEqual(app.expo.extra.eas.projectId, candidate.projectId, 'Source project');
    requireEqual(eas.build.production.env.EXPO_UPDATE_CHANNEL, 'Production', 'Source update channel');
    requireEqual(eas.build.production.android.buildType, 'app-bundle', 'Source build type');
    requireEqual(eas.build.production.android.credentialsSource, 'remote', 'Source credential source');
}

export function verifyBundleManifest(xml, runtimeResourceId, candidate) {
    const opening = xml.match(/<manifest\b[^>]*>/)?.[0];
    if (!opening) throw new Error('Missing bundle manifest');
    const attr = (element, name) => element.match(new RegExp(`(?:^|\\s)(?:android:)?${name}="([^"]+)"`))?.[1];
    requireEqual(attr(opening, 'package'), candidate.packageName, 'Bundle package');
    requireEqual(attr(opening, 'versionCode'), candidate.versionCode, 'Bundle version code');
    requireEqual(attr(opening, 'versionName'), candidate.version, 'Bundle version name');
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

export function verifyRuntimeResources(resources, candidate) {
    if (!resources.includes(`Package '${candidate.packageName}':`)) throw new Error('Bundle runtime resource package mismatch');
    const lines = resources.split(/\r?\n/);
    const headers = lines.flatMap((line, index) => /^0x([0-9a-fA-F]{8}) - string\/expo_runtime_version$/.test(line) ? [index] : []);
    if (headers.length !== 1) throw new Error('Missing unique bundle runtime resource');
    const resourceId = lines[headers[0]].slice(0, 10).toLowerCase();
    const values = [];
    for (const line of lines.slice(headers[0] + 1)) {
        if (/^(?:0x[0-9a-fA-F]{8} - |Package ')/.test(line)) break;
        if (line.includes(' - [')) values.push(line.trim());
    }
    if (!values.length || values.some(value => !value.endsWith(` - [STR] "${candidate.runtime}"`))) {
        throw new Error('Bundle runtime resource config mismatch');
    }
    return resourceId;
}

export function verifyCertificate(text, candidate) {
    const match = text.match(/SHA256:\s*((?:[0-9A-F]{2}:){31}[0-9A-F]{2})/i);
    if (!match) throw new Error('Missing upload certificate fingerprint');
    requireEqual(match[1].replaceAll(':', '').toUpperCase(), candidate.uploadCertSha256, 'Upload certificate');
}

export function verifyApkResult(result, candidate) {
    requireEqual(result.packageName, candidate.packageName, 'APK package');
    requireEqual(result.longVersionCode, candidate.versionCode, 'APK version code');
    requireEqual(result.extractNativeLibs, true, 'Native extraction');
    if (!Array.isArray(result.artifacts) || !result.artifacts.length ||
        result.artifacts.some(artifact => !/^[0-9a-f]{64}$/.test(artifact.sha256))) throw new Error('Missing APK hashes');
}

export function verifyInstallEvidence(apkResult, installedHashes, signers, packageDump, candidate) {
    verifyApkResult(apkResult, candidate);
    const generated = apkResult.artifacts.map(artifact => artifact.sha256).sort();
    if (JSON.stringify([...installedHashes].sort()) !== JSON.stringify(generated)) {
        throw new Error('Installed APK bytes differ from generated APKs');
    }
    if (!packageDump.includes(`versionCode=${candidate.versionCode} `) ||
        !packageDump.includes(`versionName=${candidate.version}`)) throw new Error('Installed version mismatch');
    const normalized = signers.map(value => value.toLowerCase());
    if (normalized.length !== generated.length || normalized.some(value => !/^[0-9a-f]{64}$/.test(value)) ||
        new Set(normalized).size !== 1 || normalized[0].toUpperCase() === candidate.uploadCertSha256) {
        throw new Error('Ephemeral APK signer mismatch');
    }
    return normalized[0];
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
    const [mode, candidatePath, ...args] = process.argv.slice(2);
    if (!candidatePath) throw new Error('Expected candidate manifest path');
    const candidate = loadCandidate(candidatePath);
    if (mode === 'candidate' && args.length === 0) {
        verifySourceFiles(candidate);
        console.log(`Trusted candidate ${candidate.buildId}; source ${candidate.sourceSha}; AAB SHA256 ${candidate.aabSha256}`);
    } else if (mode === 'fetch' && args.length === 1) {
        if (!process.env.EXPO_TOKEN) throw new Error('EXPO_TOKEN is unavailable');
        verifySourceFiles(candidate);
        const stdout = run('bash', ['scripts/eas.sh', 'build:view', candidate.buildId, '--json'], {
            env: {...process.env, EXPO_TOKEN: process.env.EXPO_TOKEN},
        });
        let build;
        try { build = JSON.parse(stdout); } catch { throw new Error('EAS build metadata is invalid'); }
        const url = verifyBuildMetadata(build, candidate);
        const downloaded = await fetchAab(url, args[0]);
        requireEqual(downloaded.sha256, candidate.aabSha256, 'AAB SHA256');
        console.log(`Verified exact finished EAS build; AAB bytes ${downloaded.size}; SHA256 ${downloaded.sha256}`);
    } else if (mode === 'bundle' && args.length === 2) {
        const [jar, aab] = args;
        verifyAabHash(aab, candidate);
        const resources = run('java', ['-jar', jar, 'dump', 'resources', `--bundle=${aab}`, '--resource=string/expo_runtime_version', '--values']);
        const runtimeResourceId = verifyRuntimeResources(resources, candidate);
        const manifest = run('java', ['-jar', jar, 'dump', 'manifest', `--bundle=${aab}`]);
        verifyBundleManifest(manifest, runtimeResourceId, candidate);
        run('java', ['scripts/VerifySignedAab.java', aab, candidate.uploadCertSha256]);
        verifyCertificate(run('keytool', ['-printcert', '-jarfile', aab]), candidate);
        console.log('Verified AAB manifest, runtime resource, every signed entry and upload certificate');
    } else if (mode === 'apks' && args.length === 2) {
        verifyAabHash(args[0], candidate);
        const result = JSON.parse(readFileSync(args[1], 'utf8'));
        verifyApkResult(result, candidate);
        console.log('Verified APK package, version code and native extraction');
    } else {
        throw new Error('Usage: verify-production-aab.mjs <fetch|bundle|apks> <candidate.json> <mode arguments>');
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main().catch(error => {
        console.error(`Production AAB verification failed: ${error.message}`);
        process.exitCode = 1;
    });
}
