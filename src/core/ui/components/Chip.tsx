import {StyleSheet, View} from 'react-native';
import {popupProps} from '../a11y';
import type {IconName} from '../icons/glyphs';
import {stateLayer} from '../theme/tokens';
import {useTheme} from '../theme/useTheme';
import {Icon} from './Icon';
import {Text} from './Text';
import {Touchable} from './Touchable';

export type ChipKind = 'assist' | 'filter' | 'dropdown' | 'input';

export interface ChipProps {
  kind: ChipKind;
  label: string;
  selected?: boolean;
  value?: string | null;
  icon?: IconName;
  expanded?: boolean;
  onPress?: () => void;
  href?: string;
  onRemove?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

const HEIGHT = 32;
const HIT_SLOP = {top: 8, bottom: 8};
const REMOVE_SIZE = 32;
const REMOVE_SLOP = 8;
const REMOVE_HIT_SLOP = {top: REMOVE_SLOP, bottom: REMOVE_SLOP, left: REMOVE_SLOP, right: REMOVE_SLOP};

export function chipName(props: Pick<ChipProps, 'kind' | 'label' | 'value' | 'accessibilityLabel'>): string {
  if (props.accessibilityLabel) return props.accessibilityLabel;
  if (props.kind === 'dropdown') return `${props.label}: ${props.value ?? 'any'}`;
  return props.label;
}

export function Chip(props: ChipProps) {
  const {kind, label, selected = false, value = null, icon, expanded = false, onPress, href, onRemove, disabled = false} = props;
  const theme = useTheme();
  const active = kind === 'input' || (kind === 'filter' && selected) || (kind === 'dropdown' && value !== null);
  const content = active ? 'onSecondaryContainer' : 'onSurfaceVariant';
  const leading: IconName | undefined = kind === 'filter' && selected ? 'check' : icon;
  const text = kind === 'dropdown' && value !== null ? value : label;
  const semantics = kind === 'filter'
    ? {role: 'checkbox' as const, 'aria-checked': selected}
    : kind === 'dropdown'
      ? {role: 'button' as const, ...popupProps(expanded)}
      : {role: href !== undefined && kind === 'assist' ? ('link' as const) : ('button' as const)};
  const frame = {
    minHeight: HEIGHT,
    borderRadius: theme.shape.small,
    backgroundColor: active ? theme.colors.secondaryContainer : undefined,
    borderColor: theme.colors.outline,
    borderWidth: active ? 0 : 1,
  };

  const body = (
    <View style={[styles.content, {opacity: disabled ? stateLayer.disabledContent : 1, gap: theme.space.sm}]}>
      {leading ? <Icon name={leading} size={18} color={content}/> : null}
      <Text variant="labelLarge" color={content} numberOfLines={1}>{text}</Text>
      {kind === 'dropdown' ? <Icon name="arrow_drop_down" size={18} color={content}/> : null}
    </View>
  );

  if (kind === 'input') {
    return (
      <View style={[styles.chip, frame]}>
        <Touchable
          {...semantics}
          onPress={onPress}
          href={href}
          disabled={disabled}
          aria-label={chipName(props)}
          contentColor={content}
          shape="small"
          hitSlop={HIT_SLOP}
          style={[styles.content, styles.grow, {minHeight: HEIGHT, paddingLeft: leading ? theme.space.md : theme.space.lg}]}
        >
          {body}
        </Touchable>
        <Touchable
          onPress={onRemove}
          disabled={disabled}
          aria-label={`Remove ${label}`}
          contentColor={content}
          shape="full"
          hitSlop={REMOVE_HIT_SLOP}
          style={[styles.remove, {width: REMOVE_SIZE, height: REMOVE_SIZE, marginLeft: REMOVE_SLOP}]}
        >
          <Icon name="close" size={18} color={content}/>
        </Touchable>
      </View>
    );
  }

  return (
    <Touchable
      {...semantics}
      onPress={onPress}
      href={href}
      disabled={disabled}
      aria-label={chipName(props)}
      contentColor={content}
      shape="small"
      hitSlop={HIT_SLOP}
      style={[
        styles.chip,
        frame,
        {
          paddingLeft: leading ? theme.space.md : theme.space.lg,
          paddingRight: kind === 'dropdown' ? theme.space.sm : theme.space.lg,
        },
      ]}
    >
      {body}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  chip: {flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start'},
  content: {flexDirection: 'row', alignItems: 'center'},
  grow: {flexShrink: 1},
  remove: {alignItems: 'center', justifyContent: 'center'},
});
