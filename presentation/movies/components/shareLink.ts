import {Share} from 'react-native';

export type ShareOutcome = 'shared' | 'copied' | 'failed';

export async function shareLink(title: string, message: string, url: string): Promise<ShareOutcome> {
    try {
        await Share.share({title, message, url});
        return 'shared';
    } catch {
        return 'failed';
    }
}
