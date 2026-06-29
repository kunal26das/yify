export function errMessage(e: unknown): string {
    if (e instanceof Error && e.message) return e.message;
    if (typeof e === 'string' && e.trim()) return e;
    if (e && typeof e === 'object') {
        const msg = (e as { message?: unknown }).message;
        if (typeof msg === 'string' && msg.trim()) return msg;
        try {
            const s = JSON.stringify(e);
            if (s && s !== '{}') return s;
        } catch {
        }
    }
    return String(e);
}
