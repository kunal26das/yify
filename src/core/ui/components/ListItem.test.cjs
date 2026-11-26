const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, findByProp, hosts, press, render, spy, texts} = require('../testing/kit.cjs');

function flat(style) {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

test('a switch row is one switch control whose inner track is hidden', () => {
  const kit = createKit();
  const {ListItem} = kit.load('src/core/ui/components/ListItem.tsx');
  const onValueChange = spy();
  const view = render(React.createElement(ListItem, {headline: 'Trailer captions', trailing: {kind: 'switch', value: true, onValueChange}}));
  const [row] = hosts(view.root, 'Pressable');
  assert.equal(row.props.role, 'switch');
  assert.equal(row.props['aria-checked'], true);
  assert.ok(hosts(view.root, 'View').some((node) => node.props['aria-hidden'] === true));
  press(row);
  assert.deepEqual(onValueChange.calls, [[false]]);
  assert.equal(flat(row.props.style).minHeight, 56);
});

test('a check row is a checkbox and two-line rows grow to 72 dp', () => {
  const kit = createKit();
  const {ListItem, listItemMinHeight} = kit.load('src/core/ui/components/ListItem.tsx');
  const view = render(React.createElement(ListItem, {headline: 'Favourites', supporting: '12 titles', trailing: {kind: 'check', checked: false}, onPress: spy()}));
  const [row] = hosts(view.root, 'Pressable');
  assert.equal(row.props.role, 'checkbox');
  assert.equal(row.props['aria-checked'], false);
  assert.equal(flat(row.props.style).minHeight, 72);
  assert.equal(listItemMinHeight({supporting: 'a', overline: 'b'}), 88);
  assert.deepEqual(texts(view.root), ['Favourites', '12 titles']);
});

test('a trailing icon button is a separate control beside the row, and destructive rows use the error colour', () => {
  const kit = createKit();
  const {ListItem} = kit.load('src/core/ui/components/ListItem.tsx');
  const onSignOut = spy();
  const view = render(React.createElement(ListItem, {headline: 'Ada Lovelace', leading: {kind: 'avatar', name: 'Ada Lovelace'}, trailing: {kind: 'iconButton', icon: 'logout', label: 'Sign out', onPress: onSignOut}}));
  assert.equal(hosts(view.root, 'Pressable').length, 1);
  const [button] = findByProp(view.root, 'aria-label', 'Sign out');
  press(button);
  assert.equal(onSignOut.calls.length, 1);
  const destructive = render(React.createElement(ListItem, {headline: 'Delete account', destructive: true, onPress: spy()}));
  const headline = hosts(destructive.root, 'Text')[0];
  assert.equal(flat(headline.props.style).color, '#FF97A6');
  const plain = render(React.createElement(ListItem, {headline: 'Version', trailing: {kind: 'text', text: '2.0.0'}}));
  assert.equal(hosts(plain.root, 'Pressable').length, 0);
});
