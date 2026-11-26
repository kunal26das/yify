const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, act, createKit, findByProp, hosts, press, render} = require('../testing/kit.cjs');
const {tabProps} = require('../testing/tabs.cjs');

test('Android: a tablist of four tabs with selection, position names and filled selected glyphs', () => {
  const kit = createKit();
  const {NavigationBar} = kit.load('src/core/ui/navigation/NavigationBar.tsx');
  const {props, emitted} = tabProps(0, {youBadge: 'billing'});
  const heights = [];
  const view = render(React.createElement(kit.heightContext.Provider, {value: (height) => heights.push(height)}, React.createElement(NavigationBar, props)));
  const [bar] = findByProp(view.root, 'role', 'tablist');
  assert.deepEqual(bar.props.dataSet, {nav: 'bar'});
  const tabs = hosts(view.root, 'Pressable');
  assert.deepEqual(tabs.map((node) => node.props.role), ['tab', 'tab', 'tab', 'tab']);
  assert.deepEqual(tabs.map((node) => node.props['aria-selected']), [true, false, false, false]);
  assert.deepEqual(tabs.map((node) => node.props['aria-label']), ['Home, tab, 1 of 4', 'Search, tab, 2 of 4', 'Library, tab, 3 of 4', 'You, tab, 4 of 4, payment issue']);
  assert.deepEqual(hosts(view.root, 'Glyph').map((node) => node.props.fontName), ['YifyIconsFilled', 'YifyIcons', 'YifyIcons', 'YifyIcons']);
  assert.deepEqual(hosts(view.root, 'Text').map((node) => node.props.maxFontSizeMultiplier), [1.5, 1.5, 1.5, 1.5]);
  press(tabs[2]);
  assert.deepEqual(emitted[0], {type: 'tabPress', target: '(library)-key', canPreventDefault: true});
  assert.deepEqual(props.navigateToTab.calls, [['(library)-key']]);
  press(tabs[0]);
  assert.equal(props.navigateToTab.calls.length, 1);
  assert.equal(emitted.length, 2);
  act(() => bar.props.onLayout({nativeEvent: {layout: {height: 80}}}));
  assert.deepEqual(heights, [80]);
});

test('a prevented tab press does not navigate, and long press is emitted', () => {
  const kit = createKit();
  const {NavigationBar} = kit.load('src/core/ui/navigation/NavigationBar.tsx');
  const {props, emitted} = tabProps(0, {prevent: true});
  const view = render(React.createElement(NavigationBar, props));
  const tabs = hosts(view.root, 'Pressable');
  press(tabs[1]);
  act(() => tabs[1].props.onLongPress());
  assert.equal(props.navigateToTab.calls.length, 0);
  assert.equal(emitted[1].type, 'tabLongPress');
});

test('web: a Main navigation landmark of links with aria-current', () => {
  const kit = createKit({web: true});
  const {NavigationBar} = kit.load('src/core/ui/navigation/NavigationBar.tsx');
  const {props} = tabProps(1);
  const view = render(React.createElement(NavigationBar, props));
  const [nav] = findByProp(view.root, 'role', 'navigation');
  assert.equal(nav.props['aria-label'], 'Main');
  const links = hosts(view.root, 'Pressable');
  assert.deepEqual(links.map((node) => node.props.role), ['link', 'link', 'link', 'link']);
  assert.deepEqual(links.map((node) => node.props.href), ['/', '/search', '/library', '/you']);
  assert.deepEqual(links.map((node) => node.props['aria-current']), [undefined, 'page', undefined, undefined]);
  assert.deepEqual(links.map((node) => node.props['aria-label']), ['Home', 'Search', 'Library', 'You']);
});
