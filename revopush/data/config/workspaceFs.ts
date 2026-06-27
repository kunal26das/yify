import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {AppTarget, Deployment, Platform, Workspace,} from '../../domain/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APP_NAME = 'Yify';

const PLATFORM_LABEL: Record<Platform, string> = {
    android: 'Android',
    ios: 'iOS',
};

const APPS: Record<Platform, AppTarget> = {
    android: {name: APP_NAME, platform: 'android'},
    ios: {name: APP_NAME, platform: 'ios'},
};

const DEPLOYMENTS: Deployment[] = ['Staging', 'Production'];

function deploymentName(platform: Platform, deployment: Deployment): string {
    return `${deployment}-${PLATFORM_LABEL[platform]}`;
}

export function findRepoRoot(): string {
    let dir = __dirname;
    for (let i = 0; i < 8; i++) {
        const pkgPath = path.join(dir, 'package.json');
        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                const scripts = pkg.scripts ?? {};
                const deps = {
                    ...(pkg.dependencies ?? {}),
                    ...(pkg.devDependencies ?? {}),
                };
                const looksLikeRepo =
                    Object.keys(scripts).some((s) => s.startsWith('revopush-')) ||
                    '@revopush/react-native-code-push' in deps;
                if (looksLikeRepo) return dir;
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
        deployments: DEPLOYMENTS,
        deploymentName,
        currentBranch(root: string = repoRoot) {
            return currentBranch(root);
        },
    };
}
