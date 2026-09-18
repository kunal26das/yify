export function sentryEnvironment({native, channel, configured, hostname}: {
    native: boolean;
    channel?: string | null;
    configured?: string;
    hostname?: string;
}): 'production' | 'preview' {
    if (native) return channel?.toLowerCase() === 'staging' ? 'preview' : 'production';
    if (configured === 'preview') return 'preview';
    const host = hostname?.toLowerCase() ?? '';
    if (host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' || host === '::1'
        || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)
        || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host) || /^yify--[a-z0-9-]+\.expo\.app$/.test(host)) {
        return 'preview';
    }
    return 'production';
}
