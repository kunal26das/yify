const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, hosts, press, render, spy, touchableStyle} = require('../testing/kit.cjs');

function flat(style) {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

test('the label is the accessible name and the target reaches 48 dp', () => {
  const kit = createKit();
  const {IconButton} = kit.load('src/core/ui/components/IconButton.tsx');
  const onPress = spy();
  const view = render(React.createElement(IconButton, {icon: 'share', label: 'Share', onPress}));
  const [pressable] = hosts(view.root, 'Pressable');
  assert.equal(pressable.props['aria-label'], 'Share');
  assert.equal(pressable.props.role, 'button');
  assert.equal(pressable.props.hitSlop, 4);
  const style = touchableStyle(pressable);
  assert.equal(style.width, 40);
  assert.equal(style.height, 40);
  press(pressable);
  assert.equal(onPress.calls.length, 1);
});

test('selected icon buttons are toggles with a filled glyph', () => {
  const kit = createKit();
  const {IconButton} = kit.load('src/core/ui/components/IconButton.tsx');
  const view = render(React.createElement(IconButton, {icon: 'search', label: 'Search your library', selected: true, onPress: spy()}));
  const [pressable] = hosts(view.root, 'Pressable');
  assert.equal(pressable.props.accessibilityRole, 'togglebutton');
  assert.equal(pressable.props['aria-checked'], true);
  assert.equal(hosts(view.root, 'Glyph')[0].props.fontName, 'YifyIconsFilled');
  assert.equal(hosts(view.root, 'Glyph')[0].props.color, '#C8F03C');
});

test('the media variant is the only control drawn over artwork: a dark disc with an onMedia glyph', () => {
  const kit = createKit();
  const {IconButton} = kit.load('src/core/ui/components/IconButton.tsx');
  const view = render(React.createElement(IconButton, {icon: 'arrow_back', label: 'Navigate up', variant: 'media', onPress: spy()}));
  const style = flat(hosts(view.root, 'Pressable')[0].props.style);
  assert.equal(style.backgroundColor, 'rgba(0, 0, 0, 0.6)');
  assert.equal(hosts(view.root, 'Glyph')[0].props.color, '#FFFFFF');
});

test('disabled icon buttons cannot be pressed and dim the glyph', () => {
  const kit = createKit();
  const {IconButton} = kit.load('src/core/ui/components/IconButton.tsx');
  const view = render(React.createElement(IconButton, {icon: 'delete', label: 'Delete', disabled: true, onPress: spy()}));
  const [pressable] = hosts(view.root, 'Pressable');
  assert.equal(pressable.props['aria-disabled'], true);
  assert.equal(pressable.props.onPress, undefined);
  assert.ok(hosts(view.root, 'View').some((node) => flat(node.props.style).opacity === 0.38));
});
