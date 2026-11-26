import type {ReactNode} from 'react';
import {useEffect, useId, useState} from 'react';
import type {LayoutChangeEvent, ModalProps} from 'react-native';
import {KeyboardAvoidingView, Modal, ScrollView, StyleSheet, useWindowDimensions, View} from 'react-native';
import {GestureDetector, GestureHandlerRootView, usePanGesture} from 'react-native-gesture-handler';
import Animated, {useAnimatedStyle, useReducedMotion, useSharedValue, withTiming} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {IS_WEB} from '../environment';
import {useWindowClass} from '../layout/useWindowClass';
import {elevation} from '../theme/elevation';
import {timing} from '../theme/motion';
import {tokens} from '../theme/tokens';
import {useTheme} from '../theme/useTheme';
import {IconButton} from './IconButton';
import {Scrim} from './Scrim';
import {Heading} from './Text';

export type SheetPresentation = 'auto' | 'sheet' | 'dialog' | 'fullscreen';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  presentation?: SheetPresentation;
  dismissible?: boolean;
  footer?: ReactNode;
  width?: 'standard' | 'wide';
  children: ReactNode;
  testID?: string;
}

export const DIALOG_WIDTH = {standard: 560, wide: 720} as const;
export const SHEET_MAX_HEIGHT = 0.9;
export const DIALOG_MAX_HEIGHT = 0.85;
export const DRAG_DISMISS_FRACTION = 0.25;
export const DRAG_DISMISS_VELOCITY = 800;

const HANDLE_ZONE = 48;
const HANDLE = {width: 32, height: 4};
const HANDLE_OPACITY = 0.4;

export function resolvePresentation(presentation: SheetPresentation, windowClass: string | null): Exclude<SheetPresentation, 'auto'> {
  if (presentation !== 'auto') return presentation;
  return windowClass === null || windowClass === 'compact' ? 'sheet' : 'dialog';
}

export function shouldDismissDrag(translation: number, velocity: number, height: number): boolean {
  return translation > height * DRAG_DISMISS_FRACTION || velocity > DRAG_DISMISS_VELOCITY;
}

export function Sheet({open, onClose, title, presentation = 'auto', dismissible = true, footer, width = 'standard', children, testID}: SheetProps) {
  const theme = useTheme();
  const windowClass = useWindowClass();
  const viewport = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const mode = resolvePresentation(presentation, windowClass);
  const [previousOpen, setPreviousOpen] = useState(open);
  const [exiting, setExiting] = useState(false);
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  const panelHeight = useSharedValue(viewport.height);

  if (previousOpen !== open) {
    setPreviousOpen(open);
    setExiting(!open);
  }

  useEffect(() => {
    if (open) {
      drag.set(0);
      progress.set(withTiming(1, timing('medium2', 'emphasizedDecelerate', reduceMotion)));
      return undefined;
    }
    if (!exiting) return undefined;
    const exit = timing('short4', 'emphasizedAccelerate', reduceMotion);
    progress.set(withTiming(0, exit));
    const timer = setTimeout(() => setExiting(false), exit.duration);
    return () => clearTimeout(timer);
  }, [open, exiting, progress, drag, reduceMotion]);

  const pan = usePanGesture({
    runOnJS: true,
    enabled: dismissible && mode === 'sheet',
    activeOffsetY: [-8, 8],
    onUpdate: (event) => {
      drag.set(Math.max(0, event.translationY));
    },
    onDeactivate: (event) => {
      if (shouldDismissDrag(event.translationY, event.velocityY, panelHeight.get())) onClose();
      else drag.set(withTiming(0, timing('short4', 'standardDecelerate', reduceMotion)));
    },
  });

  const scrimStyle = useAnimatedStyle(() => ({opacity: progress.get()}));
  const panelStyle = useAnimatedStyle(() => {
    if (mode !== 'sheet') return {opacity: progress.get()};
    return {transform: [{translateY: (1 - progress.get()) * panelHeight.get() + drag.get()}]};
  });

  const onPanelLayout = (event: LayoutChangeEvent) => {
    panelHeight.set(event.nativeEvent.layout.height);
  };
  const close = dismissible ? onClose : undefined;
  const labelled = (IS_WEB ? {'aria-labelledby': titleId} : {}) as Partial<ModalProps>;
  const fullscreen = mode === 'fullscreen';
  const media = tokens.colors.dark.surfaceContainerLowest;

  const header = (
    <View style={[styles.header, {gap: theme.space.sm, paddingLeft: fullscreen ? theme.space.xs : theme.space.xl, paddingRight: fullscreen ? theme.space.xl : theme.space.sm, minHeight: theme.layout.topAppBarHeight}]}>
      {fullscreen && close ? <IconButton icon="close" label="Close" variant="media" onPress={close}/> : null}
      <Heading level={2} variant="titleLarge" nativeID={titleId} color={fullscreen ? 'onMedia' : 'onSurface'} numberOfLines={2} style={styles.title}>{title}</Heading>
      {!fullscreen && close ? <IconButton icon="close" label="Close" onPress={close}/> : null}
    </View>
  );

  const panel = (
    <Animated.View
      testID={testID}
      onLayout={onPanelLayout}
      style={[
        fullscreen ? styles.fullscreen : null,
        mode === 'sheet' ? styles.sheet : null,
        mode === 'dialog' ? styles.dialog : null,
        mode === 'sheet' ? {
          maxHeight: viewport.height * SHEET_MAX_HEIGHT,
          backgroundColor: theme.colors.surfaceContainerLow,
          borderTopLeftRadius: theme.shape.extraLarge,
          borderTopRightRadius: theme.shape.extraLarge,
        } : null,
        mode === 'dialog' ? {
          width: Math.min(DIALOG_WIDTH[width], viewport.width - theme.space.xxl),
          maxHeight: viewport.height * DIALOG_MAX_HEIGHT,
          backgroundColor: theme.colors.surfaceContainerHigh,
          borderRadius: theme.shape.extraLarge,
        } : null,
        fullscreen ? {backgroundColor: media, paddingTop: insets.top, paddingBottom: insets.bottom} : elevation.level3,
        panelStyle,
      ]}
    >
      {mode === 'sheet' ? (
        <GestureDetector gesture={pan}>
          <View aria-hidden style={[styles.handleZone, {height: HANDLE_ZONE}]}>
            <View style={{width: HANDLE.width, height: HANDLE.height, borderRadius: theme.shape.full, backgroundColor: theme.colors.onSurfaceVariant, opacity: HANDLE_OPACITY}}/>
          </View>
        </GestureDetector>
      ) : null}
      {header}
      <ScrollView style={styles.body} contentContainerStyle={fullscreen ? styles.grow : {paddingHorizontal: theme.space.xl, paddingBottom: theme.space.lg}} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, {gap: theme.space.sm, paddingHorizontal: theme.space.xl, paddingTop: theme.space.md, paddingBottom: theme.space.lg + (mode === 'sheet' ? insets.bottom : 0)}]}>
          {footer}
        </View>
      ) : mode === 'sheet' ? <View style={{height: insets.bottom}}/> : null}
    </Animated.View>
  );

  return (
    <Modal
      {...labelled}
      visible={open || exiting}
      transparent
      animationType="none"
      onRequestClose={close ?? (() => undefined)}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <GestureHandlerRootView style={styles.root}>
        {fullscreen ? null : (
          <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
            <Scrim onPress={close}/>
          </Animated.View>
        )}
        <KeyboardAvoidingView behavior="padding" style={[styles.root, styles.passThrough, mode === 'sheet' ? styles.bottom : styles.center]}>
          {panel}
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  passThrough: {pointerEvents: 'box-none'},
  bottom: {justifyContent: 'flex-end'},
  center: {justifyContent: 'center', alignItems: 'center'},
  sheet: {width: '100%', overflow: 'hidden'},
  dialog: {overflow: 'hidden'},
  fullscreen: {flex: 1, width: '100%'},
  handleZone: {alignItems: 'center', justifyContent: 'center'},
  header: {flexDirection: 'row', alignItems: 'center'},
  title: {flex: 1},
  body: {flexGrow: 0, flexShrink: 1},
  grow: {flexGrow: 1},
  footer: {flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap'},
});
