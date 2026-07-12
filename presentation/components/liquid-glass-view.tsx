import { BlurView } from 'expo-blur';
import {
  GlassContainer,
  GlassView,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';

type Tint = 'light' | 'dark';

interface LiquidGlassViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: Tint;
  intensity?: number;
  fallbackBackgroundColor?: string;
  interactive?: boolean;
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
  return <View style={style}>{children}</View>;
}

export const isNativeLiquidGlass = supportsLiquidGlass;
