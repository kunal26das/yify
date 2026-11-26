import {useRouter} from 'expo-router';
import type {ReactNode, Ref} from 'react';
import {useRef, useState} from 'react';
import type {GestureResponderEvent, HostInstance, KeyDownEvent, KeyUpEvent, NativeSyntheticEvent, PressableProps, StyleProp, TargetedEvent, ViewStyle} from 'react-native';
import {Pressable, StyleSheet, View} from 'react-native';
import {IS_WEB} from '../environment';
import {layerOpacity, rippleColor} from '../theme/stateLayer';
import type {ColorRoles, Tokens} from '../theme/tokens';
import {useTheme} from '../theme/useTheme';

export interface TouchableProps extends Omit<PressableProps, 'style' | 'children' | 'onPress'> {
  ref?: Ref<HostInstance>;
  onPress?: () => void;
  href?: string;
  contentColor?: keyof ColorRoles;
  shape?: keyof Tokens['shape'];
  ripple?: 'bounded' | 'borderless' | 'none';
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

interface PointerLikeEvent {
  metaKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  button?: number;
  preventDefault?: () => void;
}

interface KeyLikeEvent {
  key?: string;
  nativeEvent?: {key?: string};
  target?: unknown;
  currentTarget?: unknown;
}

const SPACE_ROLES: ReadonlySet<string> = new Set(['checkbox', 'switch', 'radio']);
const EXTERNAL_HREF = /^[a-z][a-z\d+.-]*:/i;
const EXTERNAL_ATTRS = {target: '_blank', rel: 'noopener noreferrer'} as const;
const PLACEMENT_KEYS: ReadonlySet<string> = new Set([
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
  'marginBlock', 'marginBlockStart', 'marginBlockEnd', 'marginInline', 'marginInlineStart', 'marginInlineEnd',
  'position', 'top', 'bottom', 'left', 'right', 'start', 'end',
  'inset', 'insetBlock', 'insetBlockStart', 'insetBlockEnd', 'insetInline', 'insetInlineStart', 'insetInlineEnd',
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf',
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'aspectRatio',
  'zIndex', 'transform', 'transformOrigin', 'display',
]);
const RADIUS_KEY = /^border(?:(?:Top|Bottom)(?:Left|Right|Start|End)|(?:Start|End)(?:Start|End))?Radius$/;

export function isPlainActivation(event: unknown): boolean {
  const pointer = (event ?? {}) as PointerLikeEvent;
  const modified = pointer.metaKey === true || pointer.altKey === true || pointer.ctrlKey === true || pointer.shiftKey === true;
  const leftButton = pointer.button === undefined || pointer.button === 0;
  return !modified && leftButton;
}

export function isExternalHref(href: string): boolean {
  return EXTERNAL_HREF.test(href);
}

export function splitClipStyle(style: StyleProp<ViewStyle>, radius: number): {clip: ViewStyle; content: ViewStyle} {
  const clip: Record<string, unknown> = {borderRadius: radius, overflow: 'hidden', pointerEvents: 'box-none'};
  const content: Record<string, unknown> = {borderRadius: radius};
  for (const [key, value] of Object.entries(StyleSheet.flatten(style) ?? {})) {
    if (RADIUS_KEY.test(key)) {
      clip[key] = value;
      content[key] = value;
    } else if (PLACEMENT_KEYS.has(key)) {
      clip[key] = value;
    } else {
      content[key] = value;
    }
  }
  content.flexGrow = 1;
  return {clip: clip as ViewStyle, content: content as ViewStyle};
}

function isOwnSpace(event: unknown): boolean {
  const keyboard = (event ?? {}) as KeyLikeEvent;
  const key = keyboard.nativeEvent?.key ?? keyboard.key;
  return (key === ' ' || key === 'Spacebar') && keyboard.target === keyboard.currentTarget;
}

export function Touchable({
  ref,
  onPress,
  href,
  contentColor = 'onSurface',
  shape = 'none',
  ripple = 'bounded',
  style,
  children,
  disabled,
  role,
  dataSet,
  onFocus,
  onBlur,
  onHoverIn,
  onHoverOut,
  ...rest
}: TouchableProps) {
  const theme = useTheme();
  const router = useRouter();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const spaceDown = useRef(false);
  const inactive = disabled === true;
  const content = theme.colors[contentColor];
  const radius = theme.shape[shape];
  const link = IS_WEB && href !== undefined;
  const external = href !== undefined && isExternalHref(href);
  const spaceToggles = IS_WEB && role !== undefined && SPACE_ROLES.has(role);

  const handlePress = (event: GestureResponderEvent) => {
    if (link) {
      if (!isPlainActivation(event)) return;
      if (!external) (event as unknown as PointerLikeEvent).preventDefault?.();
    }
    if (onPress) onPress();
    else if (href !== undefined && !(link && external)) router.push(href);
  };
  const handleFocus = (event: NativeSyntheticEvent<TargetedEvent>) => {
    if (!IS_WEB) setFocused(true);
    onFocus?.(event);
  };
  const handleBlur = (event: NativeSyntheticEvent<TargetedEvent>) => {
    spaceDown.current = false;
    if (!IS_WEB) setFocused(false);
    onBlur?.(event);
  };
  const handleHoverIn: PressableProps['onHoverIn'] = (event) => {
    if (!IS_WEB) setHovered(true);
    onHoverIn?.(event);
  };
  const handleHoverOut: PressableProps['onHoverOut'] = (event) => {
    if (!IS_WEB) setHovered(false);
    onHoverOut?.(event);
  };
  const keyboard = spaceToggles ? {
    onKeyDown: (event: KeyDownEvent) => {
      if (isOwnSpace(event)) {
        event.preventDefault();
        spaceDown.current = !inactive;
      }
      rest.onKeyDown?.(event);
    },
    onKeyUp: (event: KeyUpEvent) => {
      if (isOwnSpace(event) && spaceDown.current) {
        spaceDown.current = false;
        if (!inactive) handlePress(event as unknown as GestureResponderEvent);
      }
      rest.onKeyUp?.(event);
    },
  } : {};

  const anchor = link && !inactive ? (external ? {href, hrefAttrs: EXTERNAL_ATTRS} : {href}) : {};
  const layer = IS_WEB ? null : {opacity: inactive ? 0 : layerOpacity({hovered, focused})};
  const ring = !IS_WEB && focused
    ? {outlineWidth: 2, outlineStyle: 'solid' as const, outlineOffset: 2, outlineColor: theme.colors.focusRing}
    : null;
  const flat = StyleSheet.flatten(style);
  const corner = typeof flat?.borderRadius === 'number' ? flat.borderRadius : radius;
  const clipped = !IS_WEB && ripple === 'bounded' && corner > 0 ? splitClipStyle(style, radius) : null;
  const {onLayout, ...pressableRest} = rest;

  const pressable = (
    <Pressable
      {...pressableRest}
      {...anchor}
      {...keyboard}
      onLayout={clipped ? undefined : onLayout}
      ref={ref}
      role={role ?? (rest.accessibilityRole === undefined ? (link ? 'link' : 'button') : undefined)}
      disabled={inactive}
      aria-disabled={inactive || undefined}
      onPress={inactive ? undefined : handlePress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      android_ripple={ripple === 'none' || inactive ? undefined : {color: rippleColor(content), borderless: ripple === 'borderless', foreground: true}}
      dataSet={IS_WEB && rest.hitSlop !== undefined ? {...dataSet, focusable: '', hitSlop: ''} : {...dataSet, focusable: ''}}
      style={clipped ? clipped.content : [{borderRadius: radius}, ring, style]}
    >
      <View
        dataSet={{stateLayer: ''}}
        style={[StyleSheet.absoluteFill, {backgroundColor: content, borderRadius: corner, pointerEvents: 'none'}, layer]}
      />
      {children}
    </Pressable>
  );
  if (!clipped) return pressable;
  return (
    <View collapsable={false} hitSlop={rest.hitSlop} onLayout={onLayout} style={[clipped.clip, ring]}>
      {pressable}
    </View>
  );
}
