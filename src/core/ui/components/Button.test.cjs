const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, hosts, press, render, spy, texts, touchableStyle} = require('../testing/kit.cjs');

function flat(style) {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

test('variants map to their container and content roles', () => {
  const kit = createKit();
  const {Button, BUTTON_COLORS} = kit.load('src/core/ui/components/Button.tsx');
  assert.deepEqual(BUTTON_COLORS.filled, {container: 'primary', content: 'onPrimary', border: null});
  assert.deepEqual(BUTTON_COLORS.outlined, {container: null, content: 'primary', border: 'outline'});
  const view = render(React.createElement(Button, {label: 'Play trailer', icon: 'play_arrow', size: 'large', onPress: spy()}));
  const [pressable] = hosts(view.root, 'Pressable');
  const style = touchableStyle(pressable);
  assert.equal(style.backgroundColor, '#C8F03C');
  assert.equal(style.minHeight, 48);
  assert.equal(style.borderRadius, 9999);
  assert.equal(pressable.props.role, 'button');
  assert.deepEqual(texts(view.root), ['Play trailer']);
  assert.equal(hosts(view.root, 'Glyph')[0].props.color, '#0B0D13');
  assert.equal(pressable.props.hitSlop, undefined);
  const medium = render(React.createElement(Button, {label: 'Save', onPress: spy()}));
  assert.deepEqual(hosts(medium.root, 'Pressable')[0].props.hitSlop, {top: 4, bottom: 4});
});

test('a toggle button exposes its state and switches to the filled glyph', () => {
  const kit = createKit();
  const {Button} = kit.load('src/core/ui/components/Button.tsx');
  const view = render(React.createElement(Button, {label: 'On watchlist', icon: 'bookmark', pressed: true, onPress: spy()}));
  const [pressable] = hosts(view.root, 'Pressable');
  assert.equal(pressable.props.accessibilityRole, 'togglebutton');
  assert.equal(pressable.props['aria-checked'], true);
  assert.equal(hosts(view.root, 'Glyph')[0].props.fontName, 'YifyIconsFilled');
  view.update(React.createElement(Button, {label: 'Watchlist', icon: 'bookmark', pressed: false, onPress: spy()}));
  assert.equal(hosts(view.root, 'Pressable')[0].props['aria-checked'], false);
  assert.equal(hosts(view.root, 'Glyph')[0].props.fontName, 'YifyIcons');
});

test('web toggles use aria-pressed and links render anchors', () => {
  const kit = createKit({web: true});
  const {Button} = kit.load('src/core/ui/components/Button.tsx');
  const view = render(React.createElement(Button, {label: 'Watchlist', pressed: false, onPress: spy()}));
  const [pressable] = hosts(view.root, 'Pressable');
  assert.equal(pressable.props.role, 'button');
  assert.equal(pressable.props['aria-pressed'], false);
  const link = render(React.createElement(Button, {label: 'Open Library', href: '/library'}));
  assert.equal(hosts(link.root, 'Pressable')[0].props.href, '/library');
  assert.equal(hosts(link.root, 'Pressable')[0].props.role, 'link');
});

test('loading shows a spinner in place of the icon and marks the button busy', () => {
  const kit = createKit();
  const {Button} = kit.load('src/core/ui/components/Button.tsx');
  const onPress = spy();
  const view = render(React.createElement(Button, {label: 'Saving', icon: 'check', loading: true, onPress}));
  const [pressable] = hosts(view.root, 'Pressable');
  assert.equal(pressable.props['aria-busy'], true);
  assert.equal(pressable.props['aria-disabled'], true);
  assert.equal(hosts(view.root, 'ActivityIndicator').length, 1);
  assert.equal(hosts(view.root, 'Glyph').length, 0);
  assert.deepEqual(texts(view.root), ['Saving']);
});

test('disabled buttons dim content to 0.38, tint the container at 0.12 and set aria-disabled', () => {
  const kit = createKit();
  const {Button} = kit.load('src/core/ui/components/Button.tsx');
  const onPress = spy();
  const view = render(React.createElement(Button, {label: 'Delete', variant: 'destructive', disabled: true, onPress, accessibilityLabel: 'Delete account'}));
  const [pressable] = hosts(view.root, 'Pressable');
  assert.equal(pressable.props['aria-disabled'], true);
  assert.equal(pressable.props['aria-label'], 'Delete account');
  assert.equal(pressable.props.onPress, undefined);
  const opacities = hosts(view.root, 'View').map((node) => flat(node.props.style).opacity).filter((value) => value !== undefined);
  assert.ok(opacities.includes(0.38));
  assert.ok(opacities.includes(0.12));
});

test('a trailing icon follows the label for standalone text buttons', () => {
  const kit = createKit();
  const {Button} = kit.load('src/core/ui/components/Button.tsx');
  const onPress = spy();
  const view = render(React.createElement(Button, {label: 'See all', variant: 'text', trailingIcon: 'chevron_right', onPress}));
  const [glyph] = hosts(view.root, 'Glyph');
  assert.equal(glyph.props.name, 'chevron_right');
  press(hosts(view.root, 'Pressable')[0]);
  assert.equal(onPress.calls.length, 1);
});
