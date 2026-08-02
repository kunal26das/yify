import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import type {Session} from '../../domain/index.js';

const require = createRequire(import.meta.url);

export function easCliPath(): string {
    const pkgPath = require.resolve('eas-cli/package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.eas;
    if (!bin) throw new Error('eas-cli does not expose an "eas" bin entry.');
    return path.join(path.dirname(pkgPath), bin);
}

export function expoUpdatesCliPath(repoRoot: string): string {
    return path.join(repoRoot, 'node_modules', 'expo-updates', 'bin', 'cli.js');
}

export function nodeBinaryPath(): string {
    if (process.versions.electron) {
        return process.env.npm_node_execpath || process.env.NODE || 'node';
    }
    return process.execPath;
}

export function easEnv(session: Session | null): NodeJS.ProcessEnv {
    const env = {...process.env};
    if (session?.token) env.EXPO_TOKEN = session.token;
    else delete env.EXPO_TOKEN;
    return env;
}
