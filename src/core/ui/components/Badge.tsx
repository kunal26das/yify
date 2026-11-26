import {StyleSheet, View} from 'react-native';
import type {IconName} from '../icons/glyphs';
import type {ColorRoles} from '../theme/tokens';
import {useTheme} from '../theme/useTheme';
import {Icon} from './Icon';
import {Text} from './Text';

export interface BadgeProps {
  size: 'dot' | 'small' | 'large';
  tone?: 'neutral' | 'primary' | 'error' | 'plus';
  label?: string;
  icon?: IconName;
}

export const PLUS_BADGE_LABEL = 'Plus';

const TONES: Readonly<Record<NonNullable<BadgeProps['tone']>, {container: keyof ColorRoles; content: keyof ColorRoles}>> = {
  neutral: {container: 'secondaryContainer', content: 'onSecondaryContainer'},
  primary: {container: 'primaryContainer', content: 'onPrimaryContainer'},
  error: {container: 'error', content: 'onError'},
  plus: {container: 'primaryContainer', content: 'onPrimaryContainer'},
};

const DOT = 6;
const SMALL = 16;
const LARGE = 20;

export function Badge({size, tone = 'neutral', label, icon}: BadgeProps) {
  const theme = useTheme();
  if (size === 'dot') {
    return <View aria-hidden style={{width: DOT, height: DOT, borderRadius: theme.shape.full, backgroundColor: theme.colors.error}}/>;
  }
  const colors = TONES[tone];
  const glyph = tone === 'plus' ? 'workspace_premium' : icon;
  const text = tone === 'plus' ? label ?? PLUS_BADGE_LABEL : label;
  return (
    <View
      aria-hidden
      style={[
        styles.badge,
        {
          minHeight: size === 'small' ? SMALL : LARGE,
          paddingHorizontal: size === 'small' ? theme.space.xs : theme.space.sm,
          gap: theme.space.xxs,
          borderRadius: theme.shape.extraSmall,
          backgroundColor: theme.colors[colors.container],
        },
      ]}
    >
      {size === 'large' && glyph ? <Icon name={glyph} size={18} color={colors.content} filled/> : null}
      {text ? <Text variant="labelSmall" color={colors.content} maxFontSizeMultiplier={1.3} numberOfLines={1}>{text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start'},
});
