import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type {Installer, OnLine, RunResult, Workspace,} from '../../domain/index.js';
import {pumpLines} from '../process/linePump.js';
import type {CancellationRegistry} from '../process/cancellationRegistry.js';

export function createInstaller(deps: {
    workspace: Workspace;
    cancellation: CancellationRegistry;
}): Installer {
    const {workspace, cancellation} = deps;
    const repoRoot = workspace.repoRoot;

    function installCommand(): string {
        if (fs.existsSync(path.join(repoRoot, 'yarn.lock'))) return 'yarn install';
        if (fs.existsSync(path.join(repoRoot, 'pnpm-lock.yaml')))
            return 'pnpm install --frozen-lockfile';
        if (fs.existsSync(path.join(repoRoot, 'package-lock.json')))
            return 'npm ci';
        return 'yarn install';
    }

    function cleanInstall(onLine: OnLine, label?: string): Promise<RunResult> {
        return new Promise((resolve) => {
            if (cancellation.isCancelling()) {
                resolve({code: 130, ok: false});
                return;
            }
            const cmd = installCommand();
            const full = `rm -rf node_modules yarn.lock && ${cmd}`;
            onLine({
                stream: 'system',
                text: `$ ${full}  (cwd: ${repoRoot})`,
                label,
            });

            const child = spawn('/bin/sh', ['-c', full], {
                cwd: repoRoot,
                env: process.env,
            });
            cancellation.track(child);

            const pump = (
                streamType: 'stdout' | 'stderr',
                stream: NodeJS.ReadableStream | null,
            ) =>
                pumpLines(streamType, stream, {
                    onLine: (s, text) => onLine({stream: s, text, label}),
                });

            pump('stdout', child.stdout);
            pump('stderr', child.stderr);

            child.on('error', (err) => {
                onLine({
                    stream: 'stderr',
                    text: `Failed to start clean install: ${err.message}`,
                    label,
                });
                resolve({code: 1, ok: false});
            });
            child.on('close', (code) => {
                const exit = code ?? 1;
                onLine({
                    stream: 'system',
                    text: `clean install exited with code ${exit}`,
                    label,
                });
                resolve({code: exit, ok: exit === 0});
            });
        });
    }

    return {installCommand, cleanInstall};
}
