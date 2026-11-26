import type {OpenUrlOptions} from './openUrl';
import {mailtoUrl, safeExternalUrl, safeMailtoUrl} from './externalUrl';

export type {OpenUrlOptions};
export {mailtoUrl, safeExternalUrl, safeMailtoUrl};

export async function openUrl(value: string, _options: OpenUrlOptions = {}): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const mail = safeMailtoUrl(value);
  if (mail !== undefined) {
    window.location.href = mail;
    return true;
  }
  const url = safeExternalUrl(value);
  if (url === undefined) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
