import {useEffect, useRef} from 'react';
import {Animated, StyleSheet, View} from 'react-native';
import {Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {getPosterContainerStyle} from './moviePosterLayout';

export function PosterSkeleton({width}: { width?: number }) {
    const {colors, scheme} = usePalette();
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

    const opacity = pulse.interpolate({inputRange: [0, 1], outputRange: [0.4, 0.85]});
    const block = scheme === 'dark' ? colors.surfaceElevated : colors.surfaceSunken;

    return (
        <View style={getPosterContainerStyle(width)}>
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
});
