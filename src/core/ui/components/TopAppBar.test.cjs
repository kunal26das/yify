const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, act, createKit, findByProp, hosts, press, render, spy, texts} = require('../testing/kit.cjs');

test('the small bar title is the page H1 and the bar clears the status bar inset', () => {
  const kit = createKit();
  const {TopAppBar} = kit.load('src/core/ui/components/TopAppBar.tsx');
  const view = render(React.createElement(TopAppBar, {variant: 'small', title: 'Library', actions: [{icon: 'search', label: 'Search your library', onPress: spy(), selected: false}]}));
  const heading = hosts(view.root, 'Text').find((node) => node.props.role === 'heading');
  assert.equal(heading.props.children, 'Library');
  assert.equal(heading.props['aria-label'], 'Library');
  assert.equal(heading.props.numberOfLines, 2);
  assert.equal(findByProp(view.root, 'aria-label', 'Search your library')[0].props['aria-checked'], false);
  const bar = hosts(view.root, 'View')[0];
  assert.equal(Object.assign({}, ...[bar.props.style].flat(Infinity).filter(Boolean)).paddingTop, 24);
});

test('Navigate up goes back when it can and otherwise to the current tab root', () => {
  const kit = createKit({router: {canGoBack: true, segments: ['(tabs)', '(library)', 'list', '[id]']}});
  const {TopAppBar, BACK_LABEL} = kit.load('src/core/ui/components/TopAppBar.tsx');
  const view = render(React.createElement(TopAppBar, {variant: 'small', title: 'Favourites', back: true}));
  press(findByProp(view.root, 'aria-label', BACK_LABEL).find((node) => node.type === 'Pressable'));
  assert.equal(kit.router.back.calls.length, 1);
  kit.routerState.canGoBack = false;
  view.update(React.createElement(TopAppBar, {variant: 'small', title: 'Favourites', back: true}));
  press(findByProp(view.root, 'aria-label', BACK_LABEL).find((node) => node.type === 'Pressable'));
  assert.deepEqual(kit.router.replace.calls, [['/library']]);
});

test('the overflow menu opens an action sheet', () => {
  const kit = createKit();
  const {TopAppBar} = kit.load('src/core/ui/components/TopAppBar.tsx');
  const openOnTmdb = spy();
  const view = render(React.createElement(TopAppBar, {variant: 'small', title: 'The Matrix', overflow: [{icon: 'open_in_new', label: 'Open on TMDB', onPress: openOnTmdb}]}));
  assert.equal(hosts(view.root, 'Modal')[0].props.visible, false);
  press(findByProp(view.root, 'aria-label', 'More options').find((node) => node.type === 'Pressable'));
  assert.equal(hosts(view.root, 'Modal')[0].props.visible, true);
  assert.ok(texts(view.root).includes('Open on TMDB'));
});

test('the overlay bar uses media buttons over the backdrop and never draws the title on the image', () => {
  const kit = createKit();
  const {TopAppBar} = kit.load('src/core/ui/components/TopAppBar.tsx');
  let offset = 0;
  const scrollY = {get: () => offset};
  const view = render(React.createElement(TopAppBar, {variant: 'overlay', title: 'The Matrix', back: true, actions: [{icon: 'share', label: 'Share', onPress: spy()}], scrollY, revealAfter: 200}));
  const back = findByProp(view.root, 'aria-label', 'Navigate up').find((node) => node.type === 'Pressable');
  assert.equal(Object.assign({}, ...[back.props.style].flat(Infinity).filter(Boolean)).backgroundColor, 'rgba(0, 0, 0, 0.6)');
  assert.equal(texts(view.root).includes('The Matrix'), false);
  offset = 400;
  act(() => view.update(React.createElement(TopAppBar, {variant: 'overlay', title: 'The Matrix', back: true, scrollY, revealAfter: 200})));
  assert.ok(texts(view.root).includes('The Matrix'));
  assert.equal(hosts(view.root, 'Text').find((node) => node.props.children === 'The Matrix').props.role, undefined);
});

test('the Home bar shows the wordmark as its heading', () => {
  const kit = createKit();
  const {TopAppBar} = kit.load('src/core/ui/components/TopAppBar.tsx');
  const {APP_NAME} = kit.load('src/core/config/app.ts');
  const view = render(React.createElement(TopAppBar, {variant: 'small', wordmark: true}));
  const heading = hosts(view.root, 'Text').find((node) => node.props.role === 'heading');
  assert.equal(heading.props.children, APP_NAME);
});
