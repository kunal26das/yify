import type {ShareInput, ShareOutcome} from './share';

export type {ShareInput, ShareOutcome};

function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'name') === 'AbortError';
}

export async function shareLink(input: ShareInput): Promise<ShareOutcome> {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  if (typeof nav?.share === 'function') {
    try {
      await nav.share({title: input.title, text: input.message, url: input.url});
      return 'shared';
    } catch (error) {
      if (isAbort(error)) return 'dismissed';
    }
  }
  try {
    if (typeof nav?.clipboard?.writeText === 'function') {
      await nav.clipboard.writeText(input.url);
      return 'copied';
    }
  } catch {
    return 'failed';
  }
  return 'failed';
}
