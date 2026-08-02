import {
    ALL_PLATFORMS,
    type BinaryValidation,
    type Channel,
    type OnLine,
    type Platform,
    type ReleaseCoverage,
    type RunStoreReleaseOptions,
    type StoreReleaseResult,
    type StoreReleaseStep,
} from '../entities/index.js';
import type {
    AndroidArtifacts,
    AndroidPublisher,
    BinaryInspector,
    Cancellation,
    Installer,
    ReleaseLedger,
    RuntimeVersions,
    Workspace,
} from '../repositories/index.js';
import type {OperationGuard} from '../services/operationGuard.js';
import {buildJobs, jobLabel} from '../services/jobs.js';

function extOk(filePath: string, allowed: string[]): boolean {
    const lower = filePath.toLowerCase();
    return allowed.some((ext) => lower.endsWith(ext));
}

export interface StoreReleaseUseCases {
    validateBinaries(
        apkPath: string,
        ipaPath: string,
        platforms?: Platform[],
    ): Promise<BinaryValidation>;

    findExistingReleases(
        platforms?: Platform[],
        channels?: Channel[],
    ): Promise<Array<{ platform: Platform; channel: Channel }>>;

    releaseCoverage(
        platforms: Platform[],
        channels: Channel[],
    ): Promise<ReleaseCoverage>;

    runStoreRelease(
        opts: RunStoreReleaseOptions,
        onLine: OnLine,
    ): Promise<StoreReleaseResult>;
}

export function createStoreReleaseUseCases(deps: {
    ledger: ReleaseLedger;
    runtimeVersions: RuntimeVersions;
    installer: Installer;
    cancellation: Cancellation;
    operation: OperationGuard;
    workspace: Workspace;
    binary: BinaryInspector;
    androidPublisher: AndroidPublisher;
}): StoreReleaseUseCases {
    const {
        ledger,
        runtimeVersions,
        installer,
        cancellation,
        operation,
        workspace,
        binary,
        androidPublisher,
    } = deps;
    const apps = workspace.apps;

    function resolver(): (platform: Platform) => Promise<string> {
        const cache = new Map<Platform, Promise<string>>();
        return (platform) => {
            const hit = cache.get(platform);
            if (hit) return hit;
            const pending = runtimeVersions.resolve(platform);
            cache.set(platform, pending);
            return pending;
        };
    }

    async function validateBinaries(
        apkPath: string,
        ipaPath: string,
        platforms: Platform[] = ALL_PLATFORMS,
    ): Promise<BinaryValidation> {
        const needAndroid = platforms.includes('android');
        const needIos = platforms.includes('ios');
        if (!needAndroid && !needIos) {
            return {
                ok: false,
                error: 'Select at least one platform (Android / iOS).',
            };
        }

        let apkVersion: string | undefined;
        let ipaVersion: string | undefined;

        const apkGenerated = needAndroid && !apkPath;

        if (needIos && !ipaPath) {
            return {ok: false, error: 'An iOS (.ipa) file is required.'};
        }

        if (apkGenerated) {
            try {
                apkVersion = binary.repoTargetVersion();
            } catch (e: any) {
                return {
                    ok: false,
                    error: `Could not read the app version from package.json: ${e.message}`,
                };
            }
        } else if (needAndroid && apkPath) {
            if (!binary.exists(apkPath))
                return {ok: false, error: `Android file not found: ${apkPath}`};
            if (!extOk(apkPath, ['.apk'])) {
                return {
                    ok: false,
                    error:
                        'Android file must be a .apk (.aab is not supported in this MVP).',
                };
            }
            try {
                apkVersion = await binary.versionFromBinary(apkPath);
            } catch (e: any) {
                return {
                    ok: false,
                    error: `Could not read version from the .apk: ${e.message}`,
                };
            }
        }

        if (needIos) {
            if (!binary.exists(ipaPath))
                return {ok: false, error: `iOS file not found: ${ipaPath}`};
            if (!extOk(ipaPath, ['.ipa'])) {
                return {ok: false, error: 'iOS file must be a .ipa.'};
            }
            try {
                ipaVersion = await binary.versionFromBinary(ipaPath);
            } catch (e: any) {
                return {
                    ok: false,
                    error: `Could not read version from the .ipa: ${e.message}`,
                };
            }
        }

        if (needAndroid && needIos && apkVersion !== ipaVersion) {
            return {
                ok: false,
                error: `Version mismatch: apk is v${apkVersion} but ipa is v${ipaVersion}. They must match.`,
            };
        }

        return {ok: true, version: (apkVersion ?? ipaVersion)!, apkPath, ipaPath};
    }

    async function findExistingReleases(
        platforms: Platform[] = ALL_PLATFORMS,
        channels: Channel[] = workspace.channels,
    ): Promise<Array<{ platform: Platform; channel: Channel }>> {
        const runtimeVersionFor = resolver();
        const existing: Array<{ platform: Platform; channel: Channel }> = [];
        for (const channel of channels) {
            for (const platform of platforms) {
                const runtimeVersion = await runtimeVersionFor(platform);
                if (ledger.find(platform, channel, runtimeVersion)) {
                    existing.push({platform, channel});
                }
            }
        }
        return existing;
    }

    async function releaseCoverage(
        platforms: Platform[],
        channels: Channel[],
    ): Promise<ReleaseCoverage> {
        const existing = await findExistingReleases(platforms, channels);
        const total = platforms.length * channels.length;
        const have = Math.min(existing.length, total);
        return {have, total, covered: total > 0 && have >= total, existing};
    }

    async function runStoreRelease(
        opts: RunStoreReleaseOptions,
        onLine: OnLine,
    ): Promise<StoreReleaseResult> {
        const wrapped = await operation.withOperation('store', async () => {
            const {apkPath, ipaPath, version, platforms, channels} = opts;

            onLine({
                stream: 'system',
                text: 'Clean install before release (rm -rf node_modules && install)…',
            });
            const inst = await installer.cleanInstall(onLine);
            if (!inst.ok) {
                onLine({
                    stream: 'system',
                    text: 'Aborting store release: clean install failed.',
                });
                return {ok: false, steps: []};
            }

            const jobs = buildJobs(platforms, channels);
            const runtimeVersionFor = resolver();

            let androidBuild:
                | { ok: boolean; artifacts?: AndroidArtifacts }
                | undefined;

            async function ensureAndroidArtifacts(
                label: string,
            ): Promise<{ ok: boolean; artifacts?: AndroidArtifacts }> {
                if (androidBuild) return androidBuild;
                if (apkPath) {
                    androidBuild = {ok: true, artifacts: {apkPath, aabPath: ''}};
                    return androidBuild;
                }
                onLine({
                    stream: 'system',
                    text: 'Android: building signed APK + AAB (shared across channels)…',
                    label,
                });
                androidBuild = await androidPublisher.build(onLine, label);
                return androidBuild;
            }

            const steps: StoreReleaseStep[] = [];
            for (const job of jobs) {
                if (cancellation.isCancelling()) break;
                const app = apps[job.platform].name;
                const label = jobLabel(apps, job.platform, job.channel);

                let runtimeVersion: string;
                try {
                    runtimeVersion = await runtimeVersionFor(job.platform);
                } catch (err) {
                    onLine({
                        stream: 'stderr',
                        text: `Could not resolve the runtime version for ${job.platform}: ${
                            (err as Error).message
                        }`,
                        label,
                    });
                    steps.push({
                        platform: job.platform,
                        channel: job.channel,
                        ok: false,
                    });
                    continue;
                }

                if (ledger.find(job.platform, job.channel, runtimeVersion)) {
                    onLine({
                        stream: 'system',
                        text: `Skip: ${app} runtime ${runtimeVersion} is already released on ${job.channel}.`,
                        label,
                    });
                    steps.push({
                        platform: job.platform,
                        channel: job.channel,
                        ok: true,
                        skipped: true,
                    });
                    continue;
                }

                if (job.platform === 'android') {
                    const built = await ensureAndroidArtifacts(label);
                    if (!built.ok || !built.artifacts) {
                        onLine({
                            stream: 'system',
                            text: `Aborting ${app} ${job.channel}: Android build failed.`,
                            label,
                        });
                        steps.push({
                            platform: job.platform,
                            channel: job.channel,
                            ok: false,
                        });
                        continue;
                    }
                    const {apkPath: builtApk, aabPath: builtAab} = built.artifacts;

                    if (job.channel === 'Production') {
                        if (!builtAab) {
                            onLine({
                                stream: 'stderr',
                                text: `Production Android needs a generated AAB — don't drop an .apk when targeting Production; let the console build it.`,
                                label,
                            });
                            steps.push({
                                platform: job.platform,
                                channel: job.channel,
                                ok: false,
                            });
                            continue;
                        }
                        onLine({
                            stream: 'system',
                            text: `Publishing AAB to Play Store production track (100% rollout)…`,
                            label,
                        });
                        const pub = await androidPublisher.publishProduction(
                            builtAab,
                            onLine,
                            label,
                        );
                        if (!pub.ok) {
                            onLine({
                                stream: 'system',
                                text: `Aborting ${app} Production store release: Play Store publish failed.`,
                                label,
                            });
                            steps.push({
                                platform: job.platform,
                                channel: job.channel,
                                ok: false,
                            });
                            continue;
                        }
                    } else {
                        onLine({
                            stream: 'system',
                            text: `Staging Android: uploading APK to Firebase App Distribution…`,
                            label,
                        });
                        const dist = await androidPublisher.distributeToFirebase(
                            builtApk,
                            onLine,
                            label,
                        );
                        if (!dist.ok) {
                            onLine({
                                stream: 'system',
                                text: `Aborting ${app} Staging store release: Firebase App Distribution upload failed.`,
                                label,
                            });
                            steps.push({
                                platform: job.platform,
                                channel: job.channel,
                                ok: false,
                            });
                            continue;
                        }
                    }
                } else {
                    onLine({
                        stream: 'system',
                        text: `iOS: ${ipaPath} still has to reach App Store Connect on its own — the console only records it so updates can target it.`,
                        label,
                    });
                }

                ledger.record({
                    platform: job.platform,
                    channel: job.channel,
                    version,
                    runtimeVersion,
                    releasedAt: new Date().toISOString(),
                });
                onLine({
                    stream: 'system',
                    text: `Recorded ${app} (${job.platform}) v${version} runtime ${runtimeVersion} on ${job.channel}. Updates for this runtime are now unblocked.`,
                    label,
                });

                steps.push({
                    platform: job.platform,
                    channel: job.channel,
                    ok: true,
                });
            }

            return {ok: steps.length > 0 && steps.every((s) => s.ok), steps};
        });

        if (!wrapped.ok) {
            onLine({
                stream: 'system',
                text: `Blocked: a ${wrapped.busy} operation is already running.`,
            });
            return {ok: false, steps: []};
        }
        return wrapped.result;
    }

    return {
        validateBinaries,
        findExistingReleases,
        releaseCoverage,
        runStoreRelease,
    };
}
