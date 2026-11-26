const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, findByProp, hosts, render, spy, texts} = require('../testing/kit.cjs');
const {title} = require('../testing/fixtures.cjs');

const MEDIA = [title(603, 'The Matrix', 1999), title(438631, 'Dune', 2021)].map((media) => ({kind: 'media', media}));

test('a rail is a region labelled by its H2 with list semantics and a named See all', () => {
  const kit = createKit({web: true});
  const {Rail} = kit.load('src/core/ui/components/Rail.tsx');
  const onOpen = spy();
  const view = render(React.createElement(Rail, {title: 'Trending', variant: 'ranked', items: MEDIA, status: 'ready', surface: 'home', onOpen, seeAll: {href: '/search?sort=popular'}}));
  const [region] = findByProp(view.root, 'role', 'region');
  const heading = hosts(view.root, 'Text').find((node) => node.props.role === 'heading');
  assert.equal(region.props['aria-labelledby'], heading.props.nativeID);
  assert.equal(heading.props['aria-level'], 2);
  assert.equal(hosts(view.root, 'FlatList')[0].props.role, 'list');
  assert.equal(findByProp(view.root, 'role', 'listitem').length, 2);
  assert.equal(findByProp(view.root, 'aria-label', 'See all Trending').length, 1);
  assert.deepEqual(hosts(view.root, 'Text').filter((node) => node.props['aria-hidden'] === true).map((node) => node.props.children), ['1', '2']);
});

test('expanded web rails add scroll buttons named after the rail', () => {
  const kit = createKit({web: true});
  kit.rn.setWindowDimensions({width: 1280});
  const {Rail} = kit.load('src/core/ui/components/Rail.tsx');
  const view = render(React.createElement(Rail, {title: 'Popular', items: MEDIA, status: 'ready', surface: 'home'}));
  assert.equal(findByProp(view.root, 'aria-label', 'Scroll Popular back').length, 1);
  assert.equal(findByProp(view.root, 'aria-label', 'Scroll Popular forward').length, 1);
  const android = createKit();
  android.rn.setWindowDimensions({width: 1280});
  const {Rail: NativeRail} = android.load('src/core/ui/components/Rail.tsx');
  const native = render(React.createElement(NativeRail, {title: 'Popular', items: MEDIA, status: 'ready', surface: 'home'}));
  assert.equal(findByProp(native.root, 'aria-label', 'Scroll Popular back').length, 0);
});

test('loading shows six busy skeletons, errors an inline retry, and empty rails disappear', () => {
  const kit = createKit();
  const {Rail, RAIL_SKELETONS} = kit.load('src/core/ui/components/Rail.tsx');
  const loading = render(React.createElement(Rail, {title: 'Popular', items: [], status: 'loading', surface: 'home'}));
  assert.equal(findByProp(loading.root, 'aria-busy', true).length, 1);
  assert.ok(texts(loading.root).includes('Loading Popular'));
  assert.equal(RAIL_SKELETONS, 6);
  const onRetry = spy();
  const failed = render(React.createElement(Rail, {title: 'New episodes', items: [], status: 'error', surface: 'home', onRetry}));
  assert.ok(texts(failed.root).includes("Couldn't load New episodes."));
  assert.equal(findByProp(failed.root, 'role', 'alert').length, 1);
  const empty = render(React.createElement(Rail, {title: 'On your services', items: [], status: 'ready', surface: 'home'}));
  assert.equal(empty.root.children.length, 0);
  const explained = render(React.createElement(Rail, {title: 'On your services', items: [], status: 'ready', surface: 'home', emptyText: 'Add your services to see them here.'}));
  assert.ok(texts(explained.root).includes('Add your services to see them here.'));
});

test('person cards link to the person page and name the role', () => {
  const kit = createKit({web: true});
  const {Rail} = kit.load('src/core/ui/components/Rail.tsx');
  const view = render(React.createElement(Rail, {title: 'Cast', variant: 'person', surface: 'other', status: 'ready', items: [{kind: 'person', personId: 6384, slug: 'keanu-reeves', name: 'Keanu Reeves', role: 'Neo', profilePath: null}]}));
  const [card] = findByProp(view.root, 'aria-label', 'Keanu Reeves, Neo');
  assert.equal(card.props.href, '/person/6384-keanu-reeves');
});
