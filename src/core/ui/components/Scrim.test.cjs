const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, hosts, press, render, spy} = require('../testing/kit.cjs');

test('scrims are flat, hidden from assistive technology and optionally dismiss on tap', () => {
  const kit = createKit();
  const {Scrim} = kit.load('src/core/ui/components/Scrim.tsx');
  const passive = render(React.createElement(Scrim, {}));
  const [view] = hosts(passive.root, 'View');
  assert.equal(view.props['aria-hidden'], true);
  assert.equal(Object.assign({}, ...[view.props.style].flat(Infinity).filter(Boolean)).backgroundColor, 'rgba(0, 0, 0, 0.6)');
  const onPress = spy();
  const tappable = render(React.createElement(Scrim, {tone: 'mediaScrim', onPress}));
  const [pressable] = hosts(tappable.root, 'Pressable');
  assert.equal(pressable.props['aria-hidden'], true);
  assert.equal(pressable.props.focusable, false);
  press(pressable);
  assert.equal(onPress.calls.length, 1);
});
