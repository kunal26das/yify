import Animated from 'react-native-reanimated';
import {usePalette} from '../../hooks/use-palette';
import {pulseKeyframes, type MotionStyle} from '../../components/motion';

function pulseStyle(delayMs = 0): MotionStyle {
    return {
        animationName: pulseKeyframes,
        animationDuration: '1500ms',
        animationIterationCount: 'infinite',
        animationTimingFunction: 'ease-in-out',
        animationDelay: `${delayMs}ms`,
    };
}

export function SkeletonBlock({style, delayMs}: {style?: object; delayMs?: number}) {
    const {colors, scheme} = usePalette();
    const block = scheme === 'dark' ? colors.surfaceElevated : colors.surfaceSunken;

    return (
        <Animated.View
            style={[{backgroundColor: block, borderColor: colors.border}, pulseStyle(delayMs), style]}
        />
    );
}
