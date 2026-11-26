const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, findByProp, hosts, press, render, spy, texts} = require('../testing/kit.cjs');
const {title} = require('../testing/fixtures.cjs');

const loaded = new WeakMap();

function grid(kit, props) {
  if (!loaded.has(kit)) loaded.set(kit, kit.load('src/core/ui/components/PosterGrid.web.tsx').PosterGrid);
  const PosterGrid = loaded.get(kit);
  return React.createElement(PosterGrid, {items: [title(1, 'One', 2001), title(2, 'Two', 2002)], surface: 'search', status: 'ready', hasMore: true, loadingMore: false, onLoadMore: spy(), onRetry: spy(), onOpen: spy(), empty: React.createElement('Text', null, 'Nothing'), ...props});
}

test('the web grid is a CSS grid list of links followed by a Load more button', () => {
  const kit = createKit({web: true});
  const onLoadMore = spy();
  const view = render(grid(kit, {onLoadMore}));
  const [list] = findByProp(view.root, 'role', 'list');
  const style = Object.assign({}, ...[list.props.style].flat(Infinity).filter(Boolean));
  assert.equal(style.display, 'grid');
  assert.equal(style.gridTemplateColumns, 'repeat(auto-fill, minmax(clamp(100px, 13vw, 168px), 1fr))');
  assert.equal(findByProp(view.root, 'role', 'listitem').length, 2);
  assert.deepEqual(hosts(view.root, 'Pressable').filter((node) => node.props.role === 'link').map((node) => node.props.href), ['/title/movie/1-one', '/title/movie/2-two']);
  const loadMore = hosts(view.root, 'Pressable').find((node) => hosts(node, 'Text').some((text) => text.props.children === 'Load more'));
  press(loadMore);
  assert.equal(onLoadMore.calls.length, 1);
});

test('after 400 titles the button asks to refine the search instead of loading more', () => {
  const kit = createKit({web: true});
  const items = Array.from({length: 401}, (_, index) => title(index + 1, `Title ${index + 1}`, 2000));
  const view = render(grid(kit, {items}));
  assert.equal(findByProp(view.root, 'role', 'listitem').length, 400);
  const refine = hosts(view.root, 'Pressable').find((node) => hosts(node, 'Text').some((text) => text.props.children === 'Refine your search to see more'));
  assert.equal(refine.props['aria-disabled'], true);
});

test('initial loading is busy with skeletons, and errors without results show the page error', () => {
  const kit = createKit({web: true});
  const loading = render(grid(kit, {items: [], status: 'loading'}));
  assert.equal(findByProp(loading.root, 'aria-busy', true).length, 1);
  assert.ok(texts(loading.root).includes('Loading titles'));
  const failed = render(grid(kit, {items: [], status: 'error'}));
  assert.equal(findByProp(failed.root, 'role', 'alert').length, 1);
});
