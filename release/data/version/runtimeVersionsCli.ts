import type {
    Platform,
    RuntimeVersions,
    Workspace,
} from '../../domain/index.js';
import {expoUpdatesCliPath, nodeBinaryPath} from '../cli/easBin.js';
import {capture, parseJsonBlock} from '../cli/capture.js';

export function createRuntimeVersions(deps: {
    workspace: Workspace;
}): RuntimeVersions {
    const {workspace} = deps;

    return {
        async resolve(platform: Platform): Promise<string> {
            const res = await capture(
                nodeBinaryPath(),
                [
                    expoUpdatesCliPath(workspace.repoRoot),
                    'runtimeversion:resolve',
                    '--platform',
                    platform,
                ],
                {cwd: workspace.repoRoot, timeoutMs: 10 * 60 * 1000},
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
    };
}
