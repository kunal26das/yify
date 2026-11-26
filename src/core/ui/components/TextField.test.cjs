const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, hosts, render, spy, texts} = require('../testing/kit.cjs');

function flat(style) {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

test('the persistent label names the input, and the helper and counter sit below it', () => {
  const kit = createKit();
  const {TextField} = kit.load('src/core/ui/components/TextField.tsx');
  const view = render(React.createElement(TextField, {label: 'Note', value: 'Rewatched', onChangeText: spy(), multiline: true, maxLength: 1000, showCounter: true, helper: 'Only you can see this.'}));
  const [input] = hosts(view.root, 'TextInput');
  const [label] = hosts(view.root, 'Text');
  assert.equal(input.props['aria-labelledby'], label.props.nativeID);
  assert.ok(label.props.nativeID.length > 0);
  assert.equal(input.props['aria-invalid'], undefined);
  assert.equal(flat(input.props.style).minHeight, 120);
  assert.deepEqual(texts(view.root), ['Note', 'Only you can see this.', '9/1000']);
  assert.equal(kit.rn.AccessibilityInfo.announceForAccessibility.calls.length, 0);
});

test('an error is shown in the error colour, marks the input invalid and is announced', () => {
  const kit = createKit();
  const {TextField} = kit.load('src/core/ui/components/TextField.tsx');
  const view = render(React.createElement(TextField, {label: 'List name', value: '', onChangeText: spy(), error: 'Enter a name for the list.'}));
  const [input] = hosts(view.root, 'TextInput');
  assert.equal(input.props['aria-invalid'], true);
  assert.equal(flat(input.props.style).borderColor, '#FF97A6');
  assert.equal(flat(input.props.style).borderWidth, 2);
  assert.deepEqual(kit.rn.AccessibilityInfo.announceForAccessibility.calls, [['Enter a name for the list.']]);
  const live = hosts(view.root, 'View').find((node) => node.props['aria-live'] === 'polite');
  assert.ok(live);
  assert.equal(flat(input.props.style).minHeight, 56);
});
