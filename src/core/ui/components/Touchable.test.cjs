const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, act, clipOf, createKit, flatStyle, hosts, press, render, spy} = require('../testing/kit.cjs');

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

function spaceKey(node, type, extra = {}) {
  const element = {};
  const event = {nativeEvent: {key: ' '}, target: element, currentTarget: element, preventDefault: spy(), ...extra};
  act(() => node.props[type](event));
  return event;
}

test('on web Space toggles checkbox, switch and radio roles on keyup and never scrolls the page', () => {
  const kit = createKit({web: true});
  const {Touchable} = kit.load('src/core/ui/components/Touchable.tsx');
  for (const role of ['checkbox', 'switch', 'radio']) {
    const onPress = spy();
    const node = pressable(render(React.createElement(Touchable, {role, 'aria-checked': false, onPress}, 'x')));
    const down = spaceKey(node, 'onKeyDown');
    assert.equal(down.preventDefault.calls.length, 1, role);
    assert.equal(onPress.calls.length, 0, role);
    spaceKey(node, 'onKeyUp');
    assert.equal(onPress.calls.length, 1, role);
    spaceKey(node, 'onKeyUp');
    assert.equal(onPress.calls.length, 1, role);
  }
});

test('Space only activates the control that received the keydown, and never when disabled', () => {
  const kit = createKit({web: true});
  const {Touchable} = kit.load('src/core/ui/components/Touchable.tsx');
  const onPress = spy();
  const node = pressable(render(React.createElement(Touchable, {role: 'checkbox', 'aria-checked': true, onPress}, 'x')));
  spaceKey(node, 'onKeyUp');
  assert.equal(onPress.calls.length, 0);
  const nested = spaceKey(node, 'onKeyDown', {target: {}});
  assert.equal(nested.preventDefault.calls.length, 0);
  spaceKey(node, 'onKeyUp');
  assert.equal(onPress.calls.length, 0);
  spaceKey(node, 'onKeyDown');
  act(() => node.props.onBlur({}));
  spaceKey(node, 'onKeyUp');
  assert.equal(onPress.calls.length, 0);
  const enter = {nativeEvent: {key: 'Enter'}, preventDefault: spy()};
  act(() => node.props.onKeyDown(enter));
  assert.equal(enter.preventDefault.calls.length, 0);
  const onKeyDown = spy();
  const disabled = pressable(render(React.createElement(Touchable, {role: 'switch', 'aria-checked': false, onPress, onKeyDown, disabled: true}, 'x')));
  spaceKey(disabled, 'onKeyDown');
  spaceKey(disabled, 'onKeyUp');
  assert.equal(onPress.calls.length, 0);
  assert.equal(onKeyDown.calls.length, 1);
});

test('buttons and links keep the browser and react-native-web key handling, and Android adds none', () => {
  const kit = createKit({web: true});
  const {Touchable} = kit.load('src/core/ui/components/Touchable.tsx');
  const button = pressable(render(React.createElement(Touchable, {onPress: spy()}, 'x')));
  assert.equal(button.props.onKeyDown, undefined);
  assert.equal(button.props.onKeyUp, undefined);
  const android = createKit();
  const {Touchable: NativeTouchable} = android.load('src/core/ui/components/Touchable.tsx');
  const checkbox = pressable(render(React.createElement(NativeTouchable, {role: 'checkbox', 'aria-checked': false, onPress: spy()}, 'x')));
  assert.equal(checkbox.props.onKeyDown, undefined);
  assert.equal(checkbox.props.onKeyUp, undefined);
});

test('external links open in a new tab through the browser, and native hands them to the router', () => {
  const kit = createKit({web: true});
  const {Touchable, isExternalHref} = kit.load('src/core/ui/components/Touchable.tsx');
  const onPress = spy();
  const node = pressable(render(React.createElement(Touchable, {href: 'https://www.themoviedb.org/', onPress}, 'x')));
  assert.equal(node.props.role, 'link');
  assert.deepEqual(node.props.hrefAttrs, {target: '_blank', rel: 'noopener noreferrer'});
  const preventDefault = spy();
  press(node, {button: 0, preventDefault});
  assert.equal(preventDefault.calls.length, 0);
  assert.equal(onPress.calls.length, 1);
  press(pressable(render(React.createElement(Touchable, {href: 'mailto:support@example.com'}, 'x'))), {button: 0, preventDefault});
  assert.equal(preventDefault.calls.length, 0);
  assert.deepEqual(kit.router.push.calls, []);
  assert.equal(pressable(render(React.createElement(Touchable, {href: '/settings/about'}, 'x'))).props.hrefAttrs, undefined);
  assert.equal(isExternalHref('/title/movie/603-the-matrix'), false);
  const android = createKit();
  const {Touchable: NativeTouchable} = android.load('src/core/ui/components/Touchable.tsx');
  press(pressable(render(React.createElement(NativeTouchable, {href: 'https://play.google.com/store/apps/details?id=io.github.kunal26das.yify'}, 'x'))));
  assert.deepEqual(android.router.push.calls, [['https://play.google.com/store/apps/details?id=io.github.kunal26das.yify']]);
});

test('on Android a rounded bounded ripple is clipped by a wrapper that takes the placement styles', () => {
  const kit = createKit();
  const {Touchable} = kit.load('src/core/ui/components/Touchable.tsx');
  const onLayout = spy();
  const view = render(React.createElement(Touchable, {
    onPress: spy(),
    shape: 'full',
    hitSlop: 4,
    onLayout,
    style: [{width: 40, height: 40, marginLeft: 8, alignSelf: 'flex-start'}, {alignItems: 'center', backgroundColor: '#262C3A', paddingHorizontal: 4}],
  }, 'x'));
  const node = pressable(view);
  const clip = clipOf(node);
  assert.ok(clip);
  assert.equal(clip.props.collapsable, false);
  assert.equal(clip.props.hitSlop, 4);
  assert.equal(clip.props.onLayout, onLayout);
  assert.equal(node.props.onLayout, undefined);
  assert.deepEqual(flatStyle(clip.props.style), {borderRadius: 9999, overflow: 'hidden', pointerEvents: 'box-none', width: 40, height: 40, marginLeft: 8, alignSelf: 'flex-start'});
  assert.deepEqual(flatStyle(node.props.style), {borderRadius: 9999, alignItems: 'center', backgroundColor: '#262C3A', paddingHorizontal: 4, flexGrow: 1});
  assert.equal(node.props.hitSlop, 4);
  assert.deepEqual(node.props.android_ripple, {color: 'rgba(238, 241, 246, 0.1)', borderless: false, foreground: true});
  act(() => node.props.onFocus({}));
  assert.equal(flatStyle(clipOf(pressable(view)).props.style).outlineWidth, 2);
  assert.equal(flatStyle(pressable(view).props.style).outlineWidth, undefined);
});

test('square, borderless and web touchables are not wrapped, and a style radius still clips', () => {
  const kit = createKit();
  const {Touchable} = kit.load('src/core/ui/components/Touchable.tsx');
  assert.equal(clipOf(pressable(render(React.createElement(Touchable, {onPress: spy(), style: {minHeight: 56}}, 'x')))), null);
  assert.equal(clipOf(pressable(render(React.createElement(Touchable, {onPress: spy(), shape: 'full', ripple: 'borderless'}, 'x')))), null);
  const custom = pressable(render(React.createElement(Touchable, {onPress: spy(), style: {borderRadius: 12, minHeight: 48}}, 'x')));
  assert.equal(flatStyle(clipOf(custom).props.style).borderRadius, 12);
  assert.equal(flatStyle(clipOf(custom).props.style).minHeight, 48);
  const layer = hosts(custom, 'View').find((item) => item.props.dataSet?.stateLayer === '');
  assert.equal(flatStyle(layer.props.style).borderRadius, 12);
  const web = createKit({web: true});
  const {Touchable: WebTouchable} = web.load('src/core/ui/components/Touchable.tsx');
  const node = pressable(render(React.createElement(WebTouchable, {onPress: spy(), shape: 'full', style: {width: 40}}, 'x')));
  assert.equal(clipOf(node), null);
  assert.equal(flatStyle(node.props.style).width, 40);
});
