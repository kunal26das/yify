import {useRef} from 'react';
import type {HostInstance, ViewProps} from 'react-native';
import {StyleSheet, View} from 'react-native';
import {IS_WEB} from '../environment';
import type {IconName} from '../icons/glyphs';
import {useTheme} from '../theme/useTheme';
import {Icon} from './Icon';
import {Text} from './Text';
import {Touchable} from './Touchable';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

export interface SegmentedButtonProps<T extends string> {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

interface KeyboardLike {
  key?: string;
  preventDefault?: () => void;
}

const HEIGHT = 40;
const HIT_SLOP = {top: 4, bottom: 4};

export function nextSegmentIndex(key: string, index: number, count: number): number | null {
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

export function SegmentedButton<T extends string>({value, options, onChange, accessibilityLabel}: SegmentedButtonProps<T>) {
  const theme = useTheme();
  const segments = useRef<(HostInstance | null)[]>([]);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

  const onKeyDown = (event: unknown) => {
    const keyboardEvent = event as KeyboardLike;
    const next = nextSegmentIndex(keyboardEvent.key ?? '', selectedIndex, options.length);
    if (next === null) return;
    keyboardEvent.preventDefault?.();
    onChange(options[next].value);
    segments.current[next]?.focus();
  };
  const keyboard = (IS_WEB ? {onKeyDown} : {}) as Pick<ViewProps, 'onKeyDown'>;

  return (
    <View
      role="radiogroup"
      aria-label={accessibilityLabel}
      {...keyboard}
      style={[styles.group, {borderRadius: theme.shape.full, borderColor: theme.colors.outline}]}
    >
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        const content = selected ? 'onSecondaryContainer' : 'onSurface';
        return (
          <Touchable
            key={option.value}
            ref={(node: HostInstance | null) => {
              segments.current[index] = node;
            }}
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            tabIndex={IS_WEB ? (selected ? 0 : -1) : undefined}
            onPress={() => {
              if (!selected) onChange(option.value);
            }}
            contentColor={content}
            hitSlop={HIT_SLOP}
            style={[
              styles.segment,
              {
                minHeight: HEIGHT,
                gap: theme.space.sm,
                paddingHorizontal: theme.space.md,
                backgroundColor: selected ? theme.colors.secondaryContainer : undefined,
                borderLeftWidth: index === 0 ? 0 : 1,
                borderColor: theme.colors.outline,
              },
            ]}
          >
            {selected ? <Icon name="check" size={18} color={content}/> : option.icon ? <Icon name={option.icon} size={18} color={content}/> : null}
            <Text variant="labelLarge" color={content} numberOfLines={1}>{option.label}</Text>
          </Touchable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {flexDirection: 'row', borderWidth: 1, overflow: 'hidden', alignSelf: 'stretch'},
  segment: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
});
