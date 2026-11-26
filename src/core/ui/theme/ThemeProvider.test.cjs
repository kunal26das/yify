const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, act, createKit, render} = require('../testing/kit.cjs');

function probe(kit, file, props) {
  const themeModule = kit.load('src/core/ui/theme/useTheme.ts');
  const {ThemeProvider} = kit.load(file, {'./useTheme': themeModule});
  const {useTheme} = themeModule;
  let theme;
  function Probe() {
    theme = useTheme();
    return null;
  }
  const view = render(React.createElement(ThemeProvider, props, React.createElement(Probe)));
  return {view, read: () => theme, ThemeProvider, Probe};
}

test('Android resolves the stored preference and accent into hex colour roles', () => {
  const kit = createKit();
  const dark = probe(kit, 'src/core/ui/theme/ThemeProvider.tsx', {preference: 'dark', accent: 'default'});
  assert.equal(dark.read().scheme, 'dark');
  assert.equal(dark.read().colors.surface, '#0B0D13');
  assert.equal(dark.read().colors.primary, '#C8F03C');
  assert.equal(dark.read().type.titleLarge.fontFamily, 'Archivo_800ExtraBold');
  const light = probe(kit, 'src/core/ui/theme/ThemeProvider.tsx', {preference: 'light', accent: 'accent2'});
  assert.equal(light.read().colors.surface, '#F5F6F9');
  assert.equal(light.read().colors.primary, '#0F131A');
  assert.equal(light.read().colors.primaryContainer, '#E29AFF');
  assert.deepEqual(kit.navigationBar.setStyle.calls.at(-1), ['light']);
  assert.deepEqual(kit.statusBar.setStatusBarStyle.calls.at(-1), ['dark']);
  assert.deepEqual(kit.systemUi.setBackgroundColorAsync.calls.at(-1), ['#F5F6F9']);
});

test('system follows the device scheme and defaults to dark when it is unknown', () => {
  const kit = createKit();
  kit.rn.setColorScheme('light');
  const system = probe(kit, 'src/core/ui/theme/ThemeProvider.tsx', {preference: 'system', accent: 'default'});
  assert.equal(system.read().scheme, 'light');
  act(() => kit.rn.setColorScheme('dark'));
  assert.equal(system.read().scheme, 'dark');
  act(() => kit.rn.setColorScheme(null));
  assert.equal(system.read().scheme, 'dark');
});

test('useTheme without a provider is the dark default theme', () => {
  const kit = createKit();
  const {useTheme} = kit.load('src/core/ui/theme/useTheme.ts');
  let theme;
  function Probe() {
    theme = useTheme();
    return null;
  }
  render(React.createElement(Probe));
  assert.equal(theme.scheme, 'dark');
  assert.equal(theme.accent, 'default');
});

test('web colours are CSS variables and the provider stamps the theme and accent on the document', () => {
  const kit = createKit({web: true});
  const dataset = {};
  const metas = [{setAttribute: (name, value) => (dataset.meta = value)}];
  const previous = {document: globalThis.document, window: globalThis.window};
  globalThis.document = {documentElement: {dataset}, querySelectorAll: () => metas};
  globalThis.window = {matchMedia: () => ({matches: true, addEventListener: () => undefined, removeEventListener: () => undefined})};
  try {
    const systemBars = kit.load('src/core/ui/systemBars.web.ts');
    const {view, read} = (() => {
      const themeModule = kit.load('src/core/ui/theme/useTheme.ts');
      const {ThemeProvider} = kit.load('src/core/ui/theme/ThemeProvider.web.tsx', {'../systemBars': systemBars, './useTheme': themeModule});
      const {useTheme} = themeModule;
      let theme;
      function Probe() {
        theme = useTheme();
        return null;
      }
      return {view: render(React.createElement(ThemeProvider, {preference: 'system', accent: 'accent1'}, React.createElement(Probe))), read: () => theme};
    })();
    assert.equal(read().colors.surface, 'var(--c-surface)');
    assert.equal(read().colors.focusRing, 'var(--c-focusRing)');
    assert.equal(read().scheme, 'light');
    assert.equal(dataset.theme, 'system');
    assert.equal(dataset.accent, 'accent1');
    assert.equal(dataset.meta, '#F5F6F9');
    view.unmount();
  } finally {
    globalThis.document = previous.document;
    globalThis.window = previous.window;
  }
});
