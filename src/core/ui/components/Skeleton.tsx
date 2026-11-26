import {useEffect} from 'react';
import type {DimensionValue} from 'react-native';
import {StyleSheet, View} from 'react-native';
import Animated, {cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming} from 'react-native-reanimated';
import {IS_WEB} from '../environment';
import type {Tokens} from '../theme/tokens';
import {useTheme} from '../theme/useTheme';

export interface SkeletonProps {
  shape: 'rect' | 'circle' | 'text';
  width: number | string;
  height?: number;
  lines?: number;
  radius?: keyof Tokens['shape'];
  aspectRatio?: number;
}

const PULSE_MS = 1200;
const PULSE_FLOOR = 0.55;
const TEXT_LINE = 12;
const LAST_LINE = '60%';

function defaultRadius(shape: SkeletonProps['shape']): keyof Tokens['shape'] {
  if (shape === 'circle') return 'full';
  if (shape === 'text') return 'extraSmall';
  return 'medium';
}

export function Skeleton({shape, width, height, lines = 1, radius, aspectRatio}: SkeletonProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  const animate = !IS_WEB && !reduceMotion;

  useEffect(() => {
    if (!animate) return undefined;
    pulse.set(withRepeat(withTiming(PULSE_FLOOR, {duration: PULSE_MS / 2, easing: Easing.inOut(Easing.ease)}), -1, true));
    return () => cancelAnimation(pulse);
  }, [animate, pulse]);

  const animated = useAnimatedStyle(() => ({opacity: pulse.get()}));
  const corner = theme.shape[radius ?? defaultRadius(shape)];
  const fill = {backgroundColor: theme.colors.surfaceContainerHigh, borderRadius: corner};
  const boxes = shape === 'text'
    ? Array.from({length: Math.max(1, lines)}, (_, index) => ({key: index, width: (index === lines - 1 && lines > 1 ? LAST_LINE : '100%') as DimensionValue, height: height ?? TEXT_LINE}))
    : [{key: 0, width: '100%' as DimensionValue, height: shape === 'circle' || aspectRatio !== undefined ? undefined : height ?? TEXT_LINE}];
  const ratio = shape === 'circle' ? 1 : shape === 'rect' ? aspectRatio : undefined;
  const box = {width: width as DimensionValue, aspectRatio: ratio, gap: theme.space.sm};
  const children = boxes.map((line) => (
    <View key={line.key} style={[fill, {width: line.width, height: line.height}, ratio !== undefined ? styles.fill : null]}/>
  ));

  if (!animate) {
    return <View aria-hidden dataSet={{skeleton: ''}} style={box}>{children}</View>;
  }
  return <Animated.View aria-hidden style={[box, animated]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({fill: {flex: 1}});
