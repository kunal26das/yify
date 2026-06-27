import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import type {
    LogLine,
    OnLine,
    ReleaseCli,
    RunOptions,
    RunResult,
    Workspace,
} from '../../domain/index.js';
import {pumpLines} from '../process/linePump.js';
import type {CancellationRegistry} from '../process/cancellationRegistry.js';

const require = createRequire(import.meta.url);

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

const UNCHANGED_RE =
    /identical to the contents of the specified deployment's current release/i;
const TRANSIENT_RE = /\bEPIPE\b|\bECONNRESET\b/;

function revopushCliPath(): string {
    const pkgJson = require.resolve('@revopush/code-push-cli/package.json');
    return path.join(path.dirname(pkgJson), 'bin', 'script', 'cli.js');
}

function nodeBinaryPath(): string {
    if (process.versions.electron) {
        return process.env.npm_node_execpath || process.env.NODE || 'node';
    }
    return process.execPath;
}

export function createReleaseCli(deps: {
    workspace: Workspace;
    cancellation: CancellationRegistry;
}): ReleaseCli {
    const {workspace, cancellation} = deps;
    const repoRoot = workspace.repoRoot;

    function spawnRevopush(
        args: string[],
        onLine: OnLine,
        label?: string,
    ): Promise<RunResult> {
        return new Promise((resolve) => {
            let unchanged = false;
            const emit = (stream: LogLine['stream'], text: string) => {
                if (UNCHANGED_RE.test(text)) unchanged = true;
                onLine({stream, text, label});
            };

            const cli = revopushCliPath();

            let tmp: string;
            try {
                tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'revopush-'));
            } catch {
                tmp = os.tmpdir();
            }

            emit('system', `$ revopush ${args.join(' ')}  (cwd: ${repoRoot})`);

            const child = spawn(nodeBinaryPath(), [cli, ...args], {
                cwd: repoRoot,
                env: {...process.env, TMPDIR: tmp, TMP: tmp, TEMP: tmp},
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
                emit('stderr', `Failed to start revopush CLI: ${err.message}`);
                finish({code: 1, ok: false});
            });

            child.on('close', (code) => {
                const exit = code ?? 1;
                if (unchanged) {
                    emit(
                        'system',
                        'No new release: bundle is identical to the current release — treating as success.',
                    );
                    finish({code: exit, ok: true, unchanged: true});
                    return;
                }
                emit('system', `revopush exited with code ${exit}`);
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
            last = await spawnRevopush(args, tap, opts.label);
            if (last.ok || !transient) return last;
            if (attempt < maxRetries) {
                onLine({
                    stream: 'system',
                    text: `Transient pipe error — retrying (attempt ${attempt + 2})…`,
                    label: opts.label,
                });
            }
        }
        return last;
    }

    return {run};
}
