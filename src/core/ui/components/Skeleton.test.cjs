const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, hosts, render} = require('../testing/kit.cjs');

test('skeletons are hidden from assistive technology and pulse only on Android', () => {
  const kit = createKit();
  const {Skeleton} = kit.load('src/core/ui/components/Skeleton.tsx');
  const view = render(React.createElement(Skeleton, {shape: 'text', width: 200, lines: 3}));
  const [root] = hosts(view.root, 'Animated.View');
  assert.equal(root.props['aria-hidden'], true);
  assert.equal(hosts(root, 'View').length, 3);
  const last = hosts(root, 'View')[2];
  assert.equal(Object.assign({}, ...[last.props.style].flat(Infinity).filter(Boolean)).width, '60%');
  const fill = Object.assign({}, ...[hosts(root, 'View')[0].props.style].flat(Infinity).filter(Boolean));
  assert.equal(fill.backgroundColor, '#1F222C');
});

test('on web the pulse is CSS driven through data-skeleton', () => {
  const kit = createKit({web: true});
  const {Skeleton} = kit.load('src/core/ui/components/Skeleton.tsx');
  const view = render(React.createElement(Skeleton, {shape: 'rect', width: '100%', aspectRatio: 2 / 3}));
  const [root] = hosts(view.root, 'View');
  assert.deepEqual(root.props.dataSet, {skeleton: ''});
  assert.equal(root.props['aria-hidden'], true);
  assert.equal(Object.assign({}, ...[root.props.style].flat(Infinity).filter(Boolean)).aspectRatio, 2 / 3);
});
