const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, hosts, render} = require('../testing/kit.cjs');

test('Text applies the role typography and colour, and Heading exposes a heading', () => {
  const kit = createKit();
  const {Text, Heading} = kit.load('src/core/ui/components/Text.tsx');
  const view = render(React.createElement(React.Fragment, null,
    React.createElement(Text, {variant: 'bodySmall', color: 'onSurfaceVariant', numberOfLines: 2}, 'Meta'),
    React.createElement(Heading, {level: 1, variant: 'headlineMedium'}, 'Library'),
  ));
  const [meta, heading] = hosts(view.root, 'Text');
  const style = Object.assign({}, ...meta.props.style.flat().filter(Boolean));
  assert.equal(style.fontFamily, 'Archivo_400Regular');
  assert.equal(style.fontSize, 12);
  assert.equal(style.lineHeight, 16);
  assert.equal(style.color, '#ACB5C3');
  assert.equal(meta.props.numberOfLines, 2);
  assert.equal(meta.props.role, undefined);
  assert.equal(heading.props.role, 'heading');
  assert.equal(Object.assign({}, ...heading.props.style.flat().filter(Boolean)).fontFamily, 'Archivo_800ExtraBold');
});

test('on web Heading carries aria-level and text uses the Archivo fallback stack', () => {
  const kit = createKit({web: true});
  const {Heading} = kit.load('src/core/ui/components/Text.tsx', {'../theme/typography': kit.load('src/core/ui/theme/typography.ts', {'./fontStack': kit.load('src/core/ui/theme/fontStack.web.ts')})});
  const view = render(React.createElement(Heading, {level: 2, variant: 'titleLarge'}, 'Where to watch'));
  const [heading] = hosts(view.root, 'Text');
  assert.equal(heading.props.role, 'heading');
  assert.equal(heading.props['aria-level'], 2);
  const style = Object.assign({}, ...heading.props.style.flat().filter(Boolean));
  assert.equal(style.fontFamily, '"Archivo_800ExtraBold", system-ui, "Segoe UI", Roboto, sans-serif');
});
