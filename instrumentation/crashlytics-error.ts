import ErrorStackParser from 'error-stack-parser';

function readString(value: unknown, key: string): string | undefined {
    try {
        if (value && (typeof value === 'object' || typeof value === 'function')) {
            const field = (value as Record<string, unknown>)[key];
            if (typeof field === 'string') return field;
        }
    } catch {}
    return undefined;
}

function describe(value: unknown): string {
    try {
        return String(value);
    } catch {
        return 'Unknown thrown value';
    }
}

function parseFrames(stack: string | undefined): ErrorStackParser.StackFrame[] {
    if (!stack) return [];
    try {
        const error = new Error();
        error.stack = stack;
        return ErrorStackParser.parse(error).filter(frame =>
            frame.lineNumber !== undefined || frame.columnNumber !== undefined ||
            ['native', '(native)', '[native code]'].includes(frame.fileName || '')
        );
    } catch {
        return [];
    }
}

function fingerprint(value: string): string {
    let hash = 0xcbf29ce484222325n;
    for (let i = 0; i < value.length; i++) {
        hash ^= BigInt(value.charCodeAt(i));
        hash = BigInt.asUintN(64, hash * 0x100000001b3n);
    }
    return hash.toString(16).padStart(16, '0')
        .replace(/[0-9a-f]/g, nibble => String.fromCharCode(97 + parseInt(nibble, 16)));
}

function fileLocation(file: string | undefined): string {
    return (file || '<unknown>').replace(/^address at /, '').split(/[?#]/, 1)[0];
}

function groupingFile(file: string | undefined): string {
    const location = fileLocation(file).replace(/\\/g, '/');
    const basename = location.split('/').pop() || '<unknown>';
    if (/\.(?:bundle|jsbundle|hbc)$/.test(basename) || /^[a-f0-9-]{32,}(?:\.js)?$/i.test(basename)) {
        return basename;
    }
    return location.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '').replace(/^\/+/, '');
}

export function createCrashlyticsError(input: unknown): Error {
    const name = readString(input, 'name') || 'Error';
    const message = readString(input, 'message') ?? describe(input);
    const originalStack = readString(input, 'stack');
    let frames = parseFrames(originalStack);
    if (!frames.some(frame => frame.lineNumber !== undefined)) {
        const componentFrames = parseFrames(readString(input, 'componentStack'));
        if (componentFrames.length) frames = componentFrames;
    }
    const failure = frames.find(frame => frame.fileName && (frame.lineNumber || frame.columnNumber));
    const identity = failure
        ? [name, failure.functionName || '<anonymous>', groupingFile(failure.fileName),
            failure.lineNumber || 0, failure.columnNumber || 0]
        : [name, message.replace(/\s+/g, ' ').trim()];
    const signature = fingerprint(JSON.stringify(identity));
    const symbol = `YifyReactNative.${signature}.${failure?.functionName || 'anonymous'}_${name.replace(/[^a-zA-Z0-9_$]/g, '_')}`;
    const copy = new Error(message);
    copy.name = name;
    const componentStack = readString(input, 'componentStack');
    if (componentStack) Object.assign(copy, {componentStack});
    copy.stack = [
        `${name}: ${message}`,
        ...(!failure ? [`    at ${symbol} (react-native-crash:1:1)`] : []),
        ...frames.map(frame => {
            const functionName = frame === failure ? symbol : frame.functionName || '<anonymous>';
            return `    at ${functionName} (${fileLocation(frame.fileName)}:${frame.lineNumber || 0}:${frame.columnNumber || 0})`;
        }),
        ...(!frames.length && originalStack ? [originalStack] : []),
    ].join('\n');
    return copy;
}
