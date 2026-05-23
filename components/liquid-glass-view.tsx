import { BlurView } from 'expo-blur';
import {
  GlassContainer,
  GlassView,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { Platform, StyleProp, ViewStyle } from 'react-native';

type Tint = 'light' | 'dark';

interface LiquidGlassViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Used for GlassView colorScheme and BlurView tint. */
  tint?: Tint;
  /** Blur intensity when falling back to BlurView (Android or pre–iOS 26). Default 60. */
  intensity?: number;
  /** Optional background color for fallback on Android (e.g. iconColor + '28'). */
  fallbackBackgroundColor?: string;
  /**
   * Marks the glass as interactive so iOS 26 applies the press-response
   * animation native to Liquid Glass buttons.
   * @default false
   */
  interactive?: boolean;
  /** Optional explicit glass effect style. Defaults to 'regular'. */
  glassEffectStyle?: 'clear' | 'regular';
}

const supportsLiquidGlass =
  Platform.OS === 'ios' && isLiquidGlassAvailable();

export function LiquidGlassView({
  children,
  style,
  tint = 'light',
  intensity = 60,
  fallbackBackgroundColor,
  interactive = false,
  glassEffectStyle = 'regular',
}: LiquidGlassViewProps) {
  if (supportsLiquidGlass) {
    return (
      <GlassView
        colorScheme={tint}
        glassEffectStyle={glassEffectStyle}
        isInteractive={interactive}
        style={[style]}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView
      intensity={intensity}
      tint={tint}
      style={[
        style,
        Platform.OS === 'android' && fallbackBackgroundColor
          ? { backgroundColor: fallbackBackgroundColor }
          : undefined,
      ]}
    >
      {children}
    </BlurView>
  );
}

/**
 * Groups multiple `LiquidGlassView` elements so iOS 26 morphs and blends them
 * as a single Liquid Glass surface (matching the native toolbar/control-cluster
 * behavior). On non-iOS / pre-26, renders a plain pass-through.
 */
export function LiquidGlassGroup({
  children,
  spacing = 12,
  style,
}: {
  children?: React.ReactNode;
  spacing?: number;
  style?: StyleProp<ViewStyle>;
}) {
  if (supportsLiquidGlass) {
    return (
      <GlassContainer spacing={spacing} style={style}>
        {children}
      </GlassContainer>
    );
  }
  return <>{children}</>;
}

export const isNativeLiquidGlass = supportsLiquidGlass;
