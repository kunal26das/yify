import fontSubsets from './fontSubsets.json';
import type {AccentName, AccentRoles, ColorRoles, ColorScheme} from './tokens';
import {ACCENT_NAMES, BRAND_FONTS, layout, motion, stateLayer, tokens} from './tokens';

export interface WebFontPreload {
  href: string;
  type: 'font/woff2';
}

type Face = keyof typeof BRAND_FONTS;

const FACES: readonly Face[] = ['display', 'body', 'bodyStrong'];
const LIGHT = '(prefers-color-scheme: light)';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const COMPACT_MAX = 599.98;
const MEDIUM_MAX = 839.98;
const WEB_HIT_SLOP = 4;

function fontUrl(face: Face, subset: string): string {
  return `/fonts/${BRAND_FONTS[face].web.replace(/\.woff2$/, `.${subset}.woff2`)}`;
}

function declarations(values: Partial<ColorRoles> | AccentRoles): string {
  return Object.entries(values).map(([role, value]) => `--c-${role}:${value}`).join(';');
}

function rule(selector: string, body: string): string {
  return `${selector}{${body}}`;
}

function scoped(selectors: string): string {
  return selectors.split(',').map((selector) => `:root ${selector.trim()}`).join(',');
}

function scopedRule(selectors: string, body: string): string {
  return rule(scoped(selectors), body);
}

function media(query: string, body: string): string {
  return `@media ${query}{${body}}`;
}

function easing(name: keyof typeof motion.easing): string {
  return `cubic-bezier(${motion.easing[name].join(',')})`;
}

export function webFontFaceCss(): string {
  return FACES.flatMap((face) => fontSubsets.subsets.map((subset) => rule('@font-face', [
    `font-family:"${BRAND_FONTS[face].family}"`,
    'font-style:normal',
    'font-display:swap',
    `src:url(${fontUrl(face, subset.name)}) format("woff2")`,
    `unicode-range:${subset.unicodeRange}`,
  ].join(';')))).join('');
}

export const WEB_FONT_PRELOADS: readonly WebFontPreload[] = fontSubsets.preloadFaces.flatMap((face) => fontSubsets.subsets
  .filter((subset) => subset.preload)
  .map((subset) => ({href: fontUrl(face as Face, subset.name), type: 'font/woff2' as const})));

function schemeBody(scheme: ColorScheme): string {
  return `color-scheme:${scheme};${declarations({...tokens.colors[scheme], ...tokens.accents.default[scheme]})}`;
}

function accentRules(accent: AccentName): string {
  if (accent === 'default') return '';
  const selector = `[data-accent="${accent}"]`;
  return [
    rule(`:root${selector}`, declarations(tokens.accents[accent].dark)),
    rule(`[data-theme="light"]${selector}`, declarations(tokens.accents[accent].light)),
    media(LIGHT, rule(`[data-theme="system"]${selector}`, declarations(tokens.accents[accent].light))),
  ].join('');
}

export function webThemeCss(): string {
  return [
    rule(':root', schemeBody('dark')),
    rule('[data-theme="light"]', schemeBody('light')),
    media(LIGHT, rule('[data-theme="system"]', schemeBody('light'))),
    ...ACCENT_NAMES.map(accentRules),
    rule('html,body', 'background-color:var(--c-surface);color:var(--c-onSurface)'),
  ].join('');
}

export function webChromeCss(): string {
  const bar = layout.navigationBarHeight;
  const rail = layout.navigationRailWidth;
  const barInset = `${bar}px + env(safe-area-inset-bottom)`;
  const barHeight = `calc(${barInset})`;
  return [
    scopedRule('[data-page-title]', 'display:none'),
    scopedRule('[data-nav="rail"],[data-nav="bar"]', 'position:fixed;z-index:20'),
    scopedRule('[data-nav="rail"]', `top:0;bottom:0;left:0;width:${rail}px`),
    scopedRule('[data-nav="bar"]', `left:0;right:0;bottom:0;height:${barHeight}`),
    media(`(max-width:${COMPACT_MAX}px)`, `${scopedRule('[data-nav="header"],[data-nav="rail"]', 'display:none')}${scopedRule('[data-screen]', `padding-bottom:${barHeight}`)}`),
    media(`(min-width:600px) and (max-width:${MEDIUM_MAX}px)`, `${scopedRule('[data-nav="header"],[data-nav="bar"]', 'display:none')}${scopedRule('[data-screen]', `padding-left:${rail}px`)}`),
    media('(min-width:840px)', `${scopedRule('[data-nav="rail"],[data-nav="bar"]', 'display:none')}${scopedRule('[data-top-app-bar]', 'display:none')}${scopedRule('[data-page-title]', 'display:flex')}`),
    rule('html', 'scroll-padding-bottom:var(--overlay-height,0px)'),
    media(`(max-width:${COMPACT_MAX}px)`, rule('html', `scroll-padding-bottom:calc(${barInset} + var(--overlay-height,0px))`)),
  ].join('');
}

export function webInteractionCss(): string {
  return [
    scopedRule('[data-focusable]:focus-visible', 'outline:2px solid var(--c-focusRing);outline-offset:2px'),
    scopedRule('[data-focusable]:focus:not(:focus-visible),[data-text-input]:focus', 'outline:none'),
    scopedRule('[data-state-layer]', `opacity:0;transition:opacity ${motion.duration.short3}ms ${easing('standard')}`),
    scopedRule('[data-focusable]:hover>[data-state-layer]', `opacity:${stateLayer.hover}`),
    scopedRule('[data-focusable]:focus-visible>[data-state-layer]', `opacity:${stateLayer.focus}`),
    scopedRule('[data-focusable]:active>[data-state-layer]', `opacity:${stateLayer.pressed}`),
    scopedRule('[data-focusable][aria-disabled="true"]>[data-state-layer]', 'opacity:0'),
    scopedRule('[data-hit-slop]::before', `content:"";position:absolute;inset:-${WEB_HIT_SLOP}px`),
    scopedRule('[data-sr-only],[data-skip-link]:not(:focus)', 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0'),
    rule('@keyframes yify-pulse', '0%,100%{opacity:1}50%{opacity:0.55}'),
    scopedRule('[data-skeleton]', 'animation:yify-pulse 1200ms ease-in-out infinite'),
    media(REDUCED_MOTION, `${scopedRule('[data-state-layer]', 'transition:none')}${scopedRule('[data-skeleton]', 'animation:none')}`),
  ].join('');
}

export function webDocumentCss(): string {
  return [webFontFaceCss(), webThemeCss(), webChromeCss(), webInteractionCss()].join('\n');
}

export function themeColorFor(scheme: ColorScheme): string {
  return tokens.colors[scheme].surface;
}
