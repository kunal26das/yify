import type {ReactNode} from 'react';
import {useEffect, useState} from 'react';
import type {LayoutChangeEvent} from 'react-native';
import {AccessibilityInfo, StyleSheet, View} from 'react-native';
import Animated, {useAnimatedStyle, useReducedMotion, useSharedValue, withTiming} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Store} from '@/core/store/createStore';
import {createStore, useStore} from '@/core/store/createStore';
import {BACK_ONLINE_MESSAGE, subscribeBackOnline} from '../connectivity';
import {IS_WEB} from '../environment';
import {useWindowClass} from '../layout/useWindowClass';
import {setOverlayHeight} from '../overlayInset';
import {usePlayerOpen} from '../overlays';
import {elevation} from '../theme/elevation';
import {timing} from '../theme/motion';
import {useTheme} from '../theme/useTheme';
import {Text} from './Text';
import {Touchable} from './Touchable';

export interface SnackbarRequest {
  message: string;
  action?: {label: string; onPress: () => void};
  tone?: 'neutral' | 'error';
  duration?: 'short' | 'long' | 'indefinite';
  key?: string;
}

export interface SnackbarEntry extends SnackbarRequest {
  id: number;
}

interface SnackbarState {
  current: SnackbarEntry | null;
  pending: SnackbarEntry | null;
  playerOpen: boolean;
}

export const SNACKBAR_MS = {short: 4000, long: 8000, screenReader: 12000} as const;
export const UNDO_LABEL = 'Undo';

const EMPTY: SnackbarState = {current: null, pending: null, playerOpen: false};
const OVERLAY_SOURCE = 'snackbar';
const GAP_ABOVE_BAR = 8;
const COMPACT_MAX_WIDTH = 560;
const WIDE_MAX_WIDTH = 480;
const ACTION_HIT_SLOP = {top: 4, bottom: 4};

let nextId = 1;

export const snackbarStore: Store<SnackbarState> = createStore<SnackbarState>({load: () => EMPTY, serverState: EMPTY});

export function snackbarDuration(entry: SnackbarRequest, screenReader: boolean): number | null {
  const duration = entry.duration ?? (entry.action ? 'long' : 'short');
  if (duration === 'indefinite') return null;
  return screenReader ? SNACKBAR_MS.screenReader : SNACKBAR_MS[duration];
}

export function snackbarAnnouncement(entry: SnackbarRequest): string {
  return entry.action ? `${entry.message}, ${entry.action.label} available` : entry.message;
}

export function showSnackbar(request: SnackbarRequest): void {
  const entry: SnackbarEntry = {...request, id: nextId};
  nextId += 1;
  snackbarStore.set((state) => (state.playerOpen ? {...state, pending: entry} : {...state, current: entry}));
}

export function dismissSnackbar(key?: string): void {
  snackbarStore.set((state) => {
    const matches = (entry: SnackbarEntry | null) => entry !== null && (key === undefined || entry.key === key);
    if (!matches(state.current) && !matches(state.pending)) return state;
    return {
      ...state,
      current: matches(state.current) ? null : state.current,
      pending: matches(state.pending) ? null : state.pending,
    };
  });
}

function dismissEntry(id: number): void {
  snackbarStore.set((state) => (state.current?.id === id ? {...state, current: null} : state));
}

export function setSnackbarPlayerOpen(open: boolean): void {
  snackbarStore.set((state) => {
    if (state.playerOpen === open) return state;
    if (open) return {...state, playerOpen: true};
    return {playerOpen: false, current: state.pending ?? state.current, pending: null};
  });
}

export function useSnackbar(): {show(request: SnackbarRequest): void; dismiss(key?: string): void} {
  return {show: showSnackbar, dismiss: dismissSnackbar};
}

export function useUndoSnackbar(): (message: string, undo: () => void) => void {
  return (message, undo) => showSnackbar({message, action: {label: UNDO_LABEL, onPress: undo}, duration: 'long'});
}

function selectCurrent(state: SnackbarState): SnackbarEntry | null {
  return state.playerOpen ? null : state.current;
}

function useScreenReader(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (active) setEnabled(value);
    }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return enabled;
}

function Snackbar({entry, leaving, screenReader}: {entry: SnackbarEntry; leaving: boolean; screenReader: boolean}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const windowClass = useWindowClass() ?? 'compact';
  const insets = useSafeAreaInsets();
  const [paused, setPaused] = useState(false);
  const opacity = useSharedValue(0);
  const duration = snackbarDuration(entry, screenReader);

  useEffect(() => {
    if (leaving) opacity.set(withTiming(0, timing('short3', 'standardAccelerate', reduceMotion)));
    else opacity.set(withTiming(1, timing('short4', 'standardDecelerate', reduceMotion)));
  }, [leaving, opacity, reduceMotion]);

  useEffect(() => {
    if (!IS_WEB) AccessibilityInfo.announceForAccessibility(snackbarAnnouncement(entry));
  }, [entry]);

  useEffect(() => {
    if (leaving || paused || duration === null) return undefined;
    const timer = setTimeout(() => dismissEntry(entry.id), duration);
    return () => clearTimeout(timer);
  }, [entry, leaving, paused, duration]);

  useEffect(() => () => setOverlayHeight(OVERLAY_SOURCE, null), []);

  const compact = windowClass === 'compact';
  const bottom = compact
    ? theme.layout.navigationBarHeight + insets.bottom + GAP_ABOVE_BAR
    : insets.bottom + theme.space.xl;
  const left = compact ? theme.space.lg : (IS_WEB && windowClass === 'expanded' ? 0 : theme.layout.navigationRailWidth) + theme.space.xl;
  const fade = useAnimatedStyle(() => ({opacity: opacity.get()}));
  const onLayout = (event: LayoutChangeEvent) => setOverlayHeight(OVERLAY_SOURCE, event.nativeEvent.layout.height + bottom);
  const pause = {
    onFocus: () => setPaused(true),
    onBlur: () => setPaused(false),
    onPointerEnter: () => setPaused(true),
    onPointerLeave: () => setPaused(false),
  };

  return (
    <View style={[styles.anchor, {bottom, left, right: compact ? theme.space.lg : undefined, alignItems: compact ? 'center' : 'flex-start', pointerEvents: 'box-none'}]}>
      <Animated.View
        {...pause}
        onLayout={onLayout}
        style={[
          styles.snackbar,
          elevation.level2,
          {
            maxWidth: compact ? COMPACT_MAX_WIDTH : WIDE_MAX_WIDTH,
            width: compact ? '100%' : undefined,
            backgroundColor: theme.colors.inverseSurface,
            borderRadius: theme.shape.extraSmall,
            paddingLeft: theme.space.lg,
            paddingRight: entry.action ? theme.space.sm : theme.space.lg,
            paddingVertical: theme.space.xs,
            columnGap: theme.space.sm,
          },
          fade,
        ]}
      >
        <View style={[styles.message, {paddingVertical: theme.space.sm}]}>
          <Text variant="bodyMedium" color="inverseOnSurface" numberOfLines={2}>{entry.message}</Text>
        </View>
        {entry.action ? (
          <Touchable
            onPress={() => {
              const action = entry.action;
              dismissEntry(entry.id);
              action?.onPress();
            }}
            contentColor="inversePrimary"
            shape="full"
            hitSlop={ACTION_HIT_SLOP}
            style={[styles.action, {paddingHorizontal: theme.space.md, minHeight: theme.layout.minTouchTarget - ACTION_HIT_SLOP.top - ACTION_HIT_SLOP.bottom}]}
          >
            <Text variant="labelLarge" color="inversePrimary">{entry.action.label}</Text>
          </Touchable>
        ) : null}
      </Animated.View>
    </View>
  );
}

function LiveRegion({role, entry}: {role: 'status' | 'alert'; entry: SnackbarEntry | null}) {
  return (
    <View role={role} aria-live={role === 'alert' ? 'assertive' : 'polite'} dataSet={{srOnly: ''}} style={styles.srOnly}>
      {entry ? <Text key={entry.id} variant="bodySmall">{snackbarAnnouncement(entry)}</Text> : null}
    </View>
  );
}

export function SnackbarHost({children}: {children: ReactNode}) {
  const playerOpen = usePlayerOpen();
  const current = useStore(snackbarStore, selectCurrent);
  const reduceMotion = useReducedMotion();
  const screenReader = useScreenReader();
  const [shown, setShown] = useState<SnackbarEntry | null>(current);

  if (current !== null && current !== shown) setShown(current);
  const leaving = current === null && shown !== null;

  useEffect(() => {
    setSnackbarPlayerOpen(playerOpen);
  }, [playerOpen]);

  useEffect(() => subscribeBackOnline(() => showSnackbar({message: BACK_ONLINE_MESSAGE, duration: 'short', key: 'connectivity'})), []);

  useEffect(() => {
    if (!leaving) return undefined;
    const timer = setTimeout(() => {
      setShown(null);
      setOverlayHeight(OVERLAY_SOURCE, null);
    }, timing('short3', 'standardAccelerate', reduceMotion).duration);
    return () => clearTimeout(timer);
  }, [leaving, reduceMotion]);

  const error = current?.tone === 'error';
  return (
    <>
      {children}
      {IS_WEB ? <LiveRegion role="status" entry={error ? null : current}/> : null}
      {IS_WEB ? <LiveRegion role="alert" entry={error ? current : null}/> : null}
      {shown === null ? null : <Snackbar key={shown.id} entry={shown} leaving={leaving} screenReader={screenReader}/>}
    </>
  );
}

const styles = StyleSheet.create({
  anchor: {position: 'absolute', zIndex: 30},
  snackbar: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end'},
  message: {flexGrow: 1, flexShrink: 1, flexBasis: 200},
  action: {alignItems: 'center', justifyContent: 'center'},
  srOnly: {position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0},
});
