/**
 * Cinematic design system for YIFY.
 *
 * Dark-first palette built around an "aurora" accent gradient (violet → pink)
 * with IMDb-style gold for ratings. The original Expo color keys
 * (`text`, `background`, `tint`, `icon`, `tabIconDefault`, `tabIconSelected`)
 * are preserved for backward compatibility; everything new lives alongside them
 * and is surfaced through the `usePalette()` hook plus the `Spacing`, `Radius`,
 * `Typography`, and `Gradients` scales.
 */

import { Platform } from 'react-native';

// Claude / Anthropic brand palette: warm "clay" coral on ivory & charcoal.
const accentLight = '#BD5D3A';
const accentDark = '#D97757';

export const Colors = {
  light: {
      // --- Original Expo keys (kept for backward compatibility) ---
      text: '#1F1D1A',
      background: '#FAF9F5',
      tint: accentLight,
      icon: '#73706B',
      tabIconDefault: '#73706B',
      tabIconSelected: accentLight,

      // --- Extended semantic tokens ---
      textMuted: '#73706B',
      textFaint: '#A39E95',
      surface: '#FFFFFF',
      surfaceElevated: '#FFFFFF',
      surfaceSunken: '#EFEDE6',
      border: 'rgba(31, 29, 26, 0.10)',
      borderStrong: 'rgba(31, 29, 26, 0.16)',
      accent: accentLight,
      accentSecondary: '#C8895A',
      accentSoft: 'rgba(189, 93, 58, 0.11)',
      onAccent: '#FFFFFF',
      gold: '#C2891C',
      seed: '#3E8E4F',
      peer: '#C0492F',
      scrim: 'rgba(31, 29, 26, 0.55)',
  },
    dark: {
        // --- Original Expo keys (kept for backward compatibility) ---
        text: '#F5F4EE',
        background: '#262624',
        tint: accentDark,
        icon: '#9A958C',
        tabIconDefault: '#9A958C',
        tabIconSelected: accentDark,

        // --- Extended semantic tokens ---
        textMuted: '#B4AFA6',
        textFaint: '#827D74',
        surface: '#30302E',
        surfaceElevated: '#3A3A37',
        surfaceSunken: '#1E1E1C',
        border: 'rgba(245, 244, 238, 0.11)',
        borderStrong: 'rgba(245, 244, 238, 0.18)',
        accent: accentDark,
        accentSecondary: '#E0A06B',
        accentSoft: 'rgba(217, 119, 87, 0.18)',
        onAccent: '#FFFFFF',
        gold: '#E6B450',
        seed: '#62B36C',
        peer: '#E07A63',
        scrim: 'rgba(0, 0, 0, 0.55)',
    },
} as const;

export type Palette = Record<keyof (typeof Colors)['light'], string>;

/** Warm accent gradient stops (coral → clay / amber), light → dark variants. */
export const Gradients = {
    light: {
        accent: ['#D97757', '#BD5D3A'] as const,
        accentSubtle: ['rgba(217,119,87,0.14)', 'rgba(200,137,90,0.14)'] as const,
  },
  dark: {
      accent: ['#E0A06B', '#D97757'] as const,
      accentSubtle: ['rgba(224,160,107,0.20)', 'rgba(217,119,87,0.20)'] as const,
  },
} as const;

/** 4-pt based spacing scale. */
export const Spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
} as const;

/** Corner-radius scale. */
export const Radius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 22,
    pill: 999,
} as const;

/**
 * Bundled typefaces (loaded in app/_layout via expo-font), echoing Claude's
 * brand pairing: Fraunces (a warm transitional serif, à la Tiempos/Copernicus)
 * for expressive display/headings, and Hanken Grotesk (a Styrene-like humanist
 * grotesque) for body & UI. Each weight is its own family, so set `fontFamily`
 * (not `fontWeight`) to select a weight reliably across iOS, Android and web.
 */
export const FontFamily = {
    // Body / UI — Hanken Grotesk
    regular: 'HankenGrotesk_400Regular',
    medium: 'HankenGrotesk_500Medium',
    semibold: 'HankenGrotesk_600SemiBold',
    bold: 'HankenGrotesk_700Bold',
    extrabold: 'HankenGrotesk_800ExtraBold',
    // Display / headings — Fraunces (serif)
    displaySemibold: 'Fraunces_600SemiBold',
    displayBold: 'Fraunces_700Bold',
    displayExtra: 'Fraunces_900Black',
} as const;

/** Typography presets (size / lineHeight / weight / family). */
export const Typography = {
    display: {fontSize: 34, lineHeight: 40, fontFamily: FontFamily.displayExtra, letterSpacing: -0.5},
    title: {fontSize: 26, lineHeight: 32, fontFamily: FontFamily.displayExtra, letterSpacing: -0.3},
    heading: {fontSize: 20, lineHeight: 26, fontFamily: FontFamily.displayBold, letterSpacing: -0.2},
    subheading: {fontSize: 17, lineHeight: 23, fontFamily: FontFamily.displayBold},
    body: {fontSize: 15, lineHeight: 22, fontFamily: FontFamily.regular},
    bodyStrong: {fontSize: 15, lineHeight: 22, fontFamily: FontFamily.semibold},
    caption: {fontSize: 13, lineHeight: 18, fontFamily: FontFamily.medium},
    micro: {fontSize: 11, lineHeight: 14, fontFamily: FontFamily.bold, letterSpacing: 0.4},
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
