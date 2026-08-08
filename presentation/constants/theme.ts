import { Platform } from 'react-native';

const accentLight = '#BD5D3A';
const accentDark = '#D97757';

export const Colors = {
    light: {
        text: '#0F0F0F',
        background: '#FFFFFF',
        tint: accentLight,
        icon: '#606060',
        tabIconDefault: '#606060',
        tabIconSelected: accentLight,

        textMuted: '#606060',
        textFaint: '#909090',
        surface: '#F9F9F9',
        surfaceElevated: '#FFFFFF',
        surfaceSunken: '#F2F2F2',
        border: 'rgba(0, 0, 0, 0.10)',
        borderStrong: 'rgba(0, 0, 0, 0.16)',
        accent: accentLight,
        accentSecondary: '#C8895A',
        accentSoft: 'rgba(189, 93, 58, 0.11)',
        onAccent: '#FFFFFF',
        rankNumeral: '#E5E5E5',
        gold: '#C2891C',
        seed: '#2E7D32',
        peer: '#C0492F',
        danger: '#C0392B',
        dangerSoft: 'rgba(192, 57, 43, 0.11)',
        onDanger: '#FFFFFF',
        scrim: 'rgba(0, 0, 0, 0.55)',
    },
    dark: {
        text: '#F1F1F1',
        background: '#0F0F0F',
        tint: accentDark,
        icon: '#AAAAAA',
        tabIconDefault: '#AAAAAA',
        tabIconSelected: accentDark,

        textMuted: '#AAAAAA',
        textFaint: '#717171',
        surface: '#212121',
        surfaceElevated: '#272727',
        surfaceSunken: '#181818',
        border: 'rgba(255, 255, 255, 0.10)',
        borderStrong: 'rgba(255, 255, 255, 0.18)',
        accent: accentDark,
        accentSecondary: '#E0A06B',
        accentSoft: 'rgba(217, 119, 87, 0.18)',
        onAccent: '#FFFFFF',
        rankNumeral: '#3F3F3F',
        gold: '#E6B450',
        seed: '#4CAF50',
        peer: '#E07A63',
        danger: '#E5675A',
        dangerSoft: 'rgba(229, 103, 90, 0.18)',
        onDanger: '#FFFFFF',
        scrim: 'rgba(0, 0, 0, 0.60)',
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
        accentSubtle: ['rgba(217,119,87,0.13)', 'rgba(217,119,87,0.04)'] as const,
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
    card: 12,
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
    display: {fontSize: 30, lineHeight: 36, fontFamily: FontFamily.displayExtra, letterSpacing: -0.5},
    title: {fontSize: 22, lineHeight: 28, fontFamily: FontFamily.displayExtra, letterSpacing: -0.3},
    heading: {fontSize: 18, lineHeight: 24, fontFamily: FontFamily.displayBold, letterSpacing: -0.2},
    subheading: {fontSize: 16, lineHeight: 22, fontFamily: FontFamily.displayBold},
    body: {fontSize: 15, lineHeight: 22, fontFamily: FontFamily.regular},
    bodyStrong: {fontSize: 15, lineHeight: 22, fontFamily: FontFamily.semibold},
    caption: {fontSize: 13, lineHeight: 18, fontFamily: FontFamily.medium},
    micro: {fontSize: 11, lineHeight: 14, fontFamily: FontFamily.bold, letterSpacing: 0.4},
    videoTitle: {fontSize: 15, lineHeight: 21, fontFamily: FontFamily.semibold},
    videoMeta: {fontSize: 12.5, lineHeight: 17, fontFamily: FontFamily.regular},
    watchTitle: {fontSize: 20, lineHeight: 27, fontFamily: FontFamily.bold},
    sectionTitle: {fontSize: 16, lineHeight: 22, fontFamily: FontFamily.bold},
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
