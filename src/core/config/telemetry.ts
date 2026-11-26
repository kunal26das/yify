import sentry from '../../../sentry.options.json';

export function sentryEnvelopeUrl(dsn: string): string {
  const match = /^https:\/\/[0-9a-f]+@([a-z0-9.-]+)\/(\d+)$/.exec(dsn);
  if (!match) throw new Error('The Sentry DSN must look like https://<key>@<host>/<project>.');
  return `https://${match[1]}/api/${match[2]}/envelope/`;
}

export const SENTRY_DSN: string = sentry.dsn;
export const SENTRY_ENVELOPE_URL = sentryEnvelopeUrl(SENTRY_DSN);
