import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
    LogLine,
    OnLine,
    ReleaseCli,
    RunOptions,
    RunResult,
    SessionStore,
    Workspace,
} from '../../domain/index.js';
import {pumpLines} from '../process/linePump.js';
import type {CancellationRegistry} from '../process/cancellationRegistry.js';
import {easCliPath, easEnv, nodeBinaryPath} from './easBin.js';

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

const TRANSIENT_RE = /\bEPIPE\b|\bECONNRESET\b|\bETIMEDOUT\b/;

export function createReleaseCli(deps: {
    workspace: Workspace;
    sessionStore: SessionStore;
    cancellation: CancellationRegistry;
}): ReleaseCli {
    const {workspace, sessionStore, cancellation} = deps;
    const repoRoot = workspace.repoRoot;

    function spawnEas(
        args: string[],
        onLine: OnLine,
        label?: string,
    ): Promise<RunResult> {
        return new Promise((resolve) => {
            const emit = (stream: LogLine['stream'], text: string) => {
                onLine({stream, text, label});
            };

            const cli = easCliPath();

            let tmp: string;
            try {
                tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yify-release-'));
            } catch {
                tmp = os.tmpdir();
            }

            emit('system', `$ eas ${args.join(' ')}  (cwd: ${repoRoot})`);

            const env = easEnv(sessionStore.read());
            const child = spawn(nodeBinaryPath(), [cli, ...args], {
                cwd: repoRoot,
                env: {...env, TMPDIR: tmp, TMP: tmp, TEMP: tmp},
            });
            cancellation.track(child);

            let idle: NodeJS.Timeout | undefined;
            const bumpIdle = () => {
                if (idle) clearTimeout(idle);
                idle = setTimeout(() => {
                    emit(
                        'stderr',
                        `No output for ${
                            IDLE_TIMEOUT_MS / 60000
                        } min — terminating (likely hung).`,
                    );
                    child.kill('SIGKILL');
                }, IDLE_TIMEOUT_MS);
            };
            const finish = (result: RunResult) => {
                if (idle) clearTimeout(idle);
                try {
                    if (tmp !== os.tmpdir())
                        fs.rmSync(tmp, {recursive: true, force: true});
                } catch {
                }
                resolve(result);
            };

            const pump = (
                streamType: 'stdout' | 'stderr',
                stream: NodeJS.ReadableStream | null,
            ) => pumpLines(streamType, stream, {onData: bumpIdle, onLine: emit});

            bumpIdle();
            pump('stdout', child.stdout);
            pump('stderr', child.stderr);

            child.on('error', (err) => {
                emit('stderr', `Failed to start the eas CLI: ${err.message}`);
                finish({code: 1, ok: false});
            });

            child.on('close', (code) => {
                const exit = code ?? 1;
                emit('system', `eas exited with code ${exit}`);
                finish({code: exit, ok: exit === 0});
            });
        });
    }

    async function run(
        args: string[],
        onLine: OnLine,
        opts: RunOptions = {},
    ): Promise<RunResult> {
        const maxRetries = opts.retries ?? 1;
        let last: RunResult = {code: 1, ok: false};

        if (cancellation.isCancelling()) return {code: 130, ok: false};

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            let transient = false;
            const tap = (line: LogLine) => {
                if (TRANSIENT_RE.test(line.text)) transient = true;
                onLine(line);
            };
            last = await spawnEas(args, tap, opts.label);
            if (last.ok || !transient) return last;
            if (attempt < maxRetries) {
                onLine({
                    stream: 'system',
                    text: `Transient network error — retrying (attempt ${attempt + 2})…`,
                    label: opts.label,
                });
            }
        }
        return last;
    }

    return {run};
}
