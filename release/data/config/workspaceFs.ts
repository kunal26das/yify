import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {AppTarget, Channel, Platform, Workspace} from '../../domain/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APP_NAME = 'Yify';

const APPS: Record<Platform, AppTarget> = {
    android: {name: APP_NAME, platform: 'android'},
    ios: {name: APP_NAME, platform: 'ios'},
};

const CHANNELS: Channel[] = ['Staging', 'Production'];

function channelName(channel: Channel): string {
    return channel;
}

export function findRepoRoot(): string {
    let dir = __dirname;
    for (let i = 0; i < 8; i++) {
        const pkgPath = path.join(dir, 'package.json');
        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                const deps = {
                    ...(pkg.dependencies ?? {}),
                    ...(pkg.devDependencies ?? {}),
                };
                if ('expo' in deps && 'expo-updates' in deps) return dir;
            } catch {
            }
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }

    return path.resolve(__dirname, '..', '..', '..');
}

function currentBranch(root: string): string | undefined {
    try {
        const head = fs
            .readFileSync(path.join(root, '.git', 'HEAD'), 'utf8')
            .trim();
        const match = head.match(/^ref:\s*refs\/heads\/(.+)$/);
        if (match) return match[1];
        return head ? head.slice(0, 7) : undefined;
    } catch {
        return undefined;
    }
}

export function createWorkspace(): Workspace {
    const repoRoot = findRepoRoot();
    return {
        repoRoot,
        apps: APPS,
        channels: CHANNELS,
        channelName,
        currentBranch(root: string = repoRoot) {
            return currentBranch(root);
        },
    };
}
