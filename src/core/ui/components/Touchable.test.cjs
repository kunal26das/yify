const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, act, createKit, hosts, press, render, spy} = require('../testing/kit.cjs');

function pressable(view) {
  return hosts(view.root, 'Pressable')[0];
}

test('a press calls onPress, or pushes the href through useRouter when there is no handler', () => {
  const kit = createKit();
  const {Touchable} = kit.load('src/core/ui/components/Touchable.tsx');
  const onPress = spy();
  const view = render(React.createElement(Touchable, {onPress, 'aria-label': 'Open'}, 'x'));
  const node = pressable(view);
  assert.equal(node.props.role, 'button');
  assert.equal(node.props.href, undefined);
  assert.deepEqual(node.props.dataSet, {focusable: ''});
  assert.equal(node.props.android_ripple.foreground, true);
  assert.match(node.props.android_ripple.color, /^rgba\(238, 241, 246, 0\.1\)$/);
  press(node);
  assert.equal(onPress.calls.length, 1);
  const link = render(React.createElement(Touchable, {href: '/library'}, 'x'));
  press(pressable(link));
  assert.deepEqual(kit.router.push.calls, [['/library']]);
});

test('disabled touchables expose aria-disabled and ignore presses', () => {
  const kit = createKit();
  const {Touchable} = kit.load('src/core/ui/components/Touchable.tsx');
  const view = render(React.createElement(Touchable, {onPress: spy(), disabled: true}, 'x'));
  const node = pressable(view);
  assert.equal(node.props['aria-disabled'], true);
  assert.equal(node.props.onPress, undefined);
  assert.equal(node.props.android_ripple, undefined);
});

test('keyboard focus on Android draws the 2 dp focus ring and the focus state layer', () => {
  const kit = createKit();
  const {Touchable} = kit.load('src/core/ui/components/Touchable.tsx');
  const view = render(React.createElement(Touchable, {onPress: spy()}, 'x'));
  act(() => pressable(view).props.onFocus({}));
  const style = Object.assign({}, ...pressable(view).props.style.flat().filter(Boolean));
  assert.equal(style.outlineWidth, 2);
  assert.equal(style.outlineOffset, 2);
  assert.equal(style.outlineColor, '#EEF1F6');
  const layer = hosts(view.root, 'View').find((node) => node.props.dataSet?.stateLayer === '');
  assert.equal(Object.assign({}, ...layer.props.style.flat().filter(Boolean)).opacity, 0.1);
  act(() => pressable(view).props.onBlur({}));
  assert.equal(Object.assign({}, ...pressable(view).props.style.flat().filter(Boolean)).outlineWidth, undefined);
});

test('an explicit accessibilityRole such as togglebutton is not overridden by the default role', () => {
  const kit = createKit();
  const {Touchable} = kit.load('src/core/ui/components/Touchable.tsx');
  const view = render(React.createElement(Touchable, {onPress: spy(), accessibilityRole: 'togglebutton', 'aria-checked': true}, 'x'));
  assert.equal(pressable(view).props.role, undefined);
  assert.equal(pressable(view).props.accessibilityRole, 'togglebutton');
});

test('on web a link renders an anchor, lets modified clicks through and intercepts plain clicks', () => {
  const kit = createKit({web: true});
  const {Touchable, isPlainActivation} = kit.load('src/core/ui/components/Touchable.tsx');
  const onPress = spy();
  const view = render(React.createElement(Touchable, {href: '/title/movie/603-the-matrix', onPress}, 'x'));
  const node = pressable(view);
  assert.equal(node.props.role, 'link');
  assert.equal(node.props.href, '/title/movie/603-the-matrix');
  const preventDefault = spy();
  press(node, {metaKey: true, button: 0, preventDefault});
  press(node, {button: 1, preventDefault});
  assert.equal(onPress.calls.length, 0);
  assert.equal(preventDefault.calls.length, 0);
  press(node, {button: 0, preventDefault});
  assert.equal(onPress.calls.length, 1);
  assert.equal(preventDefault.calls.length, 1);
  assert.equal(isPlainActivation({ctrlKey: true}), false);
  const disabled = render(React.createElement(Touchable, {href: '/plus', disabled: true}, 'x'));
  assert.equal(pressable(disabled).props.href, undefined);
  const slop = render(React.createElement(Touchable, {onPress, hitSlop: 8}, 'x'));
  assert.deepEqual(pressable(slop).props.dataSet, {focusable: '', hitSlop: ''});
  assert.equal(isPlainActivation(undefined), true);
  const layer = hosts(view.root, 'View').find((item) => item.props.dataSet?.stateLayer === '');
  assert.equal(Object.assign({}, ...layer.props.style.flat().filter(Boolean)).opacity, undefined);
});
