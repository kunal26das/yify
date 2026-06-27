import {
    ALL_PLATFORMS,
    type BaseCoverage,
    type BaseReleaseResult,
    type BaseReleaseStep,
    type BinaryValidation,
    type Deployment,
    type OnLine,
    type Platform,
    type RunBaseReleaseOptions,
} from '../entities/index.js';
import type {
    BinaryInspector,
    Cancellation,
    Installer,
    ManagementApi,
    ReleaseCli,
    Workspace,
} from '../repositories/index.js';
import type {OperationGuard} from '../services/operationGuard.js';
import {buildJobs, jobLabel} from '../services/jobs.js';

function extOk(filePath: string, allowed: string[]): boolean {
    const lower = filePath.toLowerCase();
    return allowed.some((ext) => lower.endsWith(ext));
}

export interface BaseReleaseUseCases {
    validateBinaries(
        apkPath: string,
        ipaPath: string,
        platforms?: Platform[],
    ): Promise<BinaryValidation>;

    findExistingBases(
        version: string,
        platforms?: Platform[],
        deployments?: Deployment[],
    ): Promise<Array<{ platform: Platform; deployment: Deployment }>>;

    baseCoverage(
        version: string,
        platforms: Platform[],
        deployments: Deployment[],
    ): Promise<BaseCoverage>;

    runBaseRelease(
        opts: RunBaseReleaseOptions,
        onLine: OnLine,
    ): Promise<BaseReleaseResult>;
}

export function createBaseReleaseUseCases(deps: {
    api: ManagementApi;
    installer: Installer;
    cli: ReleaseCli;
    cancellation: Cancellation;
    operation: OperationGuard;
    workspace: Workspace;
    binary: BinaryInspector;
}): BaseReleaseUseCases {
    const {api, installer, cli, cancellation, operation, workspace, binary} =
        deps;
    const apps = workspace.apps;

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

        const missing: string[] = [];
        if (needAndroid && !apkPath) missing.push('Android (.apk)');
        if (needIos && !ipaPath) missing.push('iOS (.ipa)');
        if (missing.length === 1) {
            return {ok: false, error: `An ${missing[0]} file is required.`};
        }
        if (missing.length > 1) {
            return {
                ok: false,
                error: `Both files are required: ${missing.join(' and ')}.`,
            };
        }

        if (needAndroid) {
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

    async function findExistingBases(
        version: string,
        platforms: Platform[] = ALL_PLATFORMS,
        deployments: Deployment[] = workspace.deployments,
    ): Promise<Array<{ platform: Platform; deployment: Deployment }>> {
        const blocked: Array<{ platform: Platform; deployment: Deployment }> = [];
        for (const deployment of deployments) {
            for (const platform of platforms) {
                if (await api.getBaseRelease(platform, deployment, version)) {
                    blocked.push({platform, deployment});
                }
            }
        }
        return blocked;
    }

    async function baseCoverage(
        version: string,
        platforms: Platform[],
        deployments: Deployment[],
    ): Promise<BaseCoverage> {
        const existing = await findExistingBases(version, platforms, deployments);
        const total = platforms.length * deployments.length;
        const have = Math.min(existing.length, total);
        return {have, total, covered: total > 0 && have >= total, existing};
    }

    async function runBaseRelease(
        opts: RunBaseReleaseOptions,
        onLine: OnLine,
    ): Promise<BaseReleaseResult> {
        const wrapped = await operation.withOperation('base', async () => {
            const {apkPath, ipaPath, version, platforms, deployments} = opts;

            onLine({
                stream: 'system',
                text: 'Clean install before release (rm -rf node_modules && install)…',
            });
            const inst = await installer.cleanInstall(onLine);
            if (!inst.ok) {
                onLine({
                    stream: 'system',
                    text: 'Aborting base release: clean install failed.',
                });
                return {ok: false, steps: []};
            }

            const jobs = buildJobs(platforms, deployments).map((job) => ({
                ...job,
                file: job.platform === 'android' ? apkPath : ipaPath,
            }));

            const steps: BaseReleaseStep[] = [];
            for (const job of jobs) {
                if (cancellation.isCancelling()) break;
                const app = apps[job.platform].name;
                const label = jobLabel(apps, job.platform, job.deployment);

                if (await api.getBaseRelease(job.platform, job.deployment, version)) {
                    onLine({
                        stream: 'system',
                        text: `Skip: base for ${app} v${version} already exists in ${job.deployment}.`,
                        label,
                    });
                    steps.push({
                        platform: job.platform,
                        deployment: job.deployment,
                        ok: true,
                        skipped: true,
                    });
                    continue;
                }

                onLine({
                    stream: 'system',
                    text: `Base release: ${app} (${job.platform}) v${version} -> ${job.deployment}`,
                    label,
                });
                const result = await cli.run(
                    [
                        'release-native',
                        app,
                        job.platform,
                        job.file,
                        '-d',
                        job.deployment,
                        '-t',
                        version,
                    ],
                    onLine,
                    {label},
                );
                steps.push({
                    platform: job.platform,
                    deployment: job.deployment,
                    ok: result.ok,
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

    return {validateBinaries, findExistingBases, baseCoverage, runBaseRelease};
}
