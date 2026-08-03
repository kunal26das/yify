import { BlurView } from 'expo-blur';
import {
  GlassContainer,
  GlassView,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { Component, type ReactNode } from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import { useBlurTarget } from './blur-target';

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

interface GlassFallbackProps {
  children: ReactNode;
  fallback: ReactNode;
}

class NativeEffectBoundary extends Component<GlassFallbackProps, {failed: boolean}> {
  state = {failed: false};

  static getDerivedStateFromError() {
    return {failed: true};
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function LiquidGlassView({
  children,
  style,
  tint = 'light',
  intensity = 60,
  fallbackBackgroundColor,
  interactive = false,
  glassEffectStyle = 'regular',
}: LiquidGlassViewProps) {
  const blurTarget = useBlurTarget();

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

  const solid = (
    <View style={[style, fallbackBackgroundColor ? {backgroundColor: fallbackBackgroundColor} : undefined]}>
      {children}
    </View>
  );

  if (Platform.OS === 'android' && blurTarget == null) return solid;

  return (
    <NativeEffectBoundary fallback={solid}>
      <BlurView
        intensity={intensity}
        tint={tint}
        style={style}
        {...(blurTarget
          ? {blurTarget, blurMethod: 'dimezisBlurViewSdk31Plus' as const}
          : null)}
      >
        {children}
      </BlurView>
    </NativeEffectBoundary>
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
