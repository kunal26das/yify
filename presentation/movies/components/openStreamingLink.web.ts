import {safeStreamingUrl} from '@/domain';

export async function openStreamingLink(value: string): Promise<void> {
    const url = safeStreamingUrl(value);
    if (!url || typeof window === 'undefined') throw new Error('Invalid streaming link');
    window.open(url, '_blank', 'noopener,noreferrer');
}
