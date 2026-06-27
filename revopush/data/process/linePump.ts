export interface PumpHooks {
    onData?: () => void;
    onLine: (stream: 'stdout' | 'stderr', text: string) => void;
}

export function pumpLines(
    streamType: 'stdout' | 'stderr',
    stream: NodeJS.ReadableStream | null,
    hooks: PumpHooks,
): void {
    if (!stream) return;
    stream.on('error', () => {
    });
    let buffer = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk: string) => {
        hooks.onData?.();
        buffer += chunk;
        const parts = buffer.split(/\r?\n/);
        buffer = parts.pop() ?? '';
        for (const line of parts) hooks.onLine(streamType, line);
    });
    stream.on('end', () => {
        if (buffer.length) hooks.onLine(streamType, buffer);
    });
}
