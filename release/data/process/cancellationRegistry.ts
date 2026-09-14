import type {ChildProcess} from 'node:child_process';
import type {Cancellation} from '../../domain/index.js';

export interface CancellationRegistry extends Cancellation {
    track(child: ChildProcess, signal?: NodeJS.Signals, options?: { processGroup?: boolean }): void;
}

export function createCancellation(): CancellationRegistry {
    const activeChildren = new Map<ChildProcess, { signal: NodeJS.Signals; processGroup: boolean }>();
    let cancelling = false;

    return {
        track(child: ChildProcess, signal: NodeJS.Signals = 'SIGKILL', options = {}): void {
            activeChildren.set(child, {signal, processGroup: options.processGroup ?? false});
            const remove = () => activeChildren.delete(child);
            child.on('close', remove);
            child.on('error', remove);
        },
        beginScope(): void {
            cancelling = false;
        },
        isCancelling(): boolean {
            return cancelling;
        },
        cancelActive(): number {
            cancelling = true;
            let killed = 0;
            for (const [child, {signal, processGroup}] of activeChildren) {
                try {
                    if (processGroup && child.pid) process.kill(-child.pid, signal);
                    else child.kill(signal);
                    killed += 1;
                } catch {
                }
            }
            activeChildren.clear();
            return killed;
        },
    };
}
