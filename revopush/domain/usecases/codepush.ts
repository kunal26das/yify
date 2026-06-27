import type {CodePushResult, CodePushStep, CodePushSummary, Deployment, OnLine, Platform,} from '../entities/index.js';
import type {Cancellation, Installer, ManagementApi, ReleaseCli, Workspace,} from '../repositories/index.js';
import type {OperationGuard} from '../services/operationGuard.js';
import {buildJobs, jobLabel} from '../services/jobs.js';

export function summarizeCodePush(res: CodePushResult): CodePushSummary {
    const blocked = res.steps
        .filter((s) => s.blocked)
        .map((s) => `${s.platform}/${s.deployment}`);
    const total = res.steps.length;
    const unchanged = res.steps.filter((s) => s.unchanged).length;
    const released = res.steps.filter(
        (s) => s.ok && !s.unchanged && !s.blocked,
    ).length;
    return {ok: res.ok, total, blocked, unchanged, released};
}

export interface CodePushUseCases {
    canCodePush(
        platform: Platform,
        deployment: Deployment,
        version: string,
    ): Promise<boolean>;

    runCodePush(
        platforms: Platform[],
        deployments: Deployment[],
        version: string,
        onLine: OnLine,
    ): Promise<CodePushResult>;

    summarizeCodePush(res: CodePushResult): CodePushSummary;
}

export function createCodePushUseCases(deps: {
    api: ManagementApi;
    installer: Installer;
    cli: ReleaseCli;
    cancellation: Cancellation;
    operation: OperationGuard;
    workspace: Workspace;
}): CodePushUseCases {
    const {api, installer, cli, cancellation, operation, workspace} = deps;
    const apps = workspace.apps;

    function canCodePush(
        platform: Platform,
        deployment: Deployment,
        version: string,
    ): Promise<boolean> {
        return api.hasBaseRelease(platform, deployment, version);
    }

    async function runCodePush(
        platforms: Platform[],
        deployments: Deployment[],
        version: string,
        onLine: OnLine,
    ): Promise<CodePushResult> {
        const wrapped = await operation.withOperation('codepush', async () => {
            const jobs = buildJobs(platforms, deployments);

            onLine({
                stream: 'system',
                text: 'Checking base releases before CodePush…',
            });
            const checked: Array<{
                platform: Platform;
                deployment: Deployment;
                allowed: boolean;
            }> = [];
            for (const job of jobs) {
                const app = apps[job.platform].name;
                const label = jobLabel(apps, job.platform, job.deployment);
                const allowed = await canCodePush(
                    job.platform,
                    job.deployment,
                    version,
                );
                if (!allowed) {
                    onLine({
                        stream: 'system',
                        text: `Blocked: no base release for ${app} v${version} in ${job.deployment}. Do a base release first.`,
                        label,
                    });
                }
                checked.push({
                    platform: job.platform,
                    deployment: job.deployment,
                    allowed,
                });
            }

            const blockedStep = (c: {
                platform: Platform;
                deployment: Deployment;
            }): CodePushStep => ({
                platform: c.platform,
                deployment: c.deployment,
                ok: false,
                blocked: true,
            });

            if (!checked.some((c) => c.allowed)) {
                onLine({
                    stream: 'system',
                    text: 'Nothing to release — no base release for any selected target. Skipping clean install.',
                });
                return {ok: false, steps: checked.map(blockedStep)};
            }

            onLine({
                stream: 'system',
                text: 'Clean install before release (rm -rf node_modules && install)…',
            });
            const inst = await installer.cleanInstall(onLine);
            if (!inst.ok) {
                onLine({
                    stream: 'system',
                    text: 'Aborting CodePush: clean install failed.',
                });
                return {
                    ok: false,
                    steps: checked.map((c) =>
                        c.allowed
                            ? {platform: c.platform, deployment: c.deployment, ok: false}
                            : blockedStep(c),
                    ),
                };
            }

            const steps: CodePushStep[] = [];
            for (const c of checked) {
                if (cancellation.isCancelling()) break;
                if (!c.allowed) {
                    steps.push(blockedStep(c));
                    continue;
                }

                const app = apps[c.platform].name;
                const label = jobLabel(apps, c.platform, c.deployment);
                onLine({
                    stream: 'system',
                    text: `CodePush: ${app} (${c.platform}) v${version} -> ${c.deployment}`,
                    label,
                });
                const result = await cli.run(
                    [
                        'release-expo',
                        app,
                        c.platform,
                        '-d',
                        workspace.deploymentName(c.platform, c.deployment),
                        '--targetBinaryVersion',
                        version,
                    ],
                    onLine,
                    {label},
                );
                if (result.unchanged) {
                    onLine({
                        stream: 'system',
                        text: `No change: ${app} v${version} in ${c.deployment} already has this exact bundle.`,
                        label,
                    });
                }
                steps.push({
                    platform: c.platform,
                    deployment: c.deployment,
                    ok: result.ok,
                    unchanged: result.unchanged,
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

    return {canCodePush, runCodePush, summarizeCodePush};
}
