const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, act, createKit, findByProp, hosts, render, texts} = require('../testing/kit.cjs');

function setup(options = {}) {
  const kit = createKit(options);
  const connectivity = kit.load('src/core/ui/connectivity.ts');
  const mainContent = kit.load('src/core/ui/layout/mainContent.ts');
  const mod = kit.load('src/core/ui/components/ScreenScaffold.tsx', {'../connectivity': connectivity, '../layout/mainContent': mainContent});
  return {kit, connectivity, mainContent, ...mod};
}

test('every screen is the main landmark with the document title set after mount', () => {
  const {ScreenScaffold, MAIN_ID} = setup();
  const view = render(React.createElement(ScreenScaffold, {title: 'Library', topBar: React.createElement('Text', null, 'Bar')}, React.createElement('Text', null, 'Body')));
  const [main] = findByProp(view.root, 'role', 'main');
  assert.equal(main.props.nativeID, MAIN_ID);
  assert.deepEqual(main.props.dataSet, {screen: ''});
  assert.equal(main.props.tabIndex, undefined);
  const [head] = hosts(view.root, 'Head');
  assert.match(head.props.children.props.children, /^Library/);
  assert.equal(hosts(view.root, 'View').some((node) => node.props.dataSet && node.props.dataSet.topAppBar === ''), true);
  assert.deepEqual(texts(view.root).filter((text) => text === 'Body'), ['Body']);
  assert.equal(hosts(view.root, 'Text').some((node) => node.props.role === 'heading'), false);
});

test('on web the main region is focusable, the expanded-web H1 is rendered and Title pages can opt out', () => {
  const {ScreenScaffold, mainContent} = setup({web: true});
  const view = render(React.createElement(ScreenScaffold, {title: 'Library', documentTitle: 'Library | App'}, React.createElement('Text', null, 'Body')));
  const [main] = findByProp(view.root, 'role', 'main');
  assert.equal(main.props.tabIndex, -1);
  const pageTitle = hosts(view.root, 'View').find((node) => node.props.dataSet && node.props.dataSet.pageTitle === '');
  const heading = hosts(pageTitle, 'Text')[0];
  assert.equal(heading.props['aria-level'], 1);
  assert.equal(heading.props.children, 'Library');
  assert.equal(hosts(view.root, 'Head')[0].props.children.props.children, 'Library | App');
  assert.equal(typeof mainContent.focusMainContent, 'function');
  const title = render(React.createElement(ScreenScaffold, {title: 'The Matrix', heading: 'screen'}, React.createElement('Text', null, 'Body')));
  assert.equal(hosts(title.root, 'View').some((node) => node.props.dataSet && node.props.dataSet.pageTitle === ''), false);
});

test('the offline banner appears two seconds after connectivity drops and is a status message', (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const {ScreenScaffold, connectivity} = setup();
  const view = render(React.createElement(ScreenScaffold, {title: 'Home'}, React.createElement('Text', null, 'Body')));
  act(() => connectivity.setConnectivity(false));
  assert.equal(texts(view.root).some((text) => text.startsWith("You're offline")), false);
  act(() => t.mock.timers.tick(2000));
  const [status] = findByProp(view.root, 'role', 'status');
  assert.deepEqual(texts(status), ["You're offline. Showing what's saved on this device."]);
  act(() => connectivity.setConnectivity(true));
  assert.equal(findByProp(view.root, 'role', 'status').length, 0);
});
