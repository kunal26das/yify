import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {toggleProps} from '../a11y';
import {IS_WEB} from '../environment';
import type {IconName} from '../icons/glyphs';
import type {ColorRoles} from '../theme/tokens';
import {stateLayer} from '../theme/tokens';
import {useTheme} from '../theme/useTheme';
import {Icon} from './Icon';
import {Text} from './Text';
import {Touchable} from './Touchable';

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'destructive';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  href?: string;
  variant?: ButtonVariant;
  size?: 'medium' | 'large';
  icon?: IconName;
  iconFilled?: boolean;
  trailingIcon?: IconName;
  pressed?: boolean;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

interface VariantColors {
  container: keyof ColorRoles | null;
  content: keyof ColorRoles;
  border: keyof ColorRoles | null;
}

export const BUTTON_COLORS: Readonly<Record<ButtonVariant, VariantColors>> = {
  filled: {container: 'primary', content: 'onPrimary', border: null},
  tonal: {container: 'secondaryContainer', content: 'onSecondaryContainer', border: null},
  outlined: {container: null, content: 'primary', border: 'outline'},
  text: {container: null, content: 'primary', border: null},
  destructive: {container: 'error', content: 'onError', border: null},
};

const HEIGHT = {medium: 40, large: 48} as const;
const PADDING = 24;
const ICON_SIDE_PADDING = 16;
const TEXT_PADDING = 12;
const ANDROID_HIT_SLOP = {top: 4, bottom: 4};

export function Button({
  label,
  onPress,
  href,
  variant = 'filled',
  size = 'medium',
  icon,
  iconFilled = false,
  trailingIcon,
  pressed,
  loading = false,
  disabled = false,
  fullWidth = false,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const colors = BUTTON_COLORS[variant];
  const toggle = pressed === undefined ? {} : toggleProps(pressed);
  const hasLeading = icon !== undefined || loading;
  const horizontal = variant === 'text' ? TEXT_PADDING : PADDING;
  const content = disabled ? 'onSurface' : colors.content;

  return (
    <Touchable
      {...toggle}
      onPress={onPress}
      href={href}
      disabled={disabled || loading}
      aria-label={accessibilityLabel}
      aria-busy={loading || undefined}
      testID={testID}
      contentColor={colors.content}
      shape="full"
      hitSlop={size === 'medium' && !IS_WEB ? ANDROID_HIT_SLOP : undefined}
      style={[
        styles.button,
        {
          minHeight: HEIGHT[size],
          paddingLeft: hasLeading && variant !== 'text' ? ICON_SIDE_PADDING : horizontal,
          paddingRight: trailingIcon && variant !== 'text' ? ICON_SIDE_PADDING : horizontal,
          gap: theme.space.sm,
          backgroundColor: colors.container && !disabled ? theme.colors[colors.container] : undefined,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
      ]}
    >
      {disabled && colors.container ? (
        <View style={[StyleSheet.absoluteFill, styles.passThrough, {borderRadius: theme.shape.full, backgroundColor: theme.colors.onSurface, opacity: stateLayer.disabledContainer}]}/>
      ) : null}
      {colors.border ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.passThrough,
            styles.border,
            {
              borderRadius: theme.shape.full,
              borderColor: disabled ? theme.colors.onSurface : theme.colors[colors.border],
              opacity: disabled ? stateLayer.disabledContainer : 1,
            },
          ]}
        />
      ) : null}
      <View style={[styles.content, {gap: theme.space.sm, opacity: disabled ? stateLayer.disabledContent : 1}]}>
        {loading ? (
          <ActivityIndicator size={18} color={theme.colors[content]}/>
        ) : icon ? (
          <Icon name={icon} size={18} filled={iconFilled || pressed === true} color={content}/>
        ) : null}
        <Text variant="labelLarge" color={content} align="center">{label}</Text>
        {trailingIcon ? <Icon name={trailingIcon} size={18} color={content}/> : null}
      </View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  button: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
  content: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexShrink: 1},
  border: {borderWidth: 1},
  passThrough: {pointerEvents: 'none'},
});
