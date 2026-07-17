import {spawn, spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import type {AndroidArtifacts, AndroidPublisher, OnLine, Workspace,} from '../../domain/index.js';
import {pumpLines} from '../process/linePump.js';
import type {CancellationRegistry} from '../process/cancellationRegistry.js';

const PLAY_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const FIREBASE_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const PUBLISHER_BASE =
    'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const PUBLISHER_UPLOAD =
    'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications';
const FAD_BASE = 'https://firebaseappdistribution.googleapis.com/v1';
const FAD_UPLOAD = 'https://firebaseappdistribution.googleapis.com/upload/v1';
const FIREBASE_GROUP = process.env.REVOPUSH_FIREBASE_GROUP || 'yify';

const APK_REL = 'app/build/outputs/apk/release/app-release.apk';
const AAB_REL = 'app/build/outputs/bundle/release/app-release.aab';

interface ServiceAccount {
    client_email: string;
    private_key: string;
    token_uri?: string;
}

function serviceAccountPath(): string {
    return (
        process.env.REVOPUSH_PLAY_SERVICE_ACCOUNT ||
        path.join(os.homedir(), '.config', 'play-publisher', 'yify-service-account.json')
    );
}

function firebaseServiceAccountPath(): string {
    return (
        process.env.REVOPUSH_FIREBASE_SERVICE_ACCOUNT ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        path.join(os.homedir(), '.config', 'firebase', 'yify-service-account.json')
    );
}

export function createAndroidPublisher(deps: {
    workspace: Workspace;
    cancellation: CancellationRegistry;
}): AndroidPublisher {
    const {workspace, cancellation} = deps;
    const repoRoot = workspace.repoRoot;
    const androidDir = path.join(repoRoot, 'android');

    function packageName(): string {
        const appJson = JSON.parse(
            fs.readFileSync(path.join(repoRoot, 'app.json'), 'utf8'),
        );
        const pkg = appJson?.expo?.android?.package;
        if (!pkg) throw new Error('expo.android.package not found in app.json.');
        return String(pkg);
    }

    function appVersion(): string {
        try {
            const appJson = JSON.parse(
                fs.readFileSync(path.join(repoRoot, 'app.json'), 'utf8'),
            );
            return String(appJson?.expo?.version || '').trim();
        } catch {
            return '';
        }
    }

    function releaseNotes(): string {
        const v = appVersion();
        return v
            ? `Yify Staging v${v} — RevoPush base release`
            : 'Yify Staging — RevoPush base release';
    }

    function firebaseAppRef(): { appId: string; projectNumber: string } {
        const envAppId = process.env.REVOPUSH_FIREBASE_APP_ID;
        const envNumber = process.env.REVOPUSH_FIREBASE_PROJECT_NUMBER;
        if (envAppId && envNumber) {
            return {appId: envAppId, projectNumber: envNumber};
        }
        const candidates = [
            path.join(androidDir, 'app', 'google-services.json'),
            path.join(repoRoot, 'config', 'android', 'google-services.json'),
        ];
        const gsPath = candidates.find((p) => fs.existsSync(p));
        if (!gsPath) {
            throw new Error(
                'google-services.json not found (looked in android/app and config/android). Set REVOPUSH_FIREBASE_APP_ID and REVOPUSH_FIREBASE_PROJECT_NUMBER.',
            );
        }
        const gs = JSON.parse(fs.readFileSync(gsPath, 'utf8'));
        const projectNumber =
            envNumber || gs?.project_info?.project_number;
        const client = (gs?.client || []).find(
            (c: any) => c?.client_info?.mobilesdk_app_id,
        );
        const appId = envAppId || client?.client_info?.mobilesdk_app_id;
        if (!appId || !projectNumber) {
            throw new Error(
                'Could not read mobilesdk_app_id / project_number from google-services.json.',
            );
        }
        return {appId: String(appId), projectNumber: String(projectNumber)};
    }

    function keytoolBin(): string {
        const home = process.env.JAVA_HOME;
        if (home) {
            const candidate = path.join(home, 'bin', 'keytool');
            if (fs.existsSync(candidate)) return candidate;
        }
        return 'keytool';
    }

    function signerSha1(args: string[]): string | null {
        try {
            const res = spawnSync(keytoolBin(), args, {encoding: 'utf8'});
            if (res.status !== 0 || !res.stdout) return null;
            const m = res.stdout.match(/SHA1:\s*([0-9A-Fa-f:]+)/);
            return m ? m[1].toUpperCase() : null;
        } catch {
            return null;
        }
    }

    function ensureReleaseSigning(onLine: OnLine, label?: string): boolean {
        const propsPath = path.join(androidDir, 'keystore.properties');
        const script = path.join(repoRoot, 'scripts', 'setup-android-signing.sh');
        if (fs.existsSync(script)) {
            const res = spawnSync('bash', [script], {
                cwd: repoRoot,
                env: process.env,
                encoding: 'utf8',
            });
            const out = `${res.stdout || ''}${res.stderr || ''}`.trim();
            if (out) {
                onLine({
                    stream: res.status === 0 ? 'system' : 'stderr',
                    text: out,
                    label,
                });
            }
            if (res.status !== 0 && !fs.existsSync(propsPath)) {
                onLine({
                    stream: 'stderr',
                    text: `Release signing not configured (${path.basename(script)} failed and ${propsPath} is missing). Aborting to avoid a debug-signed AAB.`,
                    label,
                });
                return false;
            }
            return true;
        }
        if (!fs.existsSync(propsPath)) {
            onLine({
                stream: 'stderr',
                text: `Release signing not configured: ${propsPath} is missing and scripts/setup-android-signing.sh was not found. A release build would be debug-signed and rejected by Play. Aborting.`,
                label,
            });
            return false;
        }
        return true;
    }

    // After building, refuse to proceed if the AAB was signed with the debug key
    // (the exact failure that yields Play's 403). Fails locally and instantly
    // instead of after a multi-minute upload.
    function assertNotDebugSigned(
        aabPath: string,
        onLine: OnLine,
        label?: string,
    ): boolean {
        const aabSha1 = signerSha1(['-printcert', '-jarfile', aabPath]);
        if (!aabSha1) {
            onLine({
                stream: 'stderr',
                text: 'Warning: could not read AAB signer certificate (keytool unavailable?). Skipping the signing check.',
                label,
            });
            return true;
        }
        const debugSha1 = signerSha1([
            '-list', '-v',
            '-keystore', path.join(androidDir, 'app', 'debug.keystore'),
            '-storepass', 'android',
            '-alias', 'androiddebugkey',
        ]);
        if (debugSha1 && aabSha1 === debugSha1) {
            onLine({
                stream: 'stderr',
                text: `Refusing to publish: the release AAB is signed with the DEBUG key (SHA1 ${aabSha1}). android/keystore.properties is missing or wrong — run scripts/setup-android-signing.sh and rebuild.`,
                label,
            });
            return false;
        }
        onLine({
            stream: 'system',
            text: `Release AAB signer verified (SHA1 ${aabSha1}).`,
            label,
        });
        return true;
    }

    function build(onLine: OnLine, label?: string): Promise<{
        ok: boolean;
        artifacts?: AndroidArtifacts;
    }> {
        return new Promise((resolve) => {
            if (cancellation.isCancelling()) {
                resolve({ok: false});
                return;
            }
            const gradlew = path.join(androidDir, 'gradlew');
            if (!fs.existsSync(gradlew)) {
                onLine({
                    stream: 'stderr',
                    text: `Cannot build: ${gradlew} not found. Run an Expo prebuild first.`,
                    label,
                });
                resolve({ok: false});
                return;
            }

            if (!ensureReleaseSigning(onLine, label)) {
                resolve({ok: false});
                return;
            }

            onLine({
                stream: 'system',
                text: `$ ./gradlew assembleRelease bundleRelease  (cwd: ${androidDir})`,
                label,
            });

            const child = spawn(
                gradlew,
                ['assembleRelease', 'bundleRelease'],
                {cwd: androidDir, env: process.env},
            );
            cancellation.track(child);

            const pump = (
                streamType: 'stdout' | 'stderr',
                stream: NodeJS.ReadableStream | null,
            ) =>
                pumpLines(streamType, stream, {
                    onLine: (s, text) => onLine({stream: s, text, label}),
                });
            pump('stdout', child.stdout);
            pump('stderr', child.stderr);

            child.on('error', (err) => {
                onLine({
                    stream: 'stderr',
                    text: `Failed to start gradle build: ${err.message}`,
                    label,
                });
                resolve({ok: false});
            });
            child.on('close', (code) => {
                const exit = code ?? 1;
                if (exit !== 0) {
                    onLine({
                        stream: 'system',
                        text: `gradle build exited with code ${exit}`,
                        label,
                    });
                    resolve({ok: false});
                    return;
                }
                const apkPath = path.join(androidDir, APK_REL);
                const aabPath = path.join(androidDir, AAB_REL);
                const missing = [apkPath, aabPath].filter((p) => !fs.existsSync(p));
                if (missing.length) {
                    onLine({
                        stream: 'stderr',
                        text: `Build succeeded but artifacts missing: ${missing
                            .map((p) => path.basename(p))
                            .join(', ')}.`,
                        label,
                    });
                    resolve({ok: false});
                    return;
                }
                if (!assertNotDebugSigned(aabPath, onLine, label)) {
                    resolve({ok: false});
                    return;
                }
                onLine({
                    stream: 'system',
                    text: `Built APK + AAB:\n  ${apkPath}\n  ${aabPath}`,
                    label,
                });
                resolve({ok: true, artifacts: {apkPath, aabPath}});
            });
        });
    }

    function b64url(input: string): string {
        return Buffer.from(input).toString('base64url');
    }

    function uploadBundle(
        url: string,
        token: string,
        filePath: string,
        extraHeaders: Record<string, string> = {},
    ): Promise<{ status: number; body: string }> {
        return new Promise((resolve, reject) => {
            const u = new URL(url);
            const req = https.request(
                {
                    method: 'POST',
                    hostname: u.hostname,
                    path: u.pathname + u.search,
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/octet-stream',
                        'Content-Length': fs.statSync(filePath).size,
                        ...extraHeaders,
                    },
                },
                (res) => {
                    let data = '';
                    res.setEncoding('utf8');
                    res.on('data', (d) => (data += d));
                    res.on('end', () =>
                        resolve({status: res.statusCode ?? 0, body: data}),
                    );
                },
            );
            req.on('error', reject);
            const stream = fs.createReadStream(filePath);
            stream.on('error', reject);
            stream.pipe(req);
        });
    }

    async function getAccessToken(
        sa: ServiceAccount,
        scope: string,
    ): Promise<string> {
        const now = Math.floor(Date.now() / 1000);
        const header = b64url(JSON.stringify({alg: 'RS256', typ: 'JWT'}));
        const claim = b64url(
            JSON.stringify({
                iss: sa.client_email,
                scope,
                aud: sa.token_uri || TOKEN_URI,
                iat: now,
                exp: now + 3600,
            }),
        );
        const signingInput = `${header}.${claim}`;
        const signature = crypto
            .createSign('RSA-SHA256')
            .update(signingInput)
            .sign(sa.private_key)
            .toString('base64url');
        const assertion = `${signingInput}.${signature}`;

        const res = await fetch(sa.token_uri || TOKEN_URI, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion,
            }),
        });
        const json: any = await res.json();
        if (!res.ok || !json.access_token) {
            throw new Error(
                `Auth failed (${res.status}): ${json.error_description || json.error || 'no token'}`,
            );
        }
        return json.access_token as string;
    }

    async function publishProduction(
        aabPath: string,
        onLine: OnLine,
        label?: string,
    ): Promise<{ ok: boolean; versionCode?: number }> {
        try {
            const saFile = serviceAccountPath();
            if (!fs.existsSync(saFile)) {
                onLine({
                    stream: 'stderr',
                    text: `Play service account not found at ${saFile}. Set REVOPUSH_PLAY_SERVICE_ACCOUNT or place the JSON key there.`,
                    label,
                });
                return {ok: false};
            }
            const sa: ServiceAccount = JSON.parse(fs.readFileSync(saFile, 'utf8'));
            const pkg = packageName();
            const appUrl = `${PUBLISHER_BASE}/${pkg}`;

            onLine({stream: 'system', text: 'Play: authenticating…', label});
            const token = await getAccessToken(sa, PLAY_SCOPE);
            const auth = {Authorization: `Bearer ${token}`};

            onLine({stream: 'system', text: 'Play: opening edit…', label});
            const insert = await fetch(`${appUrl}/edits`, {
                method: 'POST',
                headers: {...auth, 'Content-Length': '0'},
            });
            const edit: any = await insert.json();
            if (!insert.ok || !edit.id) {
                onLine({
                    stream: 'stderr',
                    text: `Play: edits.insert failed (${insert.status}): ${JSON.stringify(edit)}`,
                    label,
                });
                return {ok: false};
            }
            const editId = edit.id as string;

            if (cancellation.isCancelling()) return {ok: false};

            const sizeMb = (fs.statSync(aabPath).size / 1024 / 1024).toFixed(1);
            onLine({
                stream: 'system',
                text: `Play: uploading AAB (${sizeMb} MB) — this can take several minutes on slow uplinks…`,
                label,
            });
            const upRes = await uploadBundle(
                `${PUBLISHER_UPLOAD}/${pkg}/edits/${editId}/bundles?uploadType=media`,
                token,
                aabPath,
            );
            let up: any = {};
            try {
                up = JSON.parse(upRes.body || '{}');
            } catch {
            }
            if (upRes.status < 200 || upRes.status >= 300 || !up.versionCode) {
                onLine({
                    stream: 'stderr',
                    text: `Play: bundle upload failed (${upRes.status}): ${upRes.body}`,
                    label,
                });
                return {ok: false};
            }
            const versionCode = Number(up.versionCode);
            onLine({
                stream: 'system',
                text: `Play: uploaded versionCode ${versionCode}.`,
                label,
            });

            onLine({
                stream: 'system',
                text: 'Play: assigning to production track (100% rollout)…',
                label,
            });
            const trackRes = await fetch(
                `${appUrl}/edits/${editId}/tracks/production`,
                {
                    method: 'PUT',
                    headers: {...auth, 'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        track: 'production',
                        releases: [
                            {
                                versionCodes: [String(versionCode)],
                                status: 'completed',
                            },
                        ],
                    }),
                },
            );
            if (!trackRes.ok) {
                const t = await trackRes.text();
                onLine({
                    stream: 'stderr',
                    text: `Play: track update failed (${trackRes.status}): ${t}`,
                    label,
                });
                return {ok: false};
            }

            onLine({stream: 'system', text: 'Play: committing release…', label});
            const commitRes = await fetch(`${appUrl}/edits/${editId}:commit`, {
                method: 'POST',
                headers: {...auth, 'Content-Length': '0'},
            });
            if (!commitRes.ok) {
                const t = await commitRes.text();
                onLine({
                    stream: 'stderr',
                    text: `Play: commit failed (${commitRes.status}): ${t}`,
                    label,
                });
                return {ok: false};
            }

            onLine({
                stream: 'system',
                text: `Play: production release committed (versionCode ${versionCode}, 100%). Entering Google review.`,
                label,
            });
            return {ok: true, versionCode};
        } catch (e: any) {
            onLine({
                stream: 'stderr',
                text: `Play publish error: ${e.message}`,
                label,
            });
            return {ok: false};
        }
    }

    function sleep(ms: number): Promise<void> {
        return new Promise((r) => setTimeout(r, ms));
    }

    async function distributeViaRest(
        apkPath: string,
        onLine: OnLine,
        label?: string,
    ): Promise<{ ok: boolean; release?: string }> {
        const saFile = firebaseServiceAccountPath();
        if (!fs.existsSync(saFile)) {
            onLine({
                stream: 'system',
                text: `Firebase: no service account at ${saFile} — trying firebase CLI instead.`,
                label,
            });
            return {ok: false};
        }
        const sa: ServiceAccount = JSON.parse(fs.readFileSync(saFile, 'utf8'));
        const {appId, projectNumber} = firebaseAppRef();
        const appResource = `projects/${projectNumber}/apps/${appId}`;

        onLine({stream: 'system', text: 'Firebase: authenticating…', label});
        const token = await getAccessToken(sa, FIREBASE_SCOPE);

        if (cancellation.isCancelling()) return {ok: false};

        const sizeMb = (fs.statSync(apkPath).size / 1024 / 1024).toFixed(1);
        onLine({
            stream: 'system',
            text: `Firebase: uploading APK (${sizeMb} MB) to App Distribution…`,
            label,
        });
        const upRes = await uploadBundle(
            `${FAD_UPLOAD}/${appResource}/releases:upload`,
            token,
            apkPath,
            {
                'X-Goog-Upload-Protocol': 'raw',
                'X-Goog-Upload-File-Name': path.basename(apkPath),
            },
        );
        let up: any = {};
        try {
            up = JSON.parse(upRes.body || '{}');
        } catch {
        }
        if (upRes.status < 200 || upRes.status >= 300 || !up.name) {
            onLine({
                stream: 'stderr',
                text: `Firebase: upload failed (${upRes.status}): ${upRes.body}`,
                label,
            });
            return {ok: false};
        }

        const opName = String(up.name);
        const auth = {Authorization: `Bearer ${token}`};
        for (let i = 0; i < 30; i++) {
            if (cancellation.isCancelling()) return {ok: false};
            const opRes = await fetch(`${FAD_BASE}/${opName}`, {headers: auth});
            const op: any = await opRes.json().catch(() => ({}));
            if (op.done) {
                if (op.error) {
                    onLine({
                        stream: 'stderr',
                        text: `Firebase: processing failed: ${JSON.stringify(op.error)}`,
                        label,
                    });
                    return {ok: false};
                }
                const release = op.response?.release;
                const ver =
                    release?.displayVersion && release?.buildVersion
                        ? `${release.displayVersion} (${release.buildVersion})`
                        : '';
                onLine({
                    stream: 'system',
                    text: `Firebase: release uploaded${ver ? ` — ${ver}` : ''}.${
                        release?.firebaseConsoleUri
                            ? ` ${release.firebaseConsoleUri}`
                            : ''
                    }`,
                    label,
                });

                const releaseName: string | undefined = release?.name;
                if (releaseName) {
                    const notes = releaseNotes();
                    const patchRes = await fetch(
                        `${FAD_BASE}/${releaseName}?updateMask=release_notes.text`,
                        {
                            method: 'PATCH',
                            headers: {...auth, 'Content-Type': 'application/json'},
                            body: JSON.stringify({releaseNotes: {text: notes}}),
                        },
                    );
                    if (!patchRes.ok) {
                        onLine({
                            stream: 'stderr',
                            text: `Firebase: setting release notes failed (${patchRes.status}): ${await patchRes.text()}`,
                            label,
                        });
                    }

                    onLine({
                        stream: 'system',
                        text: `Firebase: distributing to group "${FIREBASE_GROUP}"…`,
                        label,
                    });
                    const distRes = await fetch(`${FAD_BASE}/${releaseName}:distribute`, {
                        method: 'POST',
                        headers: {...auth, 'Content-Type': 'application/json'},
                        body: JSON.stringify({groupAliases: [FIREBASE_GROUP]}),
                    });
                    if (!distRes.ok) {
                        onLine({
                            stream: 'stderr',
                            text: `Firebase: distribute to group "${FIREBASE_GROUP}" failed (${distRes.status}): ${await distRes.text()}`,
                            label,
                        });
                        return {ok: false};
                    }
                }
                return {ok: true, release: releaseName};
            }
            await sleep(2000);
        }
        onLine({
            stream: 'stderr',
            text: 'Firebase: timed out waiting for the release to finish processing.',
            label,
        });
        return {ok: false};
    }

    function distributeViaCli(
        apkPath: string,
        onLine: OnLine,
        label?: string,
    ): Promise<{ ok: boolean }> {
        return new Promise((resolve) => {
            if (cancellation.isCancelling()) {
                resolve({ok: false});
                return;
            }
            let appId: string;
            try {
                appId = firebaseAppRef().appId;
            } catch (e: any) {
                onLine({stream: 'stderr', text: e.message, label});
                resolve({ok: false});
                return;
            }
            const saFile = firebaseServiceAccountPath();
            const env = {...process.env};
            if (!env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(saFile)) {
                env.GOOGLE_APPLICATION_CREDENTIALS = saFile;
            }
            const notes = releaseNotes();
            onLine({
                stream: 'system',
                text: `$ npx --yes firebase-tools appdistribution:distribute <apk> --app ${appId} --groups ${FIREBASE_GROUP}`,
                label,
            });
            const child = spawn(
                'npx',
                [
                    '--yes',
                    'firebase-tools',
                    'appdistribution:distribute',
                    apkPath,
                    '--app',
                    appId,
                    '--groups',
                    FIREBASE_GROUP,
                    '--release-notes',
                    notes,
                ],
                {cwd: repoRoot, env},
            );
            cancellation.track(child);
            const pump = (
                streamType: 'stdout' | 'stderr',
                stream: NodeJS.ReadableStream | null,
            ) =>
                pumpLines(streamType, stream, {
                    onLine: (s, text) => onLine({stream: s, text, label}),
                });
            pump('stdout', child.stdout);
            pump('stderr', child.stderr);
            child.on('error', (err) => {
                onLine({
                    stream: 'stderr',
                    text: `firebase CLI failed to start: ${err.message}`,
                    label,
                });
                resolve({ok: false});
            });
            child.on('close', (code) => {
                resolve({ok: (code ?? 1) === 0});
            });
        });
    }

    async function distributeToFirebase(
        apkPath: string,
        onLine: OnLine,
        label?: string,
    ): Promise<{ ok: boolean; release?: string }> {
        try {
            const rest = await distributeViaRest(apkPath, onLine, label);
            if (rest.ok) return rest;
        } catch (e: any) {
            onLine({
                stream: 'stderr',
                text: `Firebase REST upload error: ${e.message}. Falling back to firebase CLI…`,
                label,
            });
        }
        if (cancellation.isCancelling()) return {ok: false};
        onLine({
            stream: 'system',
            text: 'Firebase: falling back to the firebase CLI…',
            label,
        });
        const cli = await distributeViaCli(apkPath, onLine, label);
        return {ok: cli.ok};
    }

    return {build, publishProduction, distributeToFirebase};
}
