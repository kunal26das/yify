import type {
    Platform,
    RuntimeVersions,
    Workspace,
} from '../../domain/index.js';
import path from 'node:path';
import {expoUpdatesCliPath, nodeBinaryPath} from '../cli/easBin.js';
import {capture, parseJsonBlock} from '../cli/capture.js';

export function createRuntimeVersions(deps: {
    workspace: Workspace;
}): RuntimeVersions {
    const {workspace} = deps;

    return {
        async resolve(platform: Platform, channel?: string): Promise<string> {
            const res = await capture(
                nodeBinaryPath(),
                [
                    expoUpdatesCliPath(workspace.repoRoot),
                    'runtimeversion:resolve',
                    '--platform',
                    platform,
                ],
                {
                    cwd: workspace.repoRoot,
                    env: {...process.env, ...(channel ? {EXPO_UPDATE_CHANNEL: channel} : {})},
                    timeoutMs: 10 * 60 * 1000,
                },
            );

            if (!res.ok) {
                const detail = res.stderr.trim() || res.stdout.trim();
                throw new Error(
                    `expo-updates runtimeversion:resolve failed for ${platform}: ${detail}`,
                );
            }

            const parsed = parseJsonBlock(res.stdout);
            const runtimeVersion = parsed?.runtimeVersion;
            if (typeof runtimeVersion !== 'string' || !runtimeVersion) {
                throw new Error(
                    `expo-updates did not return a runtime version for ${platform}.`,
                );
            }
            return runtimeVersion;
        },

        async embeddedChannel(channel?: string): Promise<string | null> {
            const res = await capture(
                nodeBinaryPath(),
                [
                    path.join(workspace.repoRoot, 'node_modules', '@expo', 'cli', 'build', 'bin', 'cli'),
                    'config',
                    '--json',
                    '--type',
                    'public',
                ],
                {
                    cwd: workspace.repoRoot,
                    env: {...process.env, ...(channel ? {EXPO_UPDATE_CHANNEL: channel} : {})},
                    timeoutMs: 5 * 60 * 1000,
                },
            );

            if (!res.ok) return null;

            try {
                const config = parseJsonBlock(res.stdout);
                const channel = config?.updates?.requestHeaders?.['expo-channel-name'];
                return typeof channel === 'string' && channel ? channel : null;
            } catch {
                return null;
            }
        },
    };
}
