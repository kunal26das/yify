const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, act, createKit, findByProp, hosts, press, render, spy} = require('../testing/kit.cjs');

const OPTIONS = [
  {value: 'system', label: 'System'},
  {value: 'light', label: 'Light'},
  {value: 'dark', label: 'Dark'},
];

test('segments are radios in a labelled radiogroup with the selection checked', () => {
  const kit = createKit();
  const {SegmentedButton} = kit.load('src/core/ui/components/SegmentedButton.tsx');
  const onChange = spy();
  const view = render(React.createElement(SegmentedButton, {value: 'dark', options: OPTIONS, onChange, accessibilityLabel: 'Theme'}));
  const [group] = findByProp(view.root, 'role', 'radiogroup');
  assert.equal(group.props['aria-label'], 'Theme');
  const radios = hosts(view.root, 'Pressable');
  assert.deepEqual(radios.map((node) => node.props.role), ['radio', 'radio', 'radio']);
  assert.deepEqual(radios.map((node) => node.props['aria-checked']), [false, false, true]);
  assert.deepEqual(radios.map((node) => node.props.tabIndex), [undefined, undefined, undefined]);
  assert.equal(hosts(view.root, 'Glyph')[0].props.name, 'check');
  press(radios[1]);
  press(radios[2]);
  assert.deepEqual(onChange.calls, [['light']]);
});

test('on web the group uses a roving tab index and arrow, Home and End keys select', () => {
  const kit = createKit({web: true});
  const {SegmentedButton, nextSegmentIndex} = kit.load('src/core/ui/components/SegmentedButton.tsx');
  const onChange = spy();
  const view = render(React.createElement(SegmentedButton, {value: 'light', options: OPTIONS, onChange, accessibilityLabel: 'Theme'}));
  assert.deepEqual(hosts(view.root, 'Pressable').map((node) => node.props.tabIndex), [-1, 0, -1]);
  const [group] = findByProp(view.root, 'role', 'radiogroup');
  const preventDefault = spy();
  act(() => group.props.onKeyDown({key: 'ArrowRight', preventDefault}));
  act(() => group.props.onKeyDown({key: 'Home', preventDefault}));
  act(() => group.props.onKeyDown({key: 'Tab', preventDefault}));
  assert.deepEqual(onChange.calls, [['dark'], ['system']]);
  assert.equal(preventDefault.calls.length, 2);
  assert.equal(nextSegmentIndex('ArrowLeft', 0, 3), 2);
  assert.equal(nextSegmentIndex('ArrowDown', 2, 3), 0);
  assert.equal(nextSegmentIndex('End', 0, 3), 2);
  assert.equal(nextSegmentIndex('a', 0, 3), null);
});
