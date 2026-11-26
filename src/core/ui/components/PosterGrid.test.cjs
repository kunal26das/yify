const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, act, createKit, findByProp, hosts, render, spy, texts} = require('../testing/kit.cjs');
const {title} = require('../testing/fixtures.cjs');

const ITEMS = [title(1, 'One', 2001), title(2, 'Two', 2002), title(3, 'Three', 2003), title(4, 'Four', 2004)];

const loaded = new WeakMap();

function grid(kit, props) {
  if (!loaded.has(kit)) loaded.set(kit, kit.load('src/core/ui/components/PosterGrid.tsx').PosterGrid);
  const PosterGrid = loaded.get(kit);
  return React.createElement(PosterGrid, {items: ITEMS, surface: 'search', status: 'ready', hasMore: true, loadingMore: false, onLoadMore: spy(), onRetry: spy(), onOpen: spy(), empty: React.createElement('Text', null, 'Nothing'), ...props});
}

test('phones get at least three columns sized from the content width', () => {
  const kit = createKit();
  const layout = kit.load('src/core/ui/components/posterGridLayout.ts');
  assert.equal(layout.gridColumns(layout.gridContentWidth(360, 'compact'), 'compact'), 3);
  assert.equal(layout.gridItemWidth(layout.gridContentWidth(360, 'compact'), 3, 'compact'), 101);
  assert.equal(layout.gridItemWidth(layout.gridContentWidth(412, 'compact'), 3, 'compact'), 118);
  assert.equal(layout.gridColumns(layout.gridContentWidth(1280, 'expanded'), 'expanded'), 7);
  assert.equal(layout.gridContentWidth(2560, 'expanded'), 1280);
  const view = render(grid(kit, {}));
  const list = hosts(view.root, 'FlatList')[0];
  assert.equal(list.props.numColumns, 3);
  assert.equal(list.props.role, 'list');
  assert.equal(list.props.initialNumToRender, 12);
  assert.equal(list.props.onEndReachedThreshold, 0.6);
  assert.equal(findByProp(view.root, 'role', 'listitem').length, 4);
});

test('reaching the end loads more only when more exists and nothing is loading', () => {
  const kit = createKit();
  const onLoadMore = spy();
  const view = render(grid(kit, {onLoadMore}));
  act(() => hosts(view.root, 'FlatList')[0].props.onEndReached());
  view.update(grid(kit, {onLoadMore, loadingMore: true}));
  act(() => hosts(view.root, 'FlatList')[0].props.onEndReached());
  view.update(grid(kit, {onLoadMore, hasMore: false}));
  act(() => hosts(view.root, 'FlatList')[0].props.onEndReached());
  assert.equal(onLoadMore.calls.length, 1);
});

test('loading, empty, page error and load-more error states', () => {
  const kit = createKit();
  const loading = render(grid(kit, {items: [], status: 'loading'}));
  const list = hosts(loading.root, 'FlatList')[0];
  const placeholder = render(list.props.ListEmptyComponent);
  assert.equal(findByProp(placeholder.root, 'aria-busy', true).length, 1);
  assert.ok(texts(placeholder.root).includes('Loading titles'));
  const empty = render(hosts(render(grid(kit, {items: []})).root, 'FlatList')[0].props.ListEmptyComponent);
  assert.deepEqual(texts(empty.root), ['Nothing']);
  const failed = render(hosts(render(grid(kit, {items: [], status: 'error'})).root, 'FlatList')[0].props.ListEmptyComponent);
  assert.equal(findByProp(failed.root, 'role', 'alert').length, 1);
  const moreFailed = render(hosts(render(grid(kit, {status: 'error'})).root, 'FlatList')[0].props.ListFooterComponent);
  assert.ok(texts(moreFailed.root).includes("Couldn't load more titles."));
});
