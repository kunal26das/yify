import fs from 'node:fs';
import path from 'node:path';
import type {
    Channel,
    Platform,
    ReleaseLedger,
    ReleaseRecord,
    Workspace,
} from '../../domain/index.js';

function sameTarget(
    entry: ReleaseRecord,
    platform: Platform,
    channel: Channel,
    runtimeVersion: string,
): boolean {
    return (
        entry.platform === platform &&
        entry.channel === channel &&
        entry.runtimeVersion === runtimeVersion
    );
}

export function createReleaseLedger(deps: {
    workspace: Workspace;
}): ReleaseLedger {
    const {workspace} = deps;

    function filePath(): string {
        return path.join(workspace.repoRoot, 'release', 'releases.json');
    }

    function list(): ReleaseRecord[] {
        let raw: string;
        try {
            raw = fs.readFileSync(filePath(), 'utf8');
        } catch {
            return [];
        }
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed?.releases) ? parsed.releases : [];
        } catch {
            return [];
        }
    }

    function find(
        platform: Platform,
        channel: Channel,
        runtimeVersion: string,
    ): ReleaseRecord | null {
        return (
            list().find((entry) =>
                sameTarget(entry, platform, channel, runtimeVersion),
            ) ?? null
        );
    }

    function record(entry: ReleaseRecord): void {
        const kept = list().filter(
            (existing) =>
                !sameTarget(
                    existing,
                    entry.platform,
                    entry.channel,
                    entry.runtimeVersion,
                ),
        );
        const releases = [...kept, entry].sort((a, b) =>
            a.releasedAt.localeCompare(b.releasedAt),
        );
        fs.writeFileSync(
            filePath(),
            `${JSON.stringify({releases}, null, 2)}\n`,
        );
    }

    return {list, find, record, filePath};
}
