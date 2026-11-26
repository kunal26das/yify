const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, findByProp, hosts, press, render, spy, texts} = require('../testing/kit.cjs');

test('actions render as a list of rows that close the sheet before running', () => {
  const kit = createKit();
  const {ActionSheet} = kit.load('src/core/ui/components/ActionSheet.tsx');
  const order = [];
  const onClose = spy(() => order.push('close'));
  const remove = spy(() => order.push('remove'));
  const view = render(React.createElement(ActionSheet, {
    open: true,
    onClose,
    title: 'The Matrix',
    actions: [
      {icon: 'bookmark_add', label: 'Add to watchlist', onPress: spy()},
      {icon: 'delete', label: 'Remove', destructive: true, onPress: remove},
    ],
  }));
  assert.equal(findByProp(view.root, 'role', 'list').length, 1);
  assert.equal(findByProp(view.root, 'role', 'listitem').length, 2);
  assert.ok(texts(view.root).includes('Remove'));
  const rows = hosts(view.root, 'Pressable').filter((node) => node.props['aria-label'] !== 'Close' && node.props['aria-hidden'] !== true);
  assert.equal(rows.length, 2);
  press(rows[1]);
  assert.deepEqual(order, ['close', 'remove']);
  const destructive = hosts(view.root, 'Text').find((node) => node.props.children === 'Remove');
  assert.equal(Object.assign({}, ...destructive.props.style.flat().filter(Boolean)).color, '#FF97A6');
});
