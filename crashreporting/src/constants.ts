export const GLOBAL_MECHANISM = 'react_native.crash_bridge.global';
export const GROUPING_NAMESPACE = 'ReactNativeCrash';

export function diagnosticOperation(value: unknown): string | undefined {
    return typeof value === 'string' && value.length <= 80 &&
        value.match(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/)?.[0] === value ? value : undefined;
}
