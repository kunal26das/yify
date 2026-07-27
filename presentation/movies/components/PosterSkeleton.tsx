import {StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {Shimmer, pulseKeyframes, type MotionStyle} from '../../components/motion';
import {getPosterContainerStyle, POSTER_GAP} from './moviePosterLayout';
import {landscapeArtHeight, landscapeWidth} from './MovieLandscapeItem';

function pulseStyle(delayMs = 0): MotionStyle {
    return {
        animationName: pulseKeyframes,
        animationDuration: '1500ms',
        animationIterationCount: 'infinite',
        animationTimingFunction: 'ease-in-out',
        animationDelay: `${delayMs}ms`,
    };
}

function useBlockColor(): string {
    const {colors, scheme} = usePalette();
    return scheme === 'dark' ? colors.surfaceElevated : colors.surfaceSunken;
}

function useShimmerTint(): string {
    const {scheme} = usePalette();
    return scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)';
}

export function PosterSkeleton({width, height}: { width?: number; height?: number }) {
    const {colors} = usePalette();
    const block = useBlockColor();
    const tint = useShimmerTint();

    return (
        <View style={getPosterContainerStyle(width, height)}>
            <Animated.View
                style={[styles.card, {backgroundColor: block, borderColor: colors.border}, pulseStyle()]}
            >
                <View style={styles.footer}>
                    <View style={[styles.line, {backgroundColor: colors.border, width: '85%'}]}/>
                    <View style={[styles.line, {backgroundColor: colors.border, width: '45%'}]}/>
                </View>
                <Shimmer tint={tint}/>
            </Animated.View>
        </View>
    );
}

export function SkeletonBlock({style}: { style?: object }) {
    const {colors} = usePalette();
    const block = useBlockColor();

    return (
        <Animated.View
            style={[{backgroundColor: block, borderColor: colors.border}, pulseStyle(), style]}
        />
    );
}

export function LandscapeSkeleton({posterWidth}: { posterWidth: number }) {
    const {colors} = usePalette();
    const block = useBlockColor();
    const tint = useShimmerTint();
    const width = landscapeWidth(posterWidth);

    return (
        <View style={{width, marginHorizontal: POSTER_GAP / 2}}>
            <Animated.View
                style={[
                    styles.art,
                    {
                        height: landscapeArtHeight(posterWidth),
                        backgroundColor: block,
                        borderColor: colors.border,
                    },
                    pulseStyle(),
                ]}
            >
                <Shimmer tint={tint}/>
            </Animated.View>
            <Animated.View
                style={[styles.captionTitle, {backgroundColor: block, width: '70%'}, pulseStyle(120)]}
            />
            <Animated.View
                style={[styles.captionMeta, {backgroundColor: block, width: '45%'}, pulseStyle(240)]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flex: 1,
        borderRadius: Radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        justifyContent: 'flex-end',
        padding: Spacing.md,
        overflow: 'hidden',
    },
    footer: {gap: 6},
    line: {height: 9, borderRadius: 4},

    art: {borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden'},
    captionTitle: {height: 19, marginTop: 8, borderRadius: 4},
    captionMeta: {height: 16, marginTop: 1, borderRadius: 4},
});
