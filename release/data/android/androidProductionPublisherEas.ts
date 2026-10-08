import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import type {AndroidProductionPublisher, OnLine, ReleaseCli, SessionStore, Workspace} from '../../domain/index.js';
import type {CancellationRegistry} from '../process/cancellationRegistry.js';
import {pumpLines} from '../process/linePump.js';

const CHANNEL_METADATA = 'expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY';
const RUNTIME_METADATA = 'expo.modules.updates.EXPO_RUNTIME_VERSION';
const UPDATE_URL_METADATA = 'expo.modules.updates.EXPO_UPDATE_URL';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const require = createRequire(import.meta.url);

function validateProfiles(repoRoot: string, runtimeVersion: string) {
    const easJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'eas.json'), 'utf8'));
    const easRequire = createRequire(require.resolve('eas-cli/package.json'));
    const {resolveBuildProfile} = easRequire('@expo/eas-json/build/build/resolver');
    const {resolveSubmitProfile} = easRequire('@expo/eas-json/build/submit/resolver');
    const build = resolveBuildProfile({easJson, platform: 'android', profileName: 'production'});
    const submit = resolveSubmitProfile({easJson, platform: 'android', profileName: 'play-production'});
    if (easJson.cli?.appVersionSource !== 'local' || !['local', 'remote'].includes(build.credentialsSource) ||
        build.withoutCredentials === true || (build.credentialsSource === 'remote' && build.keystoreName !== undefined) ||
        build.buildType !== 'app-bundle' || build.distribution !== 'store' ||
        build.environment !== 'production' || build.env?.EXPO_UPDATE_CHANNEL !== 'Production' ||
        (build.channel !== undefined && build.channel !== 'Production') ||
        (build.autoIncrement !== undefined && build.autoIncrement !== false) ||
        (build.env?.EXPO_RUNTIME_VERSION !== undefined && build.env.EXPO_RUNTIME_VERSION !== runtimeVersion)) {
        throw new Error('The production EAS build profile must use local versions, local signing or the default Expo keystore, an app bundle, and the Production channel in the production environment without version auto-increment.');
    }
    if (submit.track !== 'production' || submit.releaseStatus !== 'completed') {
        throw new Error('The play-production EAS submit profile must target the production track with completed release status.');
    }
    const key = submit.serviceAccountKeyPath;
    if (key !== undefined) {
        try {
            if (typeof key !== 'string' || !key || !fs.statSync(path.resolve(repoRoot, key)).isFile()) throw new Error();
            const value = JSON.parse(fs.readFileSync(path.resolve(repoRoot, key), 'utf8'));
            if (value?.type !== 'service_account' || typeof value.private_key !== 'string' || !value.private_key.trim() ||
                typeof value.client_email !== 'string' || !value.client_email.trim()) throw new Error();
        } catch {
            throw new Error('The configured Play service-account key file is missing or invalid. Fix serviceAccountKeyPath, or omit it to use the key stored in Expo.');
        }
    }
    return {managedSigning: build.credentialsSource === 'remote', managedSubmission: key === undefined};
}

async function verifyManagedCredentials(repoRoot: string, sessionStore: SessionStore, needs: {
    managedSigning: boolean;
    managedSubmission: boolean;
}): Promise<void> {
    if (!needs.managedSigning && !needs.managedSubmission) return;
    const token = sessionStore.read()?.token;
    if (!token) throw new Error('Sign in to Expo before checking managed Android credentials.');
    const config = JSON.parse(fs.readFileSync(path.join(repoRoot, 'app.json'), 'utf8'));
    const projectId = config?.expo?.extra?.eas?.projectId;
    if (typeof projectId !== 'string' || !UUID.test(projectId)) throw new Error('The Expo project ID is missing or invalid.');
    const gradle = fs.readFileSync(path.join(repoRoot, 'android/app/build.gradle'), 'utf8');
    const identifiers = [...gradle.matchAll(/^[ \t]*applicationId[ \t]+["']([\w.]+)["'][ \t]*(?:\/\/[^\r\n]*)?\r?$/gm)];
    if (identifiers.length !== 1 || /\bapplicationIdSuffix\b|\bproductFlavors\b/.test(gradle)) {
        throw new Error('Could not verify the native Android application ID for managed credentials. Use one literal applicationId without product flavors or suffixes.');
    }
    const applicationId = identifiers[0][1];
    let result: any;
    try {
        const response = await fetch('https://api.expo.dev/graphql', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
            signal: AbortSignal.timeout(30_000),
            body: JSON.stringify({
                query: `query AndroidCredentialPresence($appId: String!, $applicationId: String!) {
                    app { byId(appId: $appId) {
                        id
                        androidAppCredentials(filter: {applicationIdentifier: $applicationId, legacyOnly: false}) {
                            applicationIdentifier
                            isLegacy
                            googleServiceAccountKeyForSubmissions { id }
                            androidAppBuildCredentialsList { isDefault androidKeystore { id } }
                        }
                    } }
                }`,
                variables: {appId: projectId, applicationId},
            }),
        });
        if (!response.ok) throw new Error();
        result = await response.json();
    } catch {
        throw new Error('Could not check Expo-managed Android credentials. Verify the Expo session and network, then retry; no build was started.');
    }
    const app = result?.data?.app?.byId;
    if (result?.errors?.length || app?.id !== projectId || !Array.isArray(app?.androidAppCredentials)) {
        throw new Error('Could not verify managed credentials for this Expo project. Check the account access before retrying.');
    }
    const credentials = app.androidAppCredentials.filter((entry: any) =>
        entry?.applicationIdentifier === applicationId && entry.isLegacy === false);
    if (credentials.length !== 1) {
        throw new Error('Expo has no unambiguous Android credential configuration for this application ID. Configure its existing upload key and Play service account before releasing.');
    }
    const credential = credentials[0];
    if (needs.managedSigning) {
        const defaults = Array.isArray(credential.androidAppBuildCredentialsList)
            ? credential.androidAppBuildCredentialsList.filter((entry: any) => entry?.isDefault === true) : [];
        if (defaults.length !== 1 || typeof defaults[0].androidKeystore?.id !== 'string' || !defaults[0].androidKeystore.id) {
            throw new Error('Expo is missing the default Android upload keystore. Upload and select the existing Play upload key before releasing; do not generate a replacement.');
        }
    }
    if (needs.managedSubmission && (typeof credential.googleServiceAccountKeyForSubmissions?.id !== 'string' ||
        !credential.googleServiceAccountKeyForSubmissions.id)) {
        throw new Error('Expo is missing the Google Play submission service account for this application ID. Assign the existing service account before releasing.');
    }
}

function xmlEncode(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function xmlDecode(value: string): string {
    return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function replaceOne(source: string, pattern: RegExp, replace: (...args: string[]) => string, name: string): string {
    if ([...source.matchAll(pattern)].length !== 1) throw new Error(`Expected exactly one ${name}; update the Android native configuration before publishing.`);
    return source.replace(pattern, replace);
}

function updateMetadata(source: string, name: string, value: (current: string) => string): string {
    const tags = [...source.matchAll(/<meta-data\b[^>]*>/g)].filter(([tag]) =>
        tag.match(/\bandroid:name=(["'])(.*?)\1/)?.[2] === name,
    );
    if (tags.length !== 1) throw new Error(`Expected exactly one Android metadata entry for ${name}.`);
    const tag = tags[0][0];
    const next = replaceOne(tag, /(\bandroid:value=)(["'])(.*?)\2/g,
        (_match, prefix, quote, current) => `${prefix}${quote}${xmlEncode(value(xmlDecode(current)))}${quote}`, name);
    return source.replace(tag, next);
}

function synchronizeNative(repoRoot: string, version: string, runtimeVersion: string): {versionCode: number; projectId: string} {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    if (pkg.version !== version || !/^[\w.+-]+$/.test(version) || !/^[\w.+-]+$/.test(runtimeVersion)) {
        throw new Error('The requested release version must match package.json and have a valid runtime version.');
    }
    const versionCode = pkg.versionCode;
    if (!Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2100000000) {
        throw new Error('package.json must contain a valid Android versionCode.');
    }
    const config = JSON.parse(fs.readFileSync(path.join(repoRoot, 'app.json'), 'utf8'));
    const projectId = config?.expo?.extra?.eas?.projectId;
    if (typeof projectId !== 'string' || !UUID.test(projectId)) throw new Error('The Expo project ID is missing or invalid.');

    const gradlePath = path.join(repoRoot, 'android/app/build.gradle');
    const stringsPath = path.join(repoRoot, 'android/app/src/main/res/values/strings.xml');
    const manifestPath = path.join(repoRoot, 'android/app/src/main/AndroidManifest.xml');
    const gradle = fs.readFileSync(gradlePath, 'utf8');
    const strings = fs.readFileSync(stringsPath, 'utf8');
    const manifest = fs.readFileSync(manifestPath, 'utf8');
    let nextGradle = replaceOne(gradle, /^([ \t]*versionCode[ \t]+)(?:\d+|packageJson\.versionCode)([ \t]*(?:\/\/[^\r\n]*)?\r?)$/gm,
        (_match, prefix, suffix) => `${prefix}${versionCode}${suffix}`, 'Gradle versionCode');
    nextGradle = replaceOne(nextGradle, /^([ \t]*versionName[ \t]+)(?:["'][^"'\r\n]*["']|packageJson\.version)([ \t]*(?:\/\/[^\r\n]*)?\r?)$/gm,
        (_match, prefix, suffix) => `${prefix}${JSON.stringify(version)}${suffix}`, 'Gradle versionName');
    const nextStrings = replaceOne(strings, /(<string\b[^>]*\bname=["']expo_runtime_version["'][^>]*>)[^<]*(<\/string>)/g,
        (_match, prefix, suffix) => `${prefix}${xmlEncode(runtimeVersion)}${suffix}`, 'expo_runtime_version string');
    let nextManifest = updateMetadata(manifest, CHANNEL_METADATA, (current) => {
        const headers = JSON.parse(current);
        if (!headers || typeof headers !== 'object' || Array.isArray(headers)) throw new Error('Invalid Expo update request headers.');
        return JSON.stringify({...headers, 'expo-channel-name': 'Production'});
    });
    nextManifest = updateMetadata(nextManifest, RUNTIME_METADATA, () => '@string/expo_runtime_version');
    nextManifest = updateMetadata(nextManifest, UPDATE_URL_METADATA, () => `https://u.expo.dev/${projectId}`);
    for (const [file, before, after] of [[gradlePath, gradle, nextGradle], [stringsPath, strings, nextStrings], [manifestPath, manifest, nextManifest]]) {
        if (before !== after) fs.writeFileSync(file, after);
    }
    return {versionCode, projectId};
}

function acceptedRelease(output: string, expected: {
    version: string;
    runtimeVersion: string;
    versionCode: number;
    projectId: string
}) {
    const parsed: unknown = JSON.parse(output.trim());
    const builds = Array.isArray(parsed) ? parsed : [parsed];
    if (builds.length !== 1 || !builds[0] || typeof builds[0] !== 'object') throw new Error('EAS did not return exactly one build.');
    const build = builds[0];
    if (typeof build.id !== 'string' || !UUID.test(build.id)) throw new Error('EAS returned an invalid build ID.');
    if (!['NEW', 'IN_QUEUE', 'IN_PROGRESS', 'FINISHED'].includes(build.status)) {
        throw new Error(`EAS build ${build.id} is ${String(build.status)}.`);
    }
    const checks: Array<[string, unknown, unknown]> = [
        ['platform', build.platform, 'ANDROID'],
        ['distribution', build.distribution, 'STORE'],
        ['build profile', build.buildProfile, 'production'],
        ['channel', build.updateChannel?.name, 'Production'],
        ['version', build.appVersion, expected.version],
        ['version code', build.appBuildVersion, String(expected.versionCode)],
        ['runtime version', build.runtime?.version, expected.runtimeVersion],
        ['Expo project', build.app?.id, expected.projectId],
    ];
    for (const [name, actual, wanted] of checks) {
        if (actual !== wanted) throw new Error(`Could not verify build ${build.id}: ${name} is ${String(actual)}, expected ${wanted}.`);
    }
    if (!Array.isArray(build.submissions) || build.submissions.length !== 1) {
        throw new Error(`EAS build ${build.id} did not return exactly one scheduled Play submission.`);
    }
    const submission = build.submissions[0];
    if (!submission || typeof submission.id !== 'string' || !UUID.test(submission.id) ||
        !['AWAITING_BUILD', 'IN_QUEUE', 'IN_PROGRESS', 'FINISHED'].includes(submission.status) ||
        submission.platform !== 'ANDROID' || submission.app?.id !== expected.projectId ||
        submission.androidConfig?.track !== 'production' || submission.androidConfig?.releaseStatus !== 'COMPLETED') {
        throw new Error(`Could not verify the scheduled Play production submission for build ${build.id}.`);
    }
    const owner = build.app?.ownerAccount?.name;
    const slug = build.app?.slug;
    if (typeof owner !== 'string' || !owner || typeof slug !== 'string' || !slug) {
        throw new Error(`EAS build ${build.id} did not return its project URL details.`);
    }
    const projectUrl = `https://expo.dev/accounts/${encodeURIComponent(owner)}/projects/${encodeURIComponent(slug)}`;
    return {
        buildId: build.id as string,
        submissionId: submission.id as string,
        buildUrl: `${projectUrl}/builds/${build.id}`,
        submissionUrl: `${projectUrl}/submissions/${submission.id}`,
    };
}

export function createAndroidProductionPublisher(deps: {
    workspace: Workspace;
    cancellation: CancellationRegistry;
    cli: ReleaseCli;
    sessionStore: SessionStore;
}): AndroidProductionPublisher {
    const {workspace, cancellation, cli, sessionStore} = deps;

    function prepareCredentials(onLine: OnLine, label?: string): Promise<boolean> {
        return new Promise((resolve) => {
            if (cancellation.isCancelling()) return resolve(false);
            const child = spawn('bash', ['scripts/setup-eas-credentials.sh'], {cwd: workspace.repoRoot, env: process.env});
            cancellation.track(child);
            let finished = false;
            const finish = (ok: boolean) => {
                if (finished) return;
                finished = true;
                resolve(ok);
            };
            const emit = (stream: 'stdout' | 'stderr', text: string) => onLine({stream, text, label});
            pumpLines('stdout', child.stdout, {onLine: emit});
            pumpLines('stderr', child.stderr, {onLine: emit});
            child.once('error', (error) => {
                emit('stderr', `Could not prepare EAS credentials: ${error.message}`);
                finish(false);
            });
            child.once('close', (code) => finish(code === 0));
        });
    }

    async function release(version: string, runtimeVersion: string, onLine: OnLine, label?: string) {
        let remoteStarted = false;
        const cancelled = () => {
            if (!cancellation.isCancelling()) return false;
            if (remoteStarted) onLine({
                stream: 'system',
                text: 'Local handoff cancelled. Remote EAS build or submission work may continue; inspect the EAS dashboard before retrying.',
                label
            });
            return true;
        };
        try {
            if (cancelled()) return {ok: false};
            const credentials = validateProfiles(workspace.repoRoot, runtimeVersion);
            await verifyManagedCredentials(workspace.repoRoot, sessionStore, credentials);
            if (cancelled()) return {ok: false};
            const expected = synchronizeNative(workspace.repoRoot, version, runtimeVersion);
            onLine({stream: 'system', text: `Preparing Expo Production build ${version} (${expected.versionCode}), runtime ${runtimeVersion}.`, label});
            if (cancelled()) return {ok: false};
            const credentialsReady = credentials.managedSigning || await prepareCredentials(onLine, label);
            if (cancelled() || !credentialsReady) return {ok: false};

            const stdout: string[] = [];
            remoteStarted = true;
            const queued = await cli.run(['build', '--platform', 'android', '--profile', 'production', '--auto-submit-with-profile', 'play-production', '--non-interactive', '--no-wait', '--json'], (line) => {
                if (line.stream === 'stdout') stdout.push(line.text);
                else onLine(line);
            }, {label, retries: 0, idleTimeoutMs: 0});
            if (cancelled()) return {ok: false};
            if (!queued.ok) {
                onLine({
                    stream: 'stderr',
                    text: 'Could not confirm the Expo handoff. Remote work may already exist; inspect the EAS dashboard before retrying.',
                    label
                });
                return {ok: false};
            }
            const receipt = acceptedRelease(stdout.join('\n'), {version, runtimeVersion, ...expected});
            onLine({
                stream: 'system',
                text: `Queued on Expo. Build and Play upload will continue remotely.\nBuild: ${receipt.buildUrl}\nPlay upload: ${receipt.submissionUrl}`,
                label
            });
            return {ok: true, ...receipt};
        } catch (error) {
            onLine({stream: 'stderr', text: error instanceof Error ? error.message : String(error), label});
            if (remoteStarted) onLine({
                stream: 'stderr',
                text: 'Remote work may already exist; inspect the EAS dashboard before retrying.',
                label
            });
            return {ok: false};
        }
    }

    return {release};
}
