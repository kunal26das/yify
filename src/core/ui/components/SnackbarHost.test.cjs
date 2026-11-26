const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, act, createKit, findByProp, hosts, press, render, spy, texts} = require('../testing/kit.cjs');

function setup(t, options = {}) {
  t.mock.timers.enable({apis: ['setTimeout']});
  const kit = createKit(options);
  const overlays = kit.load('src/core/ui/overlays.ts');
  const connectivity = kit.load('src/core/ui/connectivity.ts');
  const snackbar = kit.load('src/core/ui/components/SnackbarHost.tsx', {'../overlays': overlays, '../connectivity': connectivity});
  const view = render(React.createElement(snackbar.SnackbarHost, null, React.createElement('Text', null, 'App')));
  return {kit, view, overlays, connectivity, ...snackbar, run: (fn) => act(fn)};
}

test('a snackbar is a polite status region announced on Android with its action', (t) => {
  const s = setup(t);
  const undo = spy();
  s.run(() => s.showSnackbar({message: 'Removed from watchlist', action: {label: 'Undo', onPress: undo}}));
  const [status] = findByProp(s.view.root, 'role', 'status');
  assert.equal(status.props['aria-live'], 'polite');
  assert.deepEqual(texts(s.view.root), ['App', 'Removed from watchlist', 'Undo']);
  assert.deepEqual(s.kit.rn.AccessibilityInfo.announceForAccessibility.calls, [['Removed from watchlist, Undo available']]);
  const action = hosts(s.view.root, 'Pressable').find((node) => hosts(node, 'Text').some((text) => text.props.children === 'Undo'));
  press(action);
  assert.equal(undo.calls.length, 1);
  assert.equal(s.snackbarStore.get().current, null);
});

test('error snackbars use the alert role, and a new snackbar replaces the current one', (t) => {
  const s = setup(t);
  s.run(() => s.showSnackbar({message: 'First'}));
  s.run(() => s.showSnackbar({message: "Couldn't refresh.", tone: 'error'}));
  assert.equal(findByProp(s.view.root, 'role', 'alert').length, 1);
  assert.equal(texts(s.view.root).includes('First'), false);
});

test('durations: short 4 s, long 8 s with an action, 12 s with a screen reader, indefinite stays', (t) => {
  const s = setup(t);
  assert.equal(s.snackbarDuration({message: 'a'}, false), 4000);
  assert.equal(s.snackbarDuration({message: 'a', action: {label: 'Undo', onPress: spy()}}, false), 8000);
  assert.equal(s.snackbarDuration({message: 'a'}, true), 12000);
  assert.equal(s.snackbarDuration({message: 'a', duration: 'indefinite'}, true), null);
  s.run(() => s.showSnackbar({message: 'Back online', duration: 'short'}));
  s.run(() => t.mock.timers.tick(3999));
  assert.ok(s.snackbarStore.get().current);
  s.run(() => t.mock.timers.tick(1));
  assert.equal(s.snackbarStore.get().current, null);
  s.run(() => t.mock.timers.tick(200));
  assert.equal(findByProp(s.view.root, 'role', 'status').length, 0);
  s.run(() => s.showSnackbar({message: 'Restart to update', duration: 'indefinite', key: 'update'}));
  s.run(() => t.mock.timers.tick(60000));
  assert.equal(s.snackbarStore.get().current.message, 'Restart to update');
  s.run(() => s.dismissSnackbar('other'));
  assert.ok(s.snackbarStore.get().current);
  s.run(() => s.dismissSnackbar('update'));
  assert.equal(s.snackbarStore.get().current, null);
});

test('snackbars wait while a trailer is open and appear after it closes', (t) => {
  const s = setup(t);
  s.run(() => s.overlays.setPlayerOpen(true));
  s.run(() => s.showSnackbar({message: 'Saved'}));
  assert.equal(texts(s.view.root).includes('Saved'), false);
  s.run(() => s.overlays.setPlayerOpen(false));
  assert.ok(texts(s.view.root).includes('Saved'));
});

test('the undo helper offers Undo for the long duration and reconnecting shows Back online', (t) => {
  const s = setup(t);
  let undo;
  function Probe() {
    undo = s.useUndoSnackbar();
    return null;
  }
  render(React.createElement(Probe));
  s.run(() => undo('Removed from Lists', spy()));
  assert.equal(s.snackbarStore.get().current.action.label, 'Undo');
  assert.equal(s.snackbarStore.get().current.duration, 'long');
  s.run(() => s.connectivity.setConnectivity(false));
  s.run(() => t.mock.timers.tick(2000));
  s.run(() => s.connectivity.setConnectivity(true));
  assert.equal(s.snackbarStore.get().current.message, 'Back online');
});
