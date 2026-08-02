import {spawn} from 'node:child_process';
import type {UrlOpener} from '../../domain/index.js';

export function createUrlOpener(): UrlOpener {
    function open(url: string): Promise<boolean> {
        const platform = process.platform;
        const cmd =
            platform === 'darwin'
                ? 'open'
                : platform === 'win32'
                    ? 'cmd'
                    : 'xdg-open';
        const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];

        return new Promise((resolve) => {
            try {
                const child = spawn(cmd, args, {stdio: 'ignore', detached: true});
                child.on('error', () => resolve(false));
                child.unref();
                setTimeout(() => resolve(true), 0);
            } catch {
                resolve(false);
            }
        });
    }

    return {open};
}
