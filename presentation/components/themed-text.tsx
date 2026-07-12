import {StyleSheet, Text, type TextProps, type TextStyle} from 'react-native';

import {useThemeColor} from '../hooks/use-theme-color';
import {FontFamily, Typography} from '../constants/theme';

export type ThemedTextType =
    | 'default'
    | 'title'
    | 'display'
    | 'heading'
    | 'subtitle'
    | 'defaultSemiBold'
    | 'caption'
    | 'micro'
    | 'link';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
    type?: ThemedTextType;
};

const DISPLAY_TYPES = new Set<ThemedTextType>(['display', 'title', 'heading', 'subtitle']);

const PRESET_FAMILY: Record<ThemedTextType, string> = {
    display: FontFamily.displayExtra,
    title: FontFamily.displayExtra,
    heading: FontFamily.displayBold,
    subtitle: FontFamily.displayBold,
    caption: FontFamily.medium,
    micro: FontFamily.bold,
    default: FontFamily.regular,
    defaultSemiBold: FontFamily.semibold,
    link: FontFamily.semibold,
};

function pickFamily(type: ThemedTextType, weight: TextStyle['fontWeight']): string {
    const w = String(weight);
    if (DISPLAY_TYPES.has(type)) {
        if (w === '800' || w === '900') return FontFamily.displayExtra;
        if (w === '700' || w === '600' || w === 'bold') return FontFamily.displayBold;
        return FontFamily.displaySemibold;
    }
    if (w === '800' || w === '900') return FontFamily.extrabold;
    if (w === '700' || w === 'bold') return FontFamily.bold;
    if (w === '600') return FontFamily.semibold;
    if (w === '500') return FontFamily.medium;
    if (w === '400' || w === 'normal') return FontFamily.regular;
    return PRESET_FAMILY[type];
}

export function ThemedText({style, lightColor, darkColor, type = 'default', ...rest}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

    const typeStyle =
        type === 'display'
            ? styles.display
            : type === 'title'
                ? styles.title
                : type === 'heading'
                    ? styles.heading
                    : type === 'subtitle'
                        ? styles.subtitle
                        : type === 'defaultSemiBold'
                            ? styles.defaultSemiBold
                            : type === 'caption'
                                ? styles.caption
                                : type === 'micro'
                                    ? styles.micro
                                    : type === 'link'
                                        ? styles.link
                                        : styles.default;

    const callerWeight = (StyleSheet.flatten(style) as TextStyle | undefined)?.fontWeight;
    const family = callerWeight != null ? pickFamily(type, callerWeight) : PRESET_FAMILY[type];

  return (
    <Text
        style={[{color}, typeStyle, style, {fontFamily: family, fontWeight: 'normal'}]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
    display: Typography.display,
    title: Typography.title,
    heading: Typography.heading,
    subtitle: Typography.subheading,
    caption: Typography.caption,
    micro: Typography.micro,
  link: {
    lineHeight: 30,
    fontSize: 16,
      color: '#BD5D3A',
      fontWeight: '600',
  },
});
