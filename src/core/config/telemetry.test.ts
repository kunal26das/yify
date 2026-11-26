import assert from 'node:assert/strict';
import {test} from 'node:test';
import sentry from '../../../sentry.options.json';
import {SENTRY_DSN, SENTRY_ENVELOPE_URL, sentryEnvelopeUrl} from './telemetry';

test('server alerts post to the envelope endpoint of the committed public DSN', () => {
  assert.equal(SENTRY_DSN, sentry.dsn);
  assert.equal(SENTRY_ENVELOPE_URL, 'https://o4512058491338752.ingest.us.sentry.io/api/4512058497695744/envelope/');
  const parsed = new URL(sentry.dsn);
  assert.equal(SENTRY_ENVELOPE_URL, `https://${parsed.host}/api${parsed.pathname}/envelope/`);
  assert.throws(() => sentryEnvelopeUrl('https://sentry.io/'), /Sentry DSN/);
});
