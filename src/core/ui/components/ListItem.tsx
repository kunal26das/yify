import type {ReactNode} from 'react';
import {StyleSheet, View} from 'react-native';
import type {IconName} from '../icons/glyphs';
import {stateLayer} from '../theme/tokens';
import {useTheme} from '../theme/useTheme';
import {Artwork} from './Artwork';
import {Avatar} from './Avatar';
import {Icon} from './Icon';
import {IconButton} from './IconButton';
import {Text} from './Text';
import {Touchable} from './Touchable';

export type ListLeading =
  | {kind: 'icon'; icon: IconName}
  | {kind: 'avatar'; name: string; photoUrl?: string | null}
  | {kind: 'artwork'; artworkKind: 'poster' | 'profile' | 'still' | 'logo'; path: string | null; alt: string}
  | {kind: 'none'};

export type ListTrailing =
  | {kind: 'chevron'}
  | {kind: 'text'; text: string}
  | {kind: 'switch'; value: boolean; onValueChange: (value: boolean) => void}
  | {kind: 'check'; checked: boolean}
  | {kind: 'iconButton'; icon: IconName; label: string; onPress: () => void}
  | {kind: 'none'};

export interface ListItemProps {
  headline: string;
  supporting?: string;
  overline?: string;
  leading?: ListLeading;
  trailing?: ListTrailing;
  onPress?: () => void;
  href?: string;
  destructive?: boolean;
  disabled?: boolean;
}

const MIN_HEIGHT = {1: 56, 2: 72, 3: 88} as const;
const SWITCH = {width: 52, height: 32, thumbOn: 24, thumbOff: 16};
const CHECKBOX = 18;
const THUMBNAIL = 40;

export function listItemMinHeight(props: Pick<ListItemProps, 'supporting' | 'overline'>): number {
  const lines = 1 + (props.supporting ? 1 : 0) + (props.overline ? 1 : 0);
  return MIN_HEIGHT[lines as 1 | 2 | 3];
}

function SwitchVisual({value}: {value: boolean}) {
  const theme = useTheme();
  const thumb = value ? SWITCH.thumbOn : SWITCH.thumbOff;
  return (
    <View
      aria-hidden
      style={[
        styles.switchTrack,
        {
          width: SWITCH.width,
          height: SWITCH.height,
          borderRadius: theme.shape.full,
          backgroundColor: value ? theme.colors.primary : theme.colors.surfaceContainerHighest,
          borderColor: value ? theme.colors.primary : theme.colors.outline,
          justifyContent: value ? 'flex-end' : 'flex-start',
          paddingHorizontal: value ? 3 : 6,
        },
      ]}
    >
      <View style={{width: thumb, height: thumb, borderRadius: theme.shape.full, backgroundColor: value ? theme.colors.onPrimary : theme.colors.outline}}/>
    </View>
  );
}

function CheckVisual({checked}: {checked: boolean}) {
  const theme = useTheme();
  return (
    <View
      aria-hidden
      style={[
        styles.check,
        {
          width: CHECKBOX,
          height: CHECKBOX,
          borderRadius: theme.shape.extraSmall / 2,
          borderWidth: checked ? 0 : 2,
          borderColor: theme.colors.onSurfaceVariant,
          backgroundColor: checked ? theme.colors.primary : undefined,
        },
      ]}
    >
      {checked ? <Icon name="check" size={18} color="onPrimary"/> : null}
    </View>
  );
}

function Leading({leading}: {leading: ListLeading}) {
  if (leading.kind === 'icon') return <Icon name={leading.icon} size={24} color="onSurfaceVariant"/>;
  if (leading.kind === 'avatar') return <Avatar name={leading.name} photoUrl={leading.photoUrl} size={40} decorative/>;
  if (leading.kind === 'artwork') {
    return (
      <Artwork
        kind={leading.artworkKind}
        path={leading.path}
        size={leading.artworkKind === 'logo' ? 'w92' : 'w154'}
        width={THUMBNAIL}
        alt={leading.alt}
        decorative
        rounded={leading.artworkKind === 'profile' ? 'full' : 'small'}
      />
    );
  }
  return null;
}

function TrailingVisual({trailing}: {trailing: ListTrailing}) {
  if (trailing.kind === 'chevron') return <Icon name="chevron_right" size={24} color="onSurfaceVariant"/>;
  if (trailing.kind === 'text') return <Text variant="labelLarge" color="onSurfaceVariant">{trailing.text}</Text>;
  if (trailing.kind === 'switch') return <SwitchVisual value={trailing.value}/>;
  if (trailing.kind === 'check') return <CheckVisual checked={trailing.checked}/>;
  return null;
}

export function ListItem({headline, supporting, overline, leading = {kind: 'none'}, trailing = {kind: 'none'}, onPress, href, destructive = false, disabled = false}: ListItemProps) {
  const theme = useTheme();
  const minHeight = listItemMinHeight({supporting, overline});
  const toggle = trailing.kind === 'switch'
    ? {role: 'switch' as const, 'aria-checked': trailing.value}
    : trailing.kind === 'check'
      ? {role: 'checkbox' as const, 'aria-checked': trailing.checked}
      : null;
  const press = trailing.kind === 'switch' ? () => trailing.onValueChange(!trailing.value) : onPress;
  const interactive = press !== undefined || href !== undefined;

  const body: ReactNode = (
    <>
      {leading.kind === 'none' ? null : <Leading leading={leading}/>}
      <View style={styles.texts}>
        {overline ? <Text variant="labelMedium" color="onSurfaceVariant" numberOfLines={1}>{overline}</Text> : null}
        <Text variant="bodyLarge" color={destructive ? 'error' : 'onSurface'}>{headline}</Text>
        {supporting ? <Text variant="bodyMedium" color="onSurfaceVariant">{supporting}</Text> : null}
      </View>
      <TrailingVisual trailing={trailing}/>
    </>
  );
  const rowStyle = [
    styles.row,
    {minHeight, gap: theme.space.lg, paddingLeft: theme.space.lg, paddingRight: trailing.kind === 'iconButton' ? theme.space.xs : theme.space.xl, paddingVertical: theme.space.sm},
  ];
  const content = interactive ? (
    <Touchable
      {...toggle}
      onPress={press}
      href={href}
      disabled={disabled}
      contentColor={destructive ? 'error' : 'onSurface'}
      style={[rowStyle, styles.grow, {opacity: disabled ? stateLayer.disabledContent : 1}]}
    >
      {body}
    </Touchable>
  ) : (
    <View style={[rowStyle, styles.grow, {opacity: disabled ? stateLayer.disabledContent : 1}]}>{body}</View>
  );

  if (trailing.kind !== 'iconButton') return content;
  return (
    <View style={[styles.row, {paddingRight: theme.space.xs}]}>
      {content}
      <IconButton icon={trailing.icon} label={trailing.label} onPress={trailing.onPress} disabled={disabled}/>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center'},
  grow: {flex: 1},
  texts: {flex: 1, minWidth: 0},
  switchTrack: {flexDirection: 'row', alignItems: 'center', borderWidth: 2},
  check: {alignItems: 'center', justifyContent: 'center', overflow: 'hidden'},
});
