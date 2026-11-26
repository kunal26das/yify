import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import brand from '../../../../config/brand.json';
import fontSubsets from './fontSubsets.json';
import {tokens} from './tokens';
import {WEB_FONT_PRELOADS, themeColorFor, webChromeCss, webDocumentCss, webFontFaceCss, webInteractionCss, webThemeCss} from './webCss';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');

function declarations(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector}{`);
  assert.notEqual(start, -1, selector);
  const body = css.slice(start + selector.length + 1, css.indexOf('}', start));
  return Object.fromEntries(body.split(';').map((part) => part.split(':')).map(([key, ...value]) => [key, value.join(':')]));
}

test('the dark palette is the :root default and light, system and accent blocks override it', () => {
  const css = webThemeCss();
  const root = declarations(css, ':root');
  const light = declarations(css, '[data-theme="light"]');
  assert.equal(root['color-scheme'], 'dark');
  assert.equal(light['color-scheme'], 'light');
  for (const role of Object.keys(tokens.colors.dark)) {
    assert.equal(root[`--c-${role}`], brand.colors.dark[role as keyof typeof brand.colors.dark], role);
    assert.equal(light[`--c-${role}`], brand.colors.light[role as keyof typeof brand.colors.light], role);
  }
  assert.match(css, /@media \(prefers-color-scheme: light\)\{\[data-theme="system"\]\{color-scheme:light;--c-surface:#F5F6F9/);
  const ice = declarations(css, ':root[data-accent="accent1"]');
  assert.deepEqual(Object.keys(ice).sort(), ['--c-focusRing', '--c-inversePrimary', '--c-onPrimary', '--c-onPrimaryContainer', '--c-primary', '--c-primaryContainer']);
  assert.equal(ice['--c-primary'], '#6BE4F2');
  assert.equal(declarations(css, '[data-theme="light"][data-accent="accent3"]')['--c-primaryContainer'], '#0F131A');
  assert.equal(css.includes('[data-accent="default"]'), false);
  assert.ok(css.indexOf(':root[data-accent="accent1"]') > css.indexOf('[data-theme="light"]{'));
});

test('every Archivo face declares latin, latin-ext and vietnamese subsets that exist in public/fonts', () => {
  const css = webFontFaceCss();
  const faces = css.match(/@font-face\{[^}]+\}/g) ?? [];
  assert.equal(faces.length, 9);
  for (const face of ['display', 'body', 'bodyStrong'] as const) {
    for (const subset of fontSubsets.subsets) {
      const file = brand.fonts[face].web.replace('.woff2', `.${subset.name}.woff2`);
      const block = faces.find((entry) => entry.includes(`/fonts/${file}`));
      assert.ok(block, file);
      assert.ok(block.includes(`font-family:"${brand.fonts[face].family}"`));
      assert.ok(block.includes('font-display:swap'));
      assert.ok(block.includes(`unicode-range:${subset.unicodeRange}`));
      assert.ok(statSync(join(ROOT, 'public', 'fonts', file)).size > 4000, file);
    }
  }
  assert.equal(/font-weight/.test(css), false);
});

test('only the latin display and body faces are preloaded', () => {
  assert.deepEqual(WEB_FONT_PRELOADS, [
    {href: '/fonts/Archivo-800.latin.woff2', type: 'font/woff2'},
    {href: '/fonts/Archivo-400.latin.woff2', type: 'font/woff2'},
  ]);
});

test('the chrome rules show exactly one navigation variant per window class', () => {
  const css = webChromeCss();
  assert.match(css, /@media \(max-width:599\.98px\)\{:root \[data-nav="header"\],:root \[data-nav="rail"\]\{display:none\}/);
  assert.match(css, /@media \(min-width:600px\) and \(max-width:839\.98px\)\{:root \[data-nav="header"\],:root \[data-nav="bar"\]\{display:none\}:root \[data-screen\]\{padding-left:80px\}\}/);
  assert.match(css, /@media \(min-width:840px\)\{:root \[data-nav="rail"\],:root \[data-nav="bar"\]\{display:none\}:root \[data-top-app-bar\]\{display:none\}:root \[data-page-title\]\{display:flex\}\}/);
  assert.ok(css.indexOf(':root [data-page-title]{display:none}') < css.indexOf(':root [data-page-title]{display:flex}'));
  assert.match(css, /calc\(64px \+ env\(safe-area-inset-bottom\) \+ var\(--overlay-height,0px\)\)/);
});

test('focus rings, state layers, skeleton pulse and reduced motion come from tokens', () => {
  const css = webInteractionCss();
  assert.ok(css.includes(':root [data-focusable]:focus-visible{outline:2px solid var(--c-focusRing);outline-offset:2px}'));
  assert.ok(css.includes(':root [data-focusable]:hover>[data-state-layer]{opacity:0.08}'));
  assert.ok(css.includes(':root [data-focusable]:active>[data-state-layer]{opacity:0.1}'));
  assert.ok(css.includes('animation:yify-pulse 1200ms ease-in-out infinite'));
  assert.ok(css.includes(':root [data-hit-slop]::before{content:"";position:absolute;inset:-4px}'));
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\{:root \[data-state-layer\]\{transition:none\}:root \[data-skeleton\]\{animation:none\}\}/);
  assert.ok(webDocumentCss().includes(css));
});

test('theme-color follows the surface of each scheme and the module carries no colour literal of its own', () => {
  assert.equal(themeColorFor('dark'), '#0B0D13');
  assert.equal(themeColorFor('light'), '#F5F6F9');
  const source = readFileSync(join(ROOT, 'src/core/ui/theme/webCss.ts'), 'utf8');
  assert.equal(/#[0-9A-Fa-f]{3,8}\b/.test(source), false);
});
