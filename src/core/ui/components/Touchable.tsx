import {useRouter} from 'expo-router';
import type {ReactNode, Ref} from 'react';
import {useState} from 'react';
import type {GestureResponderEvent, HostInstance, NativeSyntheticEvent, PressableProps, StyleProp, TargetedEvent, ViewStyle} from 'react-native';
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

export function isPlainActivation(event: unknown): boolean {
  const pointer = (event ?? {}) as PointerLikeEvent;
  const modified = pointer.metaKey === true || pointer.altKey === true || pointer.ctrlKey === true || pointer.shiftKey === true;
  const leftButton = pointer.button === undefined || pointer.button === 0;
  return !modified && leftButton;
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
  const inactive = disabled === true;
  const content = theme.colors[contentColor];
  const radius = theme.shape[shape];
  const link = IS_WEB && href !== undefined;

  const handlePress = (event: GestureResponderEvent) => {
    if (link) {
      if (!isPlainActivation(event)) return;
      (event as unknown as PointerLikeEvent).preventDefault?.();
    }
    if (onPress) onPress();
    else if (href !== undefined) router.push(href);
  };
  const handleFocus = (event: NativeSyntheticEvent<TargetedEvent>) => {
    if (!IS_WEB) setFocused(true);
    onFocus?.(event);
  };
  const handleBlur = (event: NativeSyntheticEvent<TargetedEvent>) => {
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

  const anchor = link && !inactive ? {href} : {};
  const layer = IS_WEB ? null : {opacity: inactive ? 0 : layerOpacity({hovered, focused})};
  const ring = !IS_WEB && focused
    ? {outlineWidth: 2, outlineStyle: 'solid' as const, outlineOffset: 2, outlineColor: theme.colors.focusRing}
    : null;

  return (
    <Pressable
      {...rest}
      {...anchor}
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
      style={[{borderRadius: radius}, ring, style]}
    >
      <View
        dataSet={{stateLayer: ''}}
        style={[StyleSheet.absoluteFill, {backgroundColor: content, borderRadius: radius, pointerEvents: 'none'}, layer]}
      />
      {children}
    </Pressable>
  );
}
