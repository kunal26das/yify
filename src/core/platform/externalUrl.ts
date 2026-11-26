const PRIVATE_HOST = /(^|\.)(localhost|local|internal|test|invalid)$/;
const MAILTO = /^mailto:[^\s@/?#]+@[^\s@/?#]+\.[^\s@/?#]+(\?[^\s]*)?$/i;

export function safeExternalUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.')
      || PRIVATE_HOST.test(url.hostname) || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':')) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function safeMailtoUrl(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= 2048 && MAILTO.test(value) ? value : undefined;
}

export function mailtoUrl(address: string, subject?: string): string | undefined {
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  return safeMailtoUrl(`mailto:${address}${query}`);
}
