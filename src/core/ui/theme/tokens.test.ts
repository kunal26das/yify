import assert from 'node:assert/strict';
import {test} from 'node:test';
import brand from '../../../../config/brand.json';
import {ACCENT_NAMES, layout, motion, resolveColors, resolveScheme, shape, space, stateLayer, tokens} from './tokens';

const IDENTITY_SCALE = {
  displaySmall: ['Archivo_800ExtraBold', 36, 40, -0.9],
  headlineLarge: ['Archivo_800ExtraBold', 32, 36, -0.8],
  headlineMedium: ['Archivo_800ExtraBold', 28, 32, -0.6],
  headlineSmall: ['Archivo_800ExtraBold', 24, 28, -0.4],
  titleLarge: ['Archivo_800ExtraBold', 20, 26, -0.2],
  titleMedium: ['Archivo_600SemiBold', 16, 22, 0],
  titleSmall: ['Archivo_600SemiBold', 14, 18, 0.05],
  bodyLarge: ['Archivo_400Regular', 16, 24, 0.1],
  bodyMedium: ['Archivo_400Regular', 14, 20, 0.15],
  bodySmall: ['Archivo_400Regular', 12, 16, 0.25],
  labelLarge: ['Archivo_600SemiBold', 14, 20, 0.1],
  labelMedium: ['Archivo_600SemiBold', 12, 16, 0.3],
  labelMediumRegular: ['Archivo_400Regular', 12, 16, 0.3],
  labelSmall: ['Archivo_600SemiBold', 11, 16, 0.4],
} as const;

test('colour roles are exactly the brand roles in both schemes', () => {
  for (const scheme of ['light', 'dark'] as const) {
    assert.deepEqual(tokens.colors[scheme], brand.colors[scheme]);
    assert.deepEqual(Object.keys(tokens.colors[scheme]).sort(), Object.keys(brand.colors[scheme]).sort());
  }
});

test('the four accent slots come from config/brand.json with their display names', () => {
  assert.deepEqual(ACCENT_NAMES, ['default', 'accent1', 'accent2', 'accent3']);
  assert.deepEqual(tokens.plusAccents, ['accent1', 'accent2', 'accent3']);
  assert.deepEqual(tokens.accentNames, {default: 'Lime', accent1: 'Ice', accent2: 'Orchid', accent3: 'Mono'});
  for (const accent of brand.accents) {
    assert.deepEqual(tokens.accents[accent.id as 'default'].light, accent.light);
    assert.deepEqual(tokens.accents[accent.id as 'default'].dark, accent.dark);
  }
  assert.equal(Object.hasOwn(tokens.accents, 'accent4'), false);
});

test('an accent replaces only the six accent roles and the default accent equals the base palette', () => {
  for (const scheme of ['light', 'dark'] as const) {
    assert.deepEqual(resolveColors(scheme, 'default'), tokens.colors[scheme]);
    const ice = resolveColors(scheme, 'accent1');
    const changed = Object.keys(ice).filter((role) => ice[role as keyof typeof ice] !== tokens.colors[scheme][role as keyof typeof ice]);
    for (const role of changed) assert.ok(['primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'inversePrimary', 'focusRing'].includes(role), role);
    assert.equal(ice.surface, tokens.colors[scheme].surface);
  }
  assert.equal(resolveColors('dark', 'accent1').primary, '#6BE4F2');
  assert.equal(resolveColors('light', 'accent3').onPrimaryContainer, '#FFFFFF');
});

test('the type scale is the Lights Down identity scale on the three Archivo faces', () => {
  for (const [role, [fontFamily, fontSize, lineHeight, letterSpacing]] of Object.entries(IDENTITY_SCALE)) {
    assert.deepEqual(tokens.type[role as keyof typeof IDENTITY_SCALE], {fontFamily, fontSize, lineHeight, letterSpacing}, role);
  }
  const families = new Set(Object.values(tokens.type).map((style) => style.fontFamily));
  assert.deepEqual([...families].sort(), [brand.fonts.body.family, brand.fonts.bodyStrong.family, brand.fonts.display.family].sort());
});

test('space, shape, layout, motion and state layers keep the B2 values', () => {
  assert.deepEqual(space, {none: 0, xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48, huge: 64});
  assert.deepEqual(shape, {none: 0, extraSmall: 4, small: 8, medium: 12, large: 16, extraLarge: 28, full: 9999});
  assert.equal(layout.minTouchTarget, 48);
  assert.deepEqual(layout.gutter, {compact: 16, medium: 24, expanded: 32});
  assert.deepEqual(motion.duration, {short1: 50, short2: 100, short3: 150, short4: 200, medium1: 250, medium2: 300, medium4: 400, long2: 500});
  assert.deepEqual(motion.easing.emphasizedDecelerate, [0.05, 0.7, 0.1, 1]);
  assert.deepEqual(stateLayer, {hover: 0.08, focus: 0.1, pressed: 0.1, dragged: 0.16, disabledContent: 0.38, disabledContainer: 0.12});
});

test('the theme preference resolves to a scheme with dark as the fallback', () => {
  assert.equal(resolveScheme('dark', 'light'), 'dark');
  assert.equal(resolveScheme('light', 'dark'), 'light');
  assert.equal(resolveScheme('system', 'light'), 'light');
  assert.equal(resolveScheme('system', 'dark'), 'dark');
  assert.equal(resolveScheme('system', null), 'dark');
});
