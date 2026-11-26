const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, act, createKit, findByProp, press, render, spy, texts} = require('../../../core/ui/testing/kit.cjs');

test('RootErrorBoundary reports the error once and offers Try again', async () => {
  const kit = createKit();
  const reportError = spy();
  const {RootErrorBoundary, ROOT_ERROR_COPY} = kit.load('src/features/shell/public/RootErrorBoundary.tsx', {
    '@/core/platform/telemetry/sentry': {reportError},
  });
  const error = new Error('boom');
  const retry = spy(() => Promise.resolve());
  const view = render(React.createElement(RootErrorBoundary, {error, retry}));
  assert.deepEqual(reportError.calls, [[error, {boundary: 'root'}]]);
  assert.equal(ROOT_ERROR_COPY.title, 'Something went wrong');
  assert.match(ROOT_ERROR_COPY.body, /^\S+ hit an unexpected problem\.$/);
  const shown = texts(view.root);
  assert.ok(shown.includes(ROOT_ERROR_COPY.title));
  assert.ok(shown.includes(ROOT_ERROR_COPY.body));
  const [button] = findByProp(view.root, 'role', 'button');
  press(button);
  await act(async () => undefined);
  assert.equal(retry.calls.length, 1);
  view.update(React.createElement(RootErrorBoundary, {error, retry}));
  assert.equal(reportError.calls.length, 1);
});
