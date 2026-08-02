import type {ChildProcess} from 'node:child_process';
import type {Cancellation} from '../../domain/index.js';

export interface CancellationRegistry extends Cancellation {
    track(child: ChildProcess): void;
}

export function createCancellation(): CancellationRegistry {
    const activeChildren = new Set<ChildProcess>();
    let cancelling = false;

    return {
        track(child: ChildProcess): void {
            activeChildren.add(child);
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
            for (const child of activeChildren) {
                try {
                    child.kill('SIGKILL');
                    killed += 1;
                } catch {
                }
            }
            activeChildren.clear();
            return killed;
        },
    };
}
