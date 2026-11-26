import {useCanGoBack, useRouter, useSegments} from 'expo-router';
import type {ReactNode} from 'react';
import {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import type {SharedValue} from 'react-native-reanimated';
import Animated, {interpolate, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {scheduleOnRN} from 'react-native-worklets';
import {APP_NAME} from '@/core/config/app';
import type {IconName} from '../icons/glyphs';
import {destinationForSegments} from '../navigation/destinations';
import {timing} from '../theme/motion';
import {useTheme} from '../theme/useTheme';
import {ActionSheet} from './ActionSheet';
import {IconButton} from './IconButton';
import {Heading, Text} from './Text';

export interface TopAppBarAction {
  icon: IconName;
  label: string;
  onPress: () => void;
  selected?: boolean;
}

export interface TopAppBarOverflowAction {
  icon: IconName;
  label: string;
  onPress: () => void;
}

export interface TopAppBarProps {
  variant: 'small' | 'overlay' | 'search';
  title?: string;
  wordmark?: boolean;
  back?: boolean;
  actions?: readonly TopAppBarAction[];
  overflow?: readonly TopAppBarOverflowAction[];
  search?: ReactNode;
  scrollY?: SharedValue<number>;
  revealAfter?: number;
}

export const BACK_LABEL = 'Navigate up';
export const MORE_LABEL = 'More options';
export const SCROLLED_AFTER = 4;
const MAX_ACTIONS = 2;

function useScrolled(scrollY: SharedValue<number> | undefined, threshold: number): boolean {
  const fallback = useSharedValue(0);
  const source = scrollY ?? fallback;
  const [past, setPast] = useState(false);
  useAnimatedReaction(
    () => source.get() > threshold,
    (now, previous) => {
      if (now !== previous) scheduleOnRN(setPast, now);
    },
    [threshold],
  );
  return past;
}

export function TopAppBar({variant, title, wordmark = false, back = false, actions = [], overflow = [], search, scrollY, revealAfter = 0}: TopAppBarProps) {
  const theme = useTheme();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const overlay = variant === 'overlay';
  const solid = useScrolled(scrollY, overlay ? revealAfter : SCROLLED_AFTER);
  const tone = useSharedValue(0);
  useEffect(() => {
    tone.set(withTiming(solid ? 1 : 0, timing('short3', 'standard', reduceMotion)));
  }, [solid, tone, reduceMotion]);

  const surfaceStyle = useAnimatedStyle(() => ({opacity: interpolate(tone.get(), [0, 1], [0, 1])}));
  const goBack = () => {
    if (canGoBack) router.back();
    else router.replace(destinationForSegments(segments).href);
  };
  const iconVariant = overlay && !solid ? 'media' : 'standard';
  const visibleActions = actions.slice(0, MAX_ACTIONS);
  const label = wordmark ? APP_NAME : title;

  let middle: ReactNode = null;
  if (variant === 'search') {
    middle = <View style={styles.grow}>{search}</View>;
  } else if (overlay) {
    middle = solid && title ? (
      <View style={styles.grow} aria-hidden>
        <Text variant="titleLarge" numberOfLines={1}>{title}</Text>
      </View>
    ) : <View style={styles.grow}/>;
  } else if (label) {
    middle = (
      <View style={styles.grow}>
        <Heading level={1} variant={wordmark ? 'headlineSmall' : 'titleLarge'} numberOfLines={2} aria-label={label}>{label}</Heading>
      </View>
    );
  }

  return (
    <View style={[styles.bar, {paddingTop: insets.top, backgroundColor: overlay ? undefined : theme.colors.surface}]}>
      {overlay ? <View style={[styles.statusBand, {height: insets.top, backgroundColor: theme.colors.surface}]}/> : null}
      <Animated.View style={[StyleSheet.absoluteFill, {top: overlay ? insets.top : 0, backgroundColor: theme.colors.surfaceContainer}, styles.passThrough, surfaceStyle]}/>
      <View style={[styles.row, {minHeight: theme.layout.topAppBarHeight, gap: theme.space.xs, paddingHorizontal: theme.space.xs}]}>
        {back ? <IconButton icon="arrow_back" label={BACK_LABEL} variant={iconVariant} onPress={goBack}/> : <View style={{width: theme.space.md}}/>}
        {middle}
        {visibleActions.map((action) => (
          <IconButton key={action.label} icon={action.icon} label={action.label} variant={iconVariant} selected={action.selected} onPress={action.onPress}/>
        ))}
        {overflow.length > 0 ? <IconButton icon="more_vert" label={MORE_LABEL} variant={iconVariant} onPress={() => setMenuOpen(true)}/> : null}
      </View>
      {overflow.length > 0 ? (
        <ActionSheet open={menuOpen} onClose={() => setMenuOpen(false)} title={title ?? MORE_LABEL} actions={overflow}/>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {position: 'relative', zIndex: 10},
  statusBand: {position: 'absolute', left: 0, right: 0, top: 0},
  passThrough: {pointerEvents: 'none'},
  row: {flexDirection: 'row', alignItems: 'center'},
  grow: {flex: 1, minWidth: 0, paddingHorizontal: 4},
});
