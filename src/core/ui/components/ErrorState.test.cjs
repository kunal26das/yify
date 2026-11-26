const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, findByProp, hosts, press, render, spy, texts} = require('../testing/kit.cjs');

test('the default error state alerts, explains and offers Try again', () => {
  const kit = createKit();
  const {ErrorState, ERROR_COPY} = kit.load('src/core/ui/components/ErrorState.tsx');
  const onRetry = spy();
  const view = render(React.createElement(ErrorState, {onRetry}));
  const [alert] = findByProp(view.root, 'role', 'alert');
  assert.deepEqual(texts(alert), [ERROR_COPY.title]);
  assert.deepEqual(texts(view.root), ["Couldn't load this", 'Check your connection and try again.', 'Try again']);
  press(hosts(view.root, 'Pressable')[0]);
  assert.equal(onRetry.calls.length, 1);
});

test('the inline error is one line of text with a text button', () => {
  const kit = createKit();
  const {ErrorState} = kit.load('src/core/ui/components/ErrorState.tsx');
  const view = render(React.createElement(ErrorState, {size: 'inline', title: "Couldn't load more titles.", onRetry: spy()}));
  assert.deepEqual(texts(view.root), ["Couldn't load more titles.", 'Try again']);
  assert.equal(findByProp(view.root, 'role', 'alert').length, 1);
});

test('on Android the error title is announced once, and on web the alert role announces it instead', () => {
  const kit = createKit();
  const {ErrorState} = kit.load('src/core/ui/components/ErrorState.tsx');
  const view = render(React.createElement(ErrorState, {size: 'section', title: "Couldn't load Trending", onRetry: spy()}));
  view.update(React.createElement(ErrorState, {size: 'section', title: "Couldn't load Trending", onRetry: spy()}));
  assert.deepEqual(kit.rn.AccessibilityInfo.announceForAccessibility.calls, [["Couldn't load Trending"]]);
  const web = createKit({web: true});
  const {ErrorState: WebErrorState} = web.load('src/core/ui/components/ErrorState.tsx');
  const page = render(React.createElement(WebErrorState, {onRetry: spy()}));
  assert.equal(findByProp(page.root, 'role', 'alert').length, 1);
  assert.equal(web.rn.AccessibilityInfo.announceForAccessibility.calls.length, 0);
});
