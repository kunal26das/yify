import type {
    Channel,
    OnLine,
    Platform,
    UpdateResult,
    UpdateStep,
    UpdateSummary,
} from '../entities/index.js';
import type {
    Cancellation,
    Installer,
    ReleaseCli,
    ReleaseLedger,
    RuntimeVersions,
    Workspace,
} from '../repositories/index.js';
import type {OperationGuard} from '../services/operationGuard.js';
import {buildJobs, jobLabel} from '../services/jobs.js';

export function summarizeUpdate(res: UpdateResult): UpdateSummary {
    const blocked = res.steps
        .filter((s) => s.blocked)
        .map((s) => `${s.platform}/${s.channel}`);
    const total = res.steps.length;
    const released = res.steps.filter((s) => s.ok && !s.blocked).length;
    return {ok: res.ok, total, blocked, released};
}

export interface UpdateUseCases {
    canPublish(platform: Platform, channel: Channel): Promise<boolean>;

    runUpdate(
        platforms: Platform[],
        channels: Channel[],
        message: string,
        onLine: OnLine,
    ): Promise<UpdateResult>;

    summarizeUpdate(res: UpdateResult): UpdateSummary;
}

export function createUpdateUseCases(deps: {
    ledger: ReleaseLedger;
    runtimeVersions: RuntimeVersions;
    installer: Installer;
    cli: ReleaseCli;
    cancellation: Cancellation;
    operation: OperationGuard;
    workspace: Workspace;
}): UpdateUseCases {
    const {
        ledger,
        runtimeVersions,
        installer,
        cli,
        cancellation,
        operation,
        workspace,
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

    async function canPublish(
        platform: Platform,
        channel: Channel,
    ): Promise<boolean> {
        const runtimeVersion = await runtimeVersions.resolve(platform);
        return ledger.find(platform, channel, runtimeVersion) !== null;
    }

    async function runUpdate(
        platforms: Platform[],
        channels: Channel[],
        message: string,
        onLine: OnLine,
    ): Promise<UpdateResult> {
        const wrapped = await operation.withOperation('update', async () => {
            const jobs = buildJobs(platforms, channels);
            const runtimeVersionFor = resolver();

            onLine({
                stream: 'system',
                text: 'Resolving runtime versions before publishing…',
            });

            const checked: Array<{
                platform: Platform;
                channel: Channel;
                allowed: boolean;
            }> = [];

            for (const job of jobs) {
                const app = apps[job.platform].name;
                const label = jobLabel(apps, job.platform, job.channel);

                let allowed = false;
                try {
                    const runtimeVersion = await runtimeVersionFor(job.platform);
                    allowed = ledger.find(job.platform, job.channel, runtimeVersion) !== null;
                    if (!allowed) {
                        onLine({
                            stream: 'system',
                            text: `Blocked: no store release recorded for ${app} (${job.platform}) at runtime version ${runtimeVersion} on ${job.channel}. Ship a store release first — an update published now would reach nobody.`,
                            label,
                        });
                    }
                } catch (err) {
                    onLine({
                        stream: 'stderr',
                        text: `Could not resolve the runtime version for ${job.platform}: ${
                            (err as Error).message
                        }`,
                        label,
                    });
                }

                checked.push({
                    platform: job.platform,
                    channel: job.channel,
                    allowed,
                });
            }

            const blockedStep = (c: {
                platform: Platform;
                channel: Channel;
            }): UpdateStep => ({
                platform: c.platform,
                channel: c.channel,
                ok: false,
                blocked: true,
            });

            if (!checked.some((c) => c.allowed)) {
                onLine({
                    stream: 'system',
                    text: 'Nothing to publish — no selected target has a matching store release. Skipping clean install.',
                });
                return {ok: false, steps: checked.map(blockedStep)};
            }

            onLine({
                stream: 'system',
                text: 'Clean install before publishing (rm -rf node_modules && install)…',
            });
            const inst = await installer.cleanInstall(onLine);
            if (!inst.ok) {
                onLine({
                    stream: 'system',
                    text: 'Aborting update: clean install failed.',
                });
                return {
                    ok: false,
                    steps: checked.map((c) =>
                        c.allowed
                            ? {platform: c.platform, channel: c.channel, ok: false}
                            : blockedStep(c),
                    ),
                };
            }

            const steps: UpdateStep[] = [];
            for (const c of checked) {
                if (cancellation.isCancelling()) break;
                if (!c.allowed) {
                    steps.push(blockedStep(c));
                    continue;
                }

                const app = apps[c.platform].name;
                const label = jobLabel(apps, c.platform, c.channel);
                const runtimeVersion = await runtimeVersionFor(c.platform);

                onLine({
                    stream: 'system',
                    text: `Update: ${app} (${c.platform}) runtime ${runtimeVersion} -> ${c.channel}`,
                    label,
                });

                const result = await cli.run(
                    [
                        'update',
                        '--channel',
                        workspace.channelName(c.channel),
                        '--platform',
                        c.platform,
                        '--message',
                        message,
                        '--environment',
                        'production',
                        '--non-interactive',
                    ],
                    onLine,
                    {label},
                );

                steps.push({
                    platform: c.platform,
                    channel: c.channel,
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

    return {canPublish, runUpdate, summarizeUpdate};
}
