import type {StyleProp, TextProps as NativeTextProps, TextStyle} from 'react-native';
import {Text as NativeText} from 'react-native';
import {headingProps} from '../a11y';
import type {ColorRoles, TypeRole} from '../theme/tokens';
import {textStyle} from '../theme/typography';
import {useTheme} from '../theme/useTheme';

export type TextOwnStyle = Omit<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'fontWeight' | 'color'>;

export interface TextProps extends Omit<NativeTextProps, 'style'> {
  variant: TypeRole;
  color?: keyof ColorRoles;
  align?: 'auto' | 'left' | 'center' | 'right';
  style?: StyleProp<TextOwnStyle>;
}

export function Text({variant, color = 'onSurface', align, style, ...rest}: TextProps) {
  const theme = useTheme();
  return (
    <NativeText
      {...rest}
      style={[textStyle(theme.type[variant]), {color: theme.colors[color]}, align ? {textAlign: align} : null, style]}
    />
  );
}

export interface HeadingProps extends TextProps {
  level: 1 | 2 | 3;
}

export function Heading({level, ...rest}: HeadingProps) {
  return <Text {...headingProps(level)} {...rest}/>;
}
