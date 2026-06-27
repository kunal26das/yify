import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {Session, SessionStore} from '../../domain/index.js';

const DEFAULT_SERVER_URL = 'https://api.revopush.org';

export function createSessionStore(): SessionStore {
    function configFilePath(): string {
        const base = process.env.LOCALAPPDATA || process.env.HOME || os.homedir();
        return path.join(base, '.revopush.config');
    }

    function read(): Session | null {
        const file = configFilePath();
        let raw: string;
        try {
            raw = fs.readFileSync(file, 'utf8');
        } catch {
            return null;
        }

        let parsed: any;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return null;
        }

        const accessKey: string | undefined =
            parsed.accessKey ?? parsed.accessKeyName;
        if (!accessKey) return null;

        const serverUrl: string = parsed.customServerUrl || DEFAULT_SERVER_URL;
        return {accessKey, serverUrl: serverUrl.replace(/\/+$/, '')};
    }

    function clear(): void {
        try {
            fs.rmSync(configFilePath(), {force: true});
        } catch {
        }
    }

    return {read, configFilePath, clear};
}
