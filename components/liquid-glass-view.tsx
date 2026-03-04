import { BlurView } from 'expo-blur';
import {
  GlassView,
  isGlassEffectAPIAvailable,
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
}

const useNativeLiquidGlass =
  Platform.OS === 'ios' && isGlassEffectAPIAvailable();

export function LiquidGlassView({
  children,
  style,
  tint = 'light',
  intensity = 60,
  fallbackBackgroundColor,
}: LiquidGlassViewProps) {
  if (useNativeLiquidGlass) {
    return (
      <GlassView
        colorScheme={tint}
        glassEffectStyle="regular"
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
