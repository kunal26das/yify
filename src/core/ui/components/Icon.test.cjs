const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, hosts, render} = require('../testing/kit.cjs');
const glyphMap = require('../icons/glyphMap.json');

test('Android icons render the subset font glyph, filled only where a filled glyph exists, and stay hidden', () => {
  const kit = createKit();
  const {Icon} = kit.load('src/core/ui/components/Icon.tsx');
  const view = render(React.createElement(React.Fragment, null,
    React.createElement(Icon, {name: 'bookmark', filled: true, size: 20, color: 'primary'}),
    React.createElement(Icon, {name: 'star_half', filled: true}),
    React.createElement(Icon, {name: 'search'}),
  ));
  const [bookmark, half, search] = hosts(view.root, 'Glyph');
  assert.equal(bookmark.props.fontName, 'YifyIconsFilled');
  assert.equal(bookmark.props.glyph, glyphMap.bookmark);
  assert.equal(bookmark.props.size, 20);
  assert.equal(bookmark.props.color, '#C8F03C');
  assert.equal(bookmark.props['aria-hidden'], true);
  assert.equal(half.props.fontName, 'YifyIcons');
  assert.equal(search.props.fontName, 'YifyIcons');
  assert.equal(search.props.color, '#ACB5C3');
  assert.equal(search.props.allowFontScaling, false);
});

test('web icons are inline SVG paths that are hidden from assistive technology', () => {
  const kit = createKit({web: true});
  const {Icon} = kit.load('src/core/ui/components/Icon.web.tsx');
  const {GLYPH_PATHS} = kit.load('src/core/ui/icons/glyphPaths.web.ts');
  const view = render(React.createElement(React.Fragment, null,
    React.createElement(Icon, {name: 'home', filled: true, size: 24}),
    React.createElement(Icon, {name: 'share', filled: true, size: 48}),
  ));
  const [home, share] = hosts(view.root, 'svg');
  assert.equal(home.props.viewBox, '0 -960 960 960');
  assert.equal(home.props['aria-hidden'], 'true');
  assert.equal(home.props.focusable, 'false');
  assert.equal(home.props.style.color, 'var(--c-onSurfaceVariant)');
  assert.equal(hosts(view.root, 'path')[0].props.d, GLYPH_PATHS.home.filled);
  assert.equal(hosts(view.root, 'path')[1].props.d, GLYPH_PATHS.share.outline);
  assert.equal(share.props.width, 48);
});
