import {Clipboard} from 'react-native';

export type ShareOutcome = 'shared' | 'copied' | 'failed';

export async function shareLink(title: string, message: string, url: string): Promise<ShareOutcome> {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.share) {
        try {
            await nav.share({title, text: message, url});
            return 'shared';
        } catch {
        }
    }
    try {
        if (nav?.clipboard?.writeText) {
            await nav.clipboard.writeText(url);
            return 'copied';
        }
    } catch {
    }
    try {
        Clipboard.setString(url);
        return 'copied';
    } catch {
        return 'failed';
    }
}
