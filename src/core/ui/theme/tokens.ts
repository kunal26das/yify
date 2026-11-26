import type {BrandAccent, BrandColorRole, BrandFont} from '@/core/config/brand';
import {brand} from '@/core/config/brand';
import type {Accent, ThemePreference as StoredThemePreference} from '@/core/domain/preferences';

export type ColorScheme = 'light' | 'dark';
export type ThemePreference = StoredThemePreference;
export type AccentName = Accent;

export type ColorRoles = Record<BrandColorRole, string>;

export type AccentRoles = Pick<ColorRoles, 'primary' | 'onPrimary' | 'primaryContainer' | 'onPrimaryContainer' | 'inversePrimary' | 'focusRing'>;

export type TypeRole =
  | 'displaySmall' | 'headlineLarge' | 'headlineMedium' | 'headlineSmall'
  | 'titleLarge' | 'titleMedium' | 'titleSmall'
  | 'bodyLarge' | 'bodyMedium' | 'bodySmall'
  | 'labelLarge' | 'labelMedium' | 'labelMediumRegular' | 'labelSmall';

export type FontFamily = 'Archivo_400Regular' | 'Archivo_600SemiBold' | 'Archivo_800ExtraBold';

export interface TypeStyle {
  fontFamily: FontFamily;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
}

export const space = {none: 0, xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48, huge: 64} as const;

export const layout = {
  gutter: {compact: 16, medium: 24, expanded: 32},
  maxContentWidth: {grid: 1280, reading: 720, titleMain: 760, titleAside: 320},
  navigationBarHeight: 64,
  navigationRailWidth: 80,
  topAppBarHeight: 64,
  webHeaderHeight: 64,
  minTouchTarget: 48,
  posterMinWidth: {compact: 100, medium: 120, expanded: 144},
  railPosterWidth: {compact: 112, medium: 128, expanded: 160},
  gridGap: {compact: 12, medium: 16, expanded: 16},
} as const;

export const shape = {none: 0, extraSmall: 4, small: 8, medium: 12, large: 16, extraLarge: 28, full: 9999} as const;

export const motion = {
  duration: {short1: 50, short2: 100, short3: 150, short4: 200, medium1: 250, medium2: 300, medium4: 400, long2: 500},
  easing: {
    standard: [0.2, 0, 0, 1],
    standardDecelerate: [0, 0, 0, 1],
    standardAccelerate: [0.3, 0, 1, 1],
    emphasizedDecelerate: [0.05, 0.7, 0.1, 1],
    emphasizedAccelerate: [0.3, 0, 0.8, 0.15],
  },
} as const;

export const stateLayer = {hover: 0.08, focus: 0.1, pressed: 0.1, dragged: 0.16, disabledContent: 0.38, disabledContainer: 0.12} as const;

export interface Tokens {
  colors: Record<ColorScheme, ColorRoles>;
  accents: Record<AccentName, Record<ColorScheme, AccentRoles>>;
  accentNames: Record<AccentName, string>;
  plusAccents: readonly AccentName[];
  type: Record<TypeRole, TypeStyle>;
  space: typeof space;
  shape: typeof shape;
  layout: typeof layout;
  motion: typeof motion;
  stateLayer: typeof stateLayer;
}

export const ACCENT_NAMES: readonly AccentName[] = ['default', 'accent1', 'accent2', 'accent3'];
export const COLOR_SCHEMES: readonly ColorScheme[] = ['dark', 'light'];

const FONT_FAMILIES: Readonly<Record<FontFamily, true>> = {
  Archivo_400Regular: true,
  Archivo_600SemiBold: true,
  Archivo_800ExtraBold: true,
};

type Face = 'display' | 'body' | 'bodyStrong';

const TYPE_SCALE: Readonly<Record<TypeRole, {face: Face; fontSize: number; lineHeight: number; letterSpacing: number}>> = {
  displaySmall: {face: 'display', fontSize: 36, lineHeight: 40, letterSpacing: -0.9},
  headlineLarge: {face: 'display', fontSize: 32, lineHeight: 36, letterSpacing: -0.8},
  headlineMedium: {face: 'display', fontSize: 28, lineHeight: 32, letterSpacing: -0.6},
  headlineSmall: {face: 'display', fontSize: 24, lineHeight: 28, letterSpacing: -0.4},
  titleLarge: {face: 'display', fontSize: 20, lineHeight: 26, letterSpacing: -0.2},
  titleMedium: {face: 'bodyStrong', fontSize: 16, lineHeight: 22, letterSpacing: 0},
  titleSmall: {face: 'bodyStrong', fontSize: 14, lineHeight: 18, letterSpacing: 0.05},
  bodyLarge: {face: 'body', fontSize: 16, lineHeight: 24, letterSpacing: 0.1},
  bodyMedium: {face: 'body', fontSize: 14, lineHeight: 20, letterSpacing: 0.15},
  bodySmall: {face: 'body', fontSize: 12, lineHeight: 16, letterSpacing: 0.25},
  labelLarge: {face: 'bodyStrong', fontSize: 14, lineHeight: 20, letterSpacing: 0.1},
  labelMedium: {face: 'bodyStrong', fontSize: 12, lineHeight: 16, letterSpacing: 0.3},
  labelMediumRegular: {face: 'body', fontSize: 12, lineHeight: 16, letterSpacing: 0.3},
  labelSmall: {face: 'bodyStrong', fontSize: 11, lineHeight: 16, letterSpacing: 0.4},
};

function fontFamilyOf(font: BrandFont): FontFamily {
  if (!Object.hasOwn(FONT_FAMILIES, font.family)) throw new Error(`Unsupported brand font family: ${font.family}`);
  return font.family as FontFamily;
}

function accentOf(id: AccentName): BrandAccent {
  const accent = brand.accents.find((candidate) => candidate.id === id);
  if (!accent) throw new Error(`config/brand.json has no accent ${id}`);
  return accent;
}

function buildType(): Record<TypeRole, TypeStyle> {
  const entries = (Object.keys(TYPE_SCALE) as TypeRole[]).map((role) => {
    const {face, ...metrics} = TYPE_SCALE[role];
    return [role, {fontFamily: fontFamilyOf(brand.fonts[face]), ...metrics}] as const;
  });
  return Object.fromEntries(entries) as Record<TypeRole, TypeStyle>;
}

function buildAccents(): Record<AccentName, Record<ColorScheme, AccentRoles>> {
  const entries = ACCENT_NAMES.map((id) => {
    const accent = accentOf(id);
    return [id, {light: {...accent.light}, dark: {...accent.dark}}] as const;
  });
  return Object.fromEntries(entries) as Record<AccentName, Record<ColorScheme, AccentRoles>>;
}

export const tokens: Tokens = {
  colors: {light: {...brand.colors.light}, dark: {...brand.colors.dark}},
  accents: buildAccents(),
  accentNames: Object.fromEntries(ACCENT_NAMES.map((id) => [id, accentOf(id).name])) as Record<AccentName, string>,
  plusAccents: ACCENT_NAMES.filter((id) => id !== 'default'),
  type: buildType(),
  space,
  shape,
  layout,
  motion,
  stateLayer,
};

export function resolveColors(scheme: ColorScheme, accent: AccentName): ColorRoles {
  return {...tokens.colors[scheme], ...tokens.accents[accent][scheme]};
}

export function resolveScheme(preference: ThemePreference, system: ColorScheme | null | undefined): ColorScheme {
  if (preference === 'system') return system === 'light' ? 'light' : 'dark';
  return preference;
}

export const BRAND_FONTS: Readonly<Record<Face, BrandFont>> = brand.fonts;
