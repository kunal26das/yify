export function watchForeground(onForeground: () => void): () => void {
    if (typeof document === 'undefined') return () => undefined;
    const handler = () => {
        if (document.visibilityState === 'visible') onForeground();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
}
