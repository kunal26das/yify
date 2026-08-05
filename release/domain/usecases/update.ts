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

    function resolver(): (platform: Platform, channel: Channel) => Promise<string> {
        const cache = new Map<string, Promise<string>>();
        return (platform, channel) => {
            const name = workspace.channelName(channel);
            const key = `${platform}:${name}`;
            const hit = cache.get(key);
            if (hit) return hit;
            const pending = runtimeVersions.resolve(platform, name);
            cache.set(key, pending);
            return pending;
        };
    }

    async function canPublish(
        platform: Platform,
        channel: Channel,
    ): Promise<boolean> {
        const name = workspace.channelName(channel);
        const embedded = await runtimeVersions.embeddedChannel(name);
        if (embedded !== null && name !== embedded) return false;
        const runtimeVersion = await runtimeVersions.resolve(platform, name);
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

            const embedded = await runtimeVersions.embeddedChannel();

            if (embedded === null) {
                onLine({
                    stream: 'system',
                    text: 'Warning: could not read expo-channel-name from the app config. Builds without that header cannot receive any update.',
                });
            } else {
                onLine({
                    stream: 'system',
                    text: `Builds of this config listen on channel "${embedded}".`,
                });
            }

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
                    const target = workspace.channelName(job.channel);
                    if (embedded !== null && target !== embedded) {
                        onLine({
                            stream: 'system',
                            text: `Blocked: shipped builds ask for channel "${embedded}", so an update published to "${target}" would reach nobody. Build and ship with EXPO_UPDATE_CHANNEL=${target} first, or publish to ${embedded} instead.`,
                            label,
                        });
                        checked.push({platform: job.platform, channel: job.channel, allowed: false});
                        continue;
                    }
                    const runtimeVersion = await runtimeVersionFor(job.platform, job.channel);
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
                const runtimeVersion = await runtimeVersionFor(c.platform, c.channel);

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
