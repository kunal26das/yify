import { Platform } from 'react-native';

const accentLight = '#9C452B';
const accentDark = '#E39A74';
const accentStrong = '#9C452B';

export const Colors = {
    light: {
        text: '#241F19',
        background: '#F3F0E9',
        tint: accentLight,
        icon: '#6E6557',
        tabIconDefault: '#6E6557',
        tabIconSelected: accentLight,

        textMuted: '#6E6557',
        textFaint: '#756B5D',
        surface: '#FBFAF6',
        surfaceElevated: '#FBFAF6',
        surfaceSunken: '#EBE5DA',
        border: '#D4CAB9',
        borderStrong: '#B9AB95',
        accent: accentLight,
        accentStrong,
        accentSecondary: '#9C6D38',
        accentSoft: 'rgba(156, 69, 43, 0.09)',
        onAccent: '#FFFFFF',
        rankNumeral: '#D4CAB9',
        gold: '#C2891C',
        seed: '#2E7D32',
        peer: '#C0492F',
        danger: '#C0392B',
        dangerSoft: 'rgba(192, 57, 43, 0.11)',
        onDanger: '#FFFFFF',
        scrim: 'rgba(0, 0, 0, 0.55)',
    },
    dark: {
        text: '#EDE7DB',
        background: '#1B1916',
        tint: accentDark,
        icon: '#B1A796',
        tabIconDefault: '#B1A796',
        tabIconSelected: accentDark,

        textMuted: '#B1A796',
        textFaint: '#A49986',
        surface: '#24211D',
        surfaceElevated: '#302B25',
        surfaceSunken: '#211E1A',
        border: '#443D33',
        borderStrong: '#645A4B',
        accent: accentDark,
        accentStrong,
        accentSecondary: '#D8B58C',
        accentSoft: 'rgba(227, 154, 116, 0.12)',
        onAccent: '#FFFFFF',
        rankNumeral: '#544A3C',
        gold: '#E6B450',
        seed: '#4CAF50',
        peer: '#E07A63',
        danger: '#C24234',
        dangerSoft: 'rgba(229, 103, 90, 0.18)',
        onDanger: '#FFFFFF',
        scrim: 'rgba(0, 0, 0, 0.60)',
    },
} as const;

export type Palette = Record<keyof (typeof Colors)['light'], string>;

export const Gradients = {
    light: {
        accent: ['#B85F40', '#9C452B'] as const,
        accentSubtle: ['rgba(217,119,87,0.14)', 'rgba(200,137,90,0.14)'] as const,
    },
    dark: {
        accent: ['#E39A74', '#BA7451'] as const,
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
    displaySemibold: 'Lora_600SemiBold',
    displayBold: 'Lora_700Bold',
    displayExtra: 'Lora_700Bold',
} as const;

export const Typography = {
    display: {fontSize: 36, lineHeight: 44, fontFamily: FontFamily.displaySemibold, letterSpacing: -0.7},
    title: {fontSize: 28, lineHeight: 36, fontFamily: FontFamily.displaySemibold, letterSpacing: -0.5},
    heading: {fontSize: 22, lineHeight: 30, fontFamily: FontFamily.displaySemibold, letterSpacing: -0.3},
    subheading: {fontSize: 18, lineHeight: 26, fontFamily: FontFamily.displaySemibold},
    body: {fontSize: 15, lineHeight: 22, fontFamily: FontFamily.regular},
    bodyStrong: {fontSize: 15, lineHeight: 22, fontFamily: FontFamily.semibold},
    caption: {fontSize: 13, lineHeight: 18, fontFamily: FontFamily.medium},
    micro: {fontSize: 11, lineHeight: 14, fontFamily: FontFamily.bold, letterSpacing: 0.4},
    videoTitle: {fontSize: 15, lineHeight: 21, fontFamily: FontFamily.semibold},
    videoMeta: {fontSize: 12.5, lineHeight: 17, fontFamily: FontFamily.regular},
    watchTitle: {fontSize: 28, lineHeight: 36, fontFamily: FontFamily.displaySemibold},
    sectionTitle: {fontSize: 20, lineHeight: 28, fontFamily: FontFamily.displaySemibold},
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
