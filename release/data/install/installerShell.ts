import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type {Installer, InstallMode, OnLine, RunResult, Workspace,} from '../../domain/index.js';
import {pumpLines} from '../process/linePump.js';
import type {CancellationRegistry} from '../process/cancellationRegistry.js';

export function createInstaller(deps: {
    workspace: Workspace;
    cancellation: CancellationRegistry;
}): Installer {
    const {workspace, cancellation} = deps;
    const repoRoot = workspace.repoRoot;

    function installCommand(mode: InstallMode = 'resolve'): string {
        const frozen = mode === 'frozen';
        if (fs.existsSync(path.join(repoRoot, 'yarn.lock')))
            return frozen ? 'yarn install --frozen-lockfile' : 'yarn install';
        if (fs.existsSync(path.join(repoRoot, 'pnpm-lock.yaml')))
            return frozen ? 'pnpm install --frozen-lockfile' : 'pnpm install';
        if (fs.existsSync(path.join(repoRoot, 'package-lock.json')))
            return frozen ? 'npm ci' : 'npm install';
        return 'yarn install';
    }

    async function cleanInstall(
        onLine: OnLine,
        label?: string,
        mode: InstallMode = 'resolve',
    ): Promise<RunResult> {
        if (cancellation.isCancelling()) return {code: 130, ok: false};
        const emit = (stream: 'stdout' | 'stderr' | 'system', text: string) => onLine({stream, text, label});
        const modules = path.join(repoRoot, 'node_modules');
        const lockfiles = ['yarn.lock', 'pnpm-lock.yaml', 'package-lock.json'];
        const snapshots = new Map<string, Buffer | null>();
        let backup: string | undefined;
        let movedModules = false;
        let started = false;
        let result: RunResult = {code: 1, ok: false};
        try {
            for (const name of lockfiles) {
                const file = path.join(repoRoot, name);
                snapshots.set(file, fs.existsSync(file) ? await fs.promises.readFile(file) : null);
            }
            const backupRoot = path.join(repoRoot, '.expo');
            await fs.promises.mkdir(backupRoot, {recursive: true});
            backup = await fs.promises.mkdtemp(path.join(backupRoot, 'release-install-'));
            try {
                await fs.promises.rename(modules, path.join(backup, 'node_modules'));
                movedModules = true;
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            }

            if (cancellation.isCancelling()) result = {code: 130, ok: false};
            else {
                const cmd = installCommand(mode);
                emit('system', `$ ${cmd}  (cwd: ${repoRoot})`);
                const [command, ...args] = cmd.split(' ');
                started = true;
                result = await new Promise<RunResult>((resolve) => {
                    const processGroup = process.platform !== 'win32';
                    const child = spawn(command, args, {
                        cwd: repoRoot,
                        env: process.env,
                        detached: processGroup,
                        shell: process.platform === 'win32',
                    });
                    cancellation.track(child, 'SIGKILL', {processGroup});
                    pumpLines('stdout', child.stdout, {onLine: emit});
                    pumpLines('stderr', child.stderr, {onLine: emit});
                    let failed = false;
                    child.once('error', (error) => {
                        failed = true;
                        emit('stderr', `Could not start dependency installation: ${error.message}`);
                    });
                    child.once('close', (code) => {
                        const exit = cancellation.isCancelling() ? 130 : code ?? 1;
                        resolve({code: exit, ok: !failed && exit === 0});
                    });
                });
            }
        } catch (error) {
            emit('stderr', `Dependency installation failed: ${(error as Error).message}`);
        }

        try {
            if (!result.ok && (movedModules || started)) {
                await fs.promises.rm(modules, {recursive: true, force: true});
                if (movedModules) await fs.promises.rename(path.join(backup!, 'node_modules'), modules);
                for (const [file, content] of snapshots) {
                    if (content === null) await fs.promises.rm(file, {force: true});
                    else await fs.promises.writeFile(file, new Uint8Array(content));
                }
                emit('system', movedModules
                    ? 'Installation failed. Previous dependencies and lockfiles restored.'
                    : 'Installation failed. Partial dependencies removed; lockfiles restored.');
            }
            if (backup) await fs.promises.rm(backup, {recursive: true, force: true});
        } catch (error) {
            emit('stderr', `Could not finish dependency recovery: ${(error as Error).message}. Backup retained at ${backup}.`);
            return {code: 1, ok: false};
        }
        emit('system', `Dependency installation exited with code ${result.code}.`);
        return result;
    }

    return {installCommand, cleanInstall};
}
