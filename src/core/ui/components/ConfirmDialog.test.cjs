const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, act, createKit, hosts, press, render, spy, texts} = require('../testing/kit.cjs');

function setup() {
  const kit = createKit();
  const {ConfirmProvider, useConfirm} = kit.load('src/core/ui/components/ConfirmDialog.tsx');
  let confirm;
  function Probe() {
    confirm = useConfirm();
    return null;
  }
  const view = render(React.createElement(ConfirmProvider, null, React.createElement(Probe)));
  return {kit, view, confirm: (request) => act(() => confirm(request)), useConfirm};
}

test('useConfirm opens a dialog with the title, message and both actions', () => {
  const {view, confirm} = setup();
  const onConfirm = spy();
  const onCancel = spy();
  confirm({title: 'Sign out?', message: 'Your synced library leaves this device.', confirmLabel: 'Sign out', destructive: true, onConfirm, onCancel});
  assert.equal(hosts(view.root, 'Modal')[0].props.visible, true);
  assert.deepEqual(texts(view.root).filter((text) => text !== ''), ['Sign out?', 'Your synced library leaves this device.', 'Cancel', 'Sign out']);
  const confirmButton = hosts(view.root, 'Pressable').find((node) => hosts(node, 'Text').some((text) => text.props.children === 'Sign out'));
  assert.equal(Object.assign({}, ...[confirmButton.props.style].flat(Infinity).filter(Boolean)).backgroundColor, '#FF97A6');
  press(confirmButton);
  assert.equal(onConfirm.calls.length, 1);
  assert.equal(onCancel.calls.length, 0);
});

test('cancel, Close and back resolve the request once through onCancel', () => {
  const {view, confirm} = setup();
  const onCancel = spy();
  confirm({title: 'Delete account?', message: 'This cannot be undone.', confirmLabel: 'Delete', cancelLabel: 'Keep account', onConfirm: spy(), onCancel});
  const cancel = hosts(view.root, 'Pressable').find((node) => hosts(node, 'Text').some((text) => text.props.children === 'Keep account'));
  press(cancel);
  act(() => hosts(view.root, 'Modal')[0].props.onRequestClose());
  assert.equal(onCancel.calls.length, 1);
});

test('useConfirm outside the provider fails loudly', () => {
  const kit = createKit();
  const {useConfirm} = kit.load('src/core/ui/components/ConfirmDialog.tsx');
  function Orphan() {
    useConfirm();
    return null;
  }
  const original = console.error;
  console.error = () => undefined;
  try {
    assert.throws(() => render(React.createElement(Orphan)), /ConfirmProvider/);
  } finally {
    console.error = original;
  }
});
