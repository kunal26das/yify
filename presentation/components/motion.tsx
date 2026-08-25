import {forwardRef, useState} from 'react';
import {
    Platform,
    Pressable,
    StyleSheet,
    View,
    type PressableProps,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInLeft,
    FadeOut,
    LinearTransition,
    ZoomIn,
    ZoomOut,
} from 'react-native-reanimated';

export const Duration = {
    instant: 90,
    fast: 150,
    base: 260,
    slow: 420,
} as const;

const STAGGER_STEP = 45;
const STAGGER_CAP = 9;

export function staggerDelay(index: number, step: number = STAGGER_STEP): number {
    return Math.max(0, Math.min(index, STAGGER_CAP)) * step;
}

const ANIMATED = Platform.OS !== 'web';

function animated<T>(build: () => T): T | undefined {
    return ANIMATED ? build() : undefined;
}

export const enterFade = (index = 0) =>
    animated(() => FadeIn.duration(Duration.base).delay(staggerDelay(index)));

export const enterRise = (index = 0) =>
    animated(() => FadeInDown.duration(Duration.base).delay(staggerDelay(index)));

export const enterSlide = (index = 0) =>
    animated(() => FadeInLeft.duration(Duration.base).delay(staggerDelay(index)));

export const enterPop = (index = 0) =>
    animated(() => ZoomIn.duration(Duration.fast).delay(staggerDelay(index)));

export const exitFade = animated(() => FadeOut.duration(Duration.fast));

export const exitPop = animated(() => ZoomOut.duration(Duration.fast));

export const shiftLayout = LinearTransition.duration(Duration.base);

export const pulseKeyframes = {
    '0%': {opacity: 0.42},
    '50%': {opacity: 0.9},
    '100%': {opacity: 0.42},
};

export const breatheKeyframes = {
    '0%': {transform: [{scale: 1}]},
    '50%': {transform: [{scale: 1.09}]},
    '100%': {transform: [{scale: 1}]},
};

export const sweepKeyframes = {
    '0%': {transform: [{translateX: '-120%'}]},
    '100%': {transform: [{translateX: '220%'}]},
};

export type MotionStyle = React.ComponentProps<typeof Animated.View>['style'];

interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
    style?: StyleProp<ViewStyle>;
    contentStyle?: MotionStyle;
    children?: React.ReactNode;
    pressedScale?: number;
    hoveredScale?: number;
    pressedOpacity?: number;
    lift?: number;
    duration?: number;
}

export const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
    {
        style,
        contentStyle,
        children,
        pressedScale = 0.96,
        hoveredScale = 1,
        pressedOpacity = 1,
        lift = 0,
        duration = Duration.instant,
        onPressIn,
        onPressOut,
        onHoverIn,
        onHoverOut,
        disabled,
        ...rest
    },
    ref
) {
    const [pressed, setPressed] = useState(false);
    const [hovered, setHovered] = useState(false);

    const scale = disabled ? 1 : pressed ? pressedScale : hovered ? hoveredScale : 1;
    const translateY = !disabled && hovered && !pressed ? -lift : 0;

    return (
        <Pressable
            ref={ref}
            disabled={disabled}
            onPressIn={(e) => {
                setPressed(true);
                onPressIn?.(e);
            }}
            onPressOut={(e) => {
                setPressed(false);
                onPressOut?.(e);
            }}
            onHoverIn={(e) => {
                setHovered(true);
                onHoverIn?.(e);
            }}
            onHoverOut={(e) => {
                setHovered(false);
                onHoverOut?.(e);
            }}
            style={style}
            {...rest}
        >
            <Animated.View
                style={[
                    contentStyle,
                    {
                        transform: [{scale}, {translateY}],
                        opacity: pressed && !disabled ? pressedOpacity : 1,
                        transitionProperty: ['transform', 'opacity'],
                        transitionDuration: duration,
                        transitionTimingFunction: 'ease-out',
                    },
                ]}
            >
                {children}
            </Animated.View>
        </Pressable>
    );
});

export function Shimmer({tint = 'rgba(255,255,255,0.09)'}: {tint?: string}) {
    return (
        <View style={styles.shimmerClip} pointerEvents="none">
            <Animated.View
                style={[
                    styles.shimmerBand,
                    {
                        experimental_backgroundImage: `linear-gradient(to right, transparent, ${tint}, transparent)`,
                        backgroundImage: `linear-gradient(to right, transparent, ${tint}, transparent)`,
                        animationName: sweepKeyframes,
                        animationDuration: '1500ms',
                        animationIterationCount: 'infinite',
                        animationTimingFunction: 'ease-in-out',
                    } as ViewStyle,
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    shimmerClip: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden'},
    shimmerBand: {position: 'absolute', top: 0, bottom: 0, left: 0, width: '60%'},
});
