import {execFile} from 'node:child_process';

export interface CaptureResult {
    ok: boolean;
    code: number;
    stdout: string;
    stderr: string;
}

export function capture(
    command: string,
    args: string[],
    opts: { cwd: string; env?: NodeJS.ProcessEnv; timeoutMs?: number },
): Promise<CaptureResult> {
    return new Promise((resolve) => {
        execFile(
            command,
            args,
            {
                cwd: opts.cwd,
                env: opts.env,
                timeout: opts.timeoutMs ?? 5 * 60 * 1000,
                maxBuffer: 64 * 1024 * 1024,
            },
            (err, stdout, stderr) => {
                const code =
                    err && typeof (err as any).code === 'number' ? (err as any).code : err ? 1 : 0;
                resolve({ok: !err, code, stdout: stdout ?? '', stderr: stderr ?? ''});
            },
        );
    });
}

export function parseJsonBlock(text: string): any {
    const start = text.indexOf('{');
    if (start < 0) throw new Error('No JSON object in output.');
    return JSON.parse(text.slice(start));
}
