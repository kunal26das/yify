import { Platform } from 'react-native';

const accentLight = '#BD5D3A';
const accentDark = '#D97757';

export const Colors = {
  light: {
      text: '#1F1D1A',
      background: '#FAF9F5',
      tint: accentLight,
      icon: '#73706B',
      tabIconDefault: '#73706B',
      tabIconSelected: accentLight,

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
        text: '#F5F4EE',
        background: '#262624',
        tint: accentDark,
        icon: '#9A958C',
        tabIconDefault: '#9A958C',
        tabIconSelected: accentDark,

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

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
} as const;

export const Radius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 22,
    pill: 999,
} as const;

export const FontFamily = {
    regular: 'HankenGrotesk_400Regular',
    medium: 'HankenGrotesk_500Medium',
    semibold: 'HankenGrotesk_600SemiBold',
    bold: 'HankenGrotesk_700Bold',
    extrabold: 'HankenGrotesk_800ExtraBold',
    displaySemibold: 'Fraunces_600SemiBold',
    displayBold: 'Fraunces_700Bold',
    displayExtra: 'Fraunces_900Black',
} as const;

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
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
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
