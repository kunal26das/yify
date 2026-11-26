const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, hosts, press, render, spy, texts} = require('../testing/kit.cjs');

test('an empty state has a heading, body and up to two actions', () => {
  const kit = createKit();
  const {EmptyState} = kit.load('src/core/ui/components/EmptyState.tsx');
  const onBrowse = spy();
  const view = render(React.createElement(EmptyState, {icon: 'bookmark', title: 'Your watchlist is empty', body: 'Save titles to watch later.', primary: {label: 'Browse', onPress: onBrowse}, secondary: {label: 'Search', href: '/search'}}));
  const heading = hosts(view.root, 'Text').find((node) => node.props.role === 'heading');
  assert.equal(heading.props.children, 'Your watchlist is empty');
  assert.deepEqual(texts(view.root), ['Your watchlist is empty', 'Save titles to watch later.', 'Browse', 'Search']);
  assert.equal(hosts(view.root, 'Glyph')[0].props.size, 48);
  press(hosts(view.root, 'Pressable')[0]);
  assert.equal(onBrowse.calls.length, 1);
  const section = render(React.createElement(EmptyState, {icon: 'cloud_off', title: "You're offline", size: 'section'}));
  assert.equal(hosts(section.root, 'Glyph')[0].props.size, 24);
});
