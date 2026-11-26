import {Share} from 'react-native';

export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'failed';

export interface ShareInput {
  title: string;
  message: string;
  url: string;
}

function shareText(input: ShareInput): string {
  return input.message.includes(input.url) ? input.message : `${input.message} ${input.url}`.trim();
}

export async function shareLink(input: ShareInput): Promise<ShareOutcome> {
  try {
    const result = await Share.share({title: input.title, message: shareText(input), url: input.url}, {dialogTitle: input.title});
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return 'failed';
  }
}
