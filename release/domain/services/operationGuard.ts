import type {OperationType} from '../entities/index.js';
import type {Cancellation} from '../repositories/index.js';

export interface OperationGuard {
    activeOperation(): OperationType | null;

    withOperation<T>(
        type: OperationType,
        fn: () => Promise<T>,
    ): Promise<{ ok: true; result: T } | { ok: false; busy: OperationType }>;
}

export function createOperationGuard(
    cancellation: Cancellation,
): OperationGuard {
    let active: OperationType | null = null;

    return {
        activeOperation() {
            return active;
        },
        async withOperation(type, fn) {
            if (active) return {ok: false, busy: active};
            active = type;
            cancellation.beginScope();
            try {
                return {ok: true, result: await fn()};
            } finally {
                active = null;
            }
        },
    };
}
