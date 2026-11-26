import {StyleSheet, View} from 'react-native';
import {toggleProps} from '../a11y';
import type {IconName} from '../icons/glyphs';
import type {ColorRoles} from '../theme/tokens';
import {stateLayer} from '../theme/tokens';
import {useTheme} from '../theme/useTheme';
import {Icon} from './Icon';
import {Touchable} from './Touchable';

export type IconButtonVariant = 'standard' | 'filled' | 'tonal' | 'outlined' | 'media';

export interface IconButtonProps {
  icon: IconName;
  label: string;
  onPress?: () => void;
  href?: string;
  variant?: IconButtonVariant;
  selected?: boolean;
  disabled?: boolean;
}

interface Palette {
  container: keyof ColorRoles | null;
  content: keyof ColorRoles;
  border: keyof ColorRoles | null;
}

const PALETTES: Readonly<Record<IconButtonVariant, Palette>> = {
  standard: {container: null, content: 'onSurfaceVariant', border: null},
  filled: {container: 'primary', content: 'onPrimary', border: null},
  tonal: {container: 'secondaryContainer', content: 'onSecondaryContainer', border: null},
  outlined: {container: null, content: 'onSurfaceVariant', border: 'outline'},
  media: {container: 'mediaScrim', content: 'onMedia', border: null},
};

const SELECTED: Readonly<Partial<Record<IconButtonVariant, Palette>>> = {
  standard: {container: null, content: 'primary', border: null},
  outlined: {container: 'inverseSurface', content: 'inverseOnSurface', border: null},
};

const SIZE = 40;
const HIT_SLOP = 4;

export function IconButton({icon, label, onPress, href, variant = 'standard', selected, disabled = false}: IconButtonProps) {
  const theme = useTheme();
  const palette = (selected ? SELECTED[variant] : undefined) ?? PALETTES[variant];
  const toggle = selected === undefined ? {} : toggleProps(selected);
  return (
    <Touchable
      {...toggle}
      onPress={onPress}
      href={href}
      disabled={disabled}
      aria-label={label}
      contentColor={palette.content}
      shape="full"
      ripple="bounded"
      hitSlop={HIT_SLOP}
      style={[
        styles.button,
        {
          width: SIZE,
          height: SIZE,
          backgroundColor: palette.container ? theme.colors[palette.container] : undefined,
          borderWidth: palette.border ? 1 : 0,
          borderColor: palette.border ? theme.colors[palette.border] : undefined,
        },
      ]}
    >
      <View style={{opacity: disabled ? stateLayer.disabledContent : 1}}>
        <Icon name={icon} size={24} filled={selected === true} color={disabled ? 'onSurface' : palette.content}/>
      </View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  button: {alignItems: 'center', justifyContent: 'center'},
});
