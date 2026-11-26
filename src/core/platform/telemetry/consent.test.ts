import assert from 'node:assert/strict';
import {test} from 'node:test';
import {analyticsConsented, applyTelemetryConsent, consentPermits, consentToken, subscribeTelemetryConsent} from './consent';
import {consentedMetric, CONSENT_REVISION, filterSentryEnvelope, telemetryConsentGate} from './consentFilter';

test('consent starts off, issues a token per grant and notifies only on change', () => {
  const seen: boolean[] = [];
  const stop = subscribeTelemetryConsent((analytics) => seen.push(analytics));
  assert.equal(analyticsConsented(), false);
  assert.equal(consentToken(), undefined);
  applyTelemetryConsent(false);
  applyTelemetryConsent(true);
  const first = consentToken();
  assert.equal(typeof first, 'number');
  assert.equal(consentPermits(first), true);
  applyTelemetryConsent(true);
  applyTelemetryConsent(false);
  assert.equal(consentPermits(first), false);
  applyTelemetryConsent(true);
  assert.notEqual(consentToken(), first);
  assert.equal(consentPermits(first), false);
  assert.deepEqual(seen, [true, false, true]);
  stop();
  applyTelemetryConsent(false);
  assert.deepEqual(seen, [true, false, true]);
});

test('the transport filter keeps errors and drops metrics and traces captured under another consent', () => {
  applyTelemetryConsent(true);
  const token = consentToken();
  const metric = consentedMetric({name: 'yify.operation', attributes: {operation: 'api.home'}});
  assert.equal(metric?.attributes[CONSENT_REVISION], token);
  const envelope = [{}, [
    [{type: 'event'}, {}],
    [{type: 'trace_metric', item_count: 2}, {items: [{attributes: {[CONSENT_REVISION]: {value: token}}}, {attributes: {[CONSENT_REVISION]: 999}}]}],
    [{type: 'transaction'}, {contexts: {trace: {data: {[CONSENT_REVISION]: token}}}, spans: [{data: {[CONSENT_REVISION]: token}}]}],
    [{type: 'log'}, {items: []}],
    [{type: 'replay_event'}, {}],
  ]] as unknown as Parameters<typeof filterSentryEnvelope>[0];
  const [, items] = filterSentryEnvelope(envelope, telemetryConsentGate) as unknown as [unknown, [{type: string; item_count?: number}, any][]];
  assert.deepEqual(items.map(([header]) => header.type), ['event', 'trace_metric', 'transaction']);
  assert.equal(items[1][0].item_count, 1);
  assert.equal(items[2][1].contexts.trace.data[CONSENT_REVISION], undefined);
  applyTelemetryConsent(false);
  assert.equal(consentedMetric({name: 'yify.operation', attributes: {}}), null);
  const [, revoked] = filterSentryEnvelope(envelope, telemetryConsentGate) as unknown as [unknown, unknown[]];
  assert.equal(revoked.length, 1);
});
