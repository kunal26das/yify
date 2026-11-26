const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, act, createKit, hosts, press, render, spy, texts} = require('../testing/kit.cjs');

const loaded = new WeakMap();

function sheet(kit, props) {
  if (!loaded.has(kit)) loaded.set(kit, kit.load('src/core/ui/components/Sheet.tsx').Sheet);
  const Sheet = loaded.get(kit);
  return React.createElement(Sheet, {title: 'Add to list', onClose: spy(), ...props}, React.createElement('Text', null, 'Body'));
}

test('an open sheet is a visible modal whose title is a heading and whose Close button closes it', () => {
  const kit = createKit();
  const onClose = spy();
  const view = render(sheet(kit, {open: true, onClose}));
  const [modal] = hosts(view.root, 'Modal');
  assert.equal(modal.props.visible, true);
  assert.equal(modal.props.transparent, true);
  assert.equal(modal.props.animationType, 'none');
  assert.equal(modal.props.statusBarTranslucent, true);
  assert.equal(modal.props.navigationBarTranslucent, true);
  const heading = hosts(view.root, 'Text').find((node) => node.props.role === 'heading');
  assert.equal(heading.props.children, 'Add to list');
  const close = hosts(view.root, 'Pressable').find((node) => node.props['aria-label'] === 'Close');
  press(close);
  act(() => modal.props.onRequestClose());
  assert.equal(onClose.calls.length, 2);
  assert.ok(texts(view.root).includes('Body'));
});

test('a non-dismissible sheet has no Close button and ignores back', () => {
  const kit = createKit();
  const onClose = spy();
  const view = render(sheet(kit, {open: true, onClose, dismissible: false}));
  assert.equal(hosts(view.root, 'Pressable').some((node) => node.props['aria-label'] === 'Close'), false);
  act(() => hosts(view.root, 'Modal')[0].props.onRequestClose());
  assert.equal(onClose.calls.length, 0);
});

test('on web the modal is labelled by the title', () => {
  const kit = createKit({web: true});
  const view = render(sheet(kit, {open: true, presentation: 'dialog'}));
  const [modal] = hosts(view.root, 'Modal');
  const heading = hosts(view.root, 'Text').find((node) => node.props.role === 'heading');
  assert.equal(modal.props['aria-labelledby'], heading.props.nativeID);
  assert.equal(heading.props['aria-level'], 2);
});

test('closing keeps the modal mounted for the exit motion, then hides it', (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const kit = createKit();
  const view = render(sheet(kit, {open: true}));
  view.update(sheet(kit, {open: false}));
  assert.equal(hosts(view.root, 'Modal')[0].props.visible, true);
  act(() => t.mock.timers.tick(200));
  assert.equal(hosts(view.root, 'Modal')[0].props.visible, false);
});

test('auto presentation is a bottom sheet on compact and a dialog otherwise, and drags dismiss past a quarter', () => {
  const kit = createKit();
  const {resolvePresentation, shouldDismissDrag} = kit.load('src/core/ui/components/Sheet.tsx');
  assert.equal(resolvePresentation('auto', 'compact'), 'sheet');
  assert.equal(resolvePresentation('auto', null), 'sheet');
  assert.equal(resolvePresentation('auto', 'medium'), 'dialog');
  assert.equal(resolvePresentation('auto', 'expanded'), 'dialog');
  assert.equal(resolvePresentation('fullscreen', 'compact'), 'fullscreen');
  assert.equal(shouldDismissDrag(101, 0, 400), true);
  assert.equal(shouldDismissDrag(99, 0, 400), false);
  assert.equal(shouldDismissDrag(10, 801, 400), true);
  const compact = render(sheet(kit, {open: true}));
  assert.equal(hosts(compact.root, 'View').some((node) => node.props['aria-hidden'] === true && Array.isArray(node.props.style) && node.props.style.some((style) => style && style.height === 48)), true);
  kit.rn.setWindowDimensions({width: 1280, height: 800});
  const wide = render(sheet(kit, {open: true}));
  const panel = hosts(wide.root, 'Animated.View').find((node) => [node.props.style].flat(Infinity).some((style) => style && style.width === 560));
  assert.ok(panel);
});
