const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, hosts, render} = require('../testing/kit.cjs');

test('the highlighter tag is onPrimaryContainer text on primaryContainer in both themes', () => {
  const kit = createKit();
  const {Tag} = kit.load('src/core/ui/components/Tag.tsx');
  const view = render(React.createElement(Tag, {label: 'Featured today'}));
  const [box] = hosts(view.root, 'View');
  const style = Object.assign({}, ...[box.props.style].flat(Infinity).filter(Boolean));
  assert.equal(style.backgroundColor, '#C8F03C');
  assert.equal(style.borderRadius, 4);
  assert.equal(style.paddingHorizontal, 8);
  assert.equal(style.paddingVertical, 2);
  const [text] = hosts(view.root, 'Text');
  const textStyle = Object.assign({}, ...[text.props.style].flat(Infinity).filter(Boolean));
  assert.equal(textStyle.color, '#0B0D13');
  assert.equal(textStyle.fontFamily, 'Archivo_600SemiBold');
  assert.equal(textStyle.fontSize, 12);
});
