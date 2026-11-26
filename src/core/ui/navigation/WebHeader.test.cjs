const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, findByProp, hosts, press, render, texts} = require('../testing/kit.cjs');
const {tabProps} = require('../testing/tabs.cjs');

test('the header is a banner with the wordmark, Main navigation, search slot and the You link', () => {
  const kit = createKit({web: true});
  const {WebHeader, YOU_LINK_LABEL, WORDMARK_LABEL} = kit.load('src/core/ui/navigation/WebHeader.tsx');
  const {APP_NAME} = kit.load('src/core/config/app.ts');
  const {props} = tabProps(2, {youBadge: 'billing'});
  const view = render(React.createElement(WebHeader, {...props, headerSearch: React.createElement('Text', null, 'Search slot'), account: {name: 'Ada Lovelace', photoUrl: null}}));
  const [banner] = findByProp(view.root, 'role', 'banner');
  assert.deepEqual(banner.props.dataSet, {nav: 'header'});
  assert.equal(WORDMARK_LABEL, `${APP_NAME} home`);
  const links = hosts(view.root, 'Pressable');
  assert.deepEqual(links.map((node) => node.props['aria-label'] ?? hosts(node, 'Text').map((text) => text.props.children).join('')), [WORDMARK_LABEL, 'Home', 'Library', `${YOU_LINK_LABEL}, payment issue`]);
  assert.deepEqual(links.map((node) => node.props.href), ['/', '/', '/library', '/you']);
  assert.deepEqual(links.map((node) => node.props['aria-current']), [undefined, undefined, 'page', undefined]);
  const [nav] = findByProp(view.root, 'role', 'navigation');
  assert.equal(nav.props['aria-label'], 'Main');
  assert.equal(hosts(nav, 'Pressable').length, 2);
  assert.ok(texts(view.root).includes('Search slot'));
  press(links[1]);
  assert.deepEqual(props.navigateToTab.calls, [['(home)-key']]);
});

test('signed out, the You link shows the person glyph', () => {
  const kit = createKit({web: true});
  const {WebHeader} = kit.load('src/core/ui/navigation/WebHeader.tsx');
  const {props} = tabProps(0);
  const view = render(React.createElement(WebHeader, {...props, headerSearch: null, account: null}));
  assert.deepEqual(hosts(view.root, 'Glyph').map((node) => node.props.name), ['person']);
  assert.equal(hosts(view.root, 'Pressable').at(-1).props['aria-label'], 'You: account and settings');
});
