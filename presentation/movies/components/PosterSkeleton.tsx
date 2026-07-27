import {useEffect, useRef} from 'react';
import {Animated, StyleSheet, View} from 'react-native';
import {Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {getPosterContainerStyle, POSTER_GAP} from './moviePosterLayout';
import {landscapeArtHeight, landscapeWidth} from './MovieLandscapeItem';

function usePulse(): Animated.AnimatedInterpolation<number> {
    const pulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {toValue: 1, duration: 750, useNativeDriver: true}),
                Animated.timing(pulse, {toValue: 0, duration: 750, useNativeDriver: true}),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);

    return pulse.interpolate({inputRange: [0, 1], outputRange: [0.4, 0.85]});
}

function useBlockColor(): string {
    const {colors, scheme} = usePalette();
    return scheme === 'dark' ? colors.surfaceElevated : colors.surfaceSunken;
}

export function PosterSkeleton({width, height}: { width?: number; height?: number }) {
    const {colors} = usePalette();
    const opacity = usePulse();
    const block = useBlockColor();

    return (
        <View style={getPosterContainerStyle(width, height)}>
            <Animated.View
                style={[styles.card, {backgroundColor: block, borderColor: colors.border, opacity}]}
            >
                <View style={styles.footer}>
                    <View style={[styles.line, {backgroundColor: colors.border, width: '85%'}]}/>
                    <View style={[styles.line, {backgroundColor: colors.border, width: '45%'}]}/>
                </View>
            </Animated.View>
        </View>
    );
}

export function SkeletonBlock({style}: { style?: object }) {
    const {colors} = usePalette();
    const opacity = usePulse();
    const block = useBlockColor();

    return (
        <Animated.View
            style={[{backgroundColor: block, borderColor: colors.border, opacity}, style]}
        />
    );
}

export function LandscapeSkeleton({posterWidth}: { posterWidth: number }) {
    const {colors} = usePalette();
    const opacity = usePulse();
    const block = useBlockColor();
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
                        opacity,
                    },
                ]}
            />
            <Animated.View
                style={[styles.captionTitle, {backgroundColor: block, opacity, width: '70%'}]}
            />
            <Animated.View
                style={[styles.captionMeta, {backgroundColor: block, opacity, width: '45%'}]}
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
    },
    footer: {gap: 6},
    line: {height: 9, borderRadius: 4},

    art: {borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth},
    captionTitle: {height: 19, marginTop: 8, borderRadius: 4},
    captionMeta: {height: 16, marginTop: 1, borderRadius: 4},
});
