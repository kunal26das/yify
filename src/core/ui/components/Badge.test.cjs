const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, hosts, render, texts} = require('../testing/kit.cjs');

test('badges never carry meaning alone: hidden, capped at 1.3x text scale, Plus on the highlighter', () => {
  const kit = createKit();
  const {Badge} = kit.load('src/core/ui/components/Badge.tsx');
  const plus = render(React.createElement(Badge, {size: 'large', tone: 'plus'}));
  const [root] = hosts(plus.root, 'View');
  assert.equal(root.props['aria-hidden'], true);
  assert.equal(Object.assign({}, ...[root.props.style].flat(Infinity).filter(Boolean)).backgroundColor, '#C8F03C');
  assert.deepEqual(texts(plus.root), ['Plus']);
  assert.equal(hosts(plus.root, 'Glyph')[0].props.name, 'workspace_premium');
  assert.equal(hosts(plus.root, 'Text')[0].props.maxFontSizeMultiplier, 1.3);
  const dot = render(React.createElement(Badge, {size: 'dot'}));
  const dotStyle = Object.assign({}, ...[hosts(dot.root, 'View')[0].props.style].flat(Infinity).filter(Boolean));
  assert.equal(dotStyle.width, 6);
  assert.equal(dotStyle.backgroundColor, '#FF97A6');
  const rewatch = render(React.createElement(Badge, {size: 'small', label: 'Rewatch'}));
  assert.equal(hosts(rewatch.root, 'Glyph').length, 0);
});
