import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {Session, SessionStore} from '../../domain/index.js';

export function createSessionStore(): SessionStore {
    function configFilePath(): string {
        const base = process.env.LOCALAPPDATA || process.env.HOME || os.homedir();
        return path.join(base, '.yify-release.json');
    }

    function read(): Session | null {
        const fromEnv = (process.env.EXPO_TOKEN ?? '').trim();
        if (fromEnv) return {token: fromEnv};

        let raw: string;
        try {
            raw = fs.readFileSync(configFilePath(), 'utf8');
        } catch {
            return null;
        }

        let parsed: any;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return null;
        }

        const token: string | undefined = parsed.token;
        if (!token) return null;
        return {token};
    }

    function save(token: string): void {
        fs.writeFileSync(
            configFilePath(),
            `${JSON.stringify({token}, null, 2)}\n`,
            {mode: 0o600},
        );
    }

    function clear(): void {
        try {
            fs.rmSync(configFilePath(), {force: true});
        } catch {
        }
    }

    return {read, save, configFilePath, clear};
}
