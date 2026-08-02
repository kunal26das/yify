import type {ReactNode} from 'react';
import {StyleSheet, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import {LiquidGlassGroup, LiquidGlassView} from '../../components/liquid-glass-view';
import {ThemedText} from '../../components/themed-text';
import {Duration, PressableScale} from '../../components/motion';
import {usePalette} from '../../hooks/use-palette';
import {Radius} from '../../constants/theme';

interface ScrollProgressProps {
    current: number;
    total: number | null;
    atTop: boolean;
    onScrollToTop: () => void;
    trailing?: ReactNode;
    bottomInset: number;
    visible?: boolean;
}

export function ScrollProgress({
                                   current,
                                   total,
                                   atTop,
                                   onScrollToTop,
                                   trailing,
                                   bottomInset,
                                   visible = true,
                               }: ScrollProgressProps) {
    const {colors, scheme} = usePalette();
    const glassTint = scheme === 'dark' ? 'dark' : 'light';
    const glassFallback = scheme === 'dark' ? 'rgba(33,33,33,0.92)' : 'rgba(255,255,255,0.92)';
    const shown = visible && total != null;

    return (
        <Animated.View
            style={[
                styles.overlay,
                {
                    paddingBottom: bottomInset + 16,
                    opacity: shown ? 1 : 0,
                    transform: [{translateY: shown ? 0 : 20}, {scale: shown ? 1 : 0.94}],
                    transitionProperty: ['opacity', 'transform'],
                    transitionDuration: Duration.base,
                    transitionTimingFunction: 'ease-out',
                },
            ]}
            pointerEvents={shown ? 'box-none' : 'none'}
        >
            <LiquidGlassGroup spacing={16} style={styles.row}>
                <Animated.View
                    style={[
                        styles.scrollTop,
                        {
                            transform: [{scale: atTop ? 0 : 1}, {translateY: atTop ? 12 : 0}],
                            opacity: atTop ? 0 : 1,
                            transitionProperty: ['transform', 'opacity'],
                            transitionDuration: Duration.base,
                            transitionTimingFunction: 'ease-out',
                        },
                    ]}
                    pointerEvents={atTop ? 'none' : 'auto'}
                >
                    <PressableScale
                        onPress={onScrollToTop}
                        accessibilityRole="button"
                        accessibilityLabel="Scroll to top"
                        pressedScale={0.88}
                        pressedOpacity={0.6}
                        hoveredScale={1.08}
                        hitSlop={8}
                    >
                        <LiquidGlassView
                            tint={glassTint}
                            fallbackBackgroundColor={glassFallback}
                            style={[styles.circle, {borderColor: colors.border}]}
                        >
                            <Ionicons name="arrow-up" size={20} color={colors.text}/>
                        </LiquidGlassView>
                    </PressableScale>
                </Animated.View>

                <LiquidGlassView
                    tint={glassTint}
                    fallbackBackgroundColor={glassFallback}
                    style={[styles.countPill, {borderColor: colors.border}]}
                >
                    <ThemedText style={[styles.count, {color: colors.text}]}>
                        {current.toLocaleString()}
                        <ThemedText style={[styles.total, {color: colors.textMuted}]}>
                            {'  /  '}
                            {(total ?? 0).toLocaleString()}
                        </ThemedText>
                    </ThemedText>
                </LiquidGlassView>

                {trailing}
            </LiquidGlassGroup>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', zIndex: 25},
    row: {flexDirection: 'row', alignItems: 'center', gap: 12},
    scrollTop: {justifyContent: 'center', alignItems: 'center'},
    circle: {
        width: 46,
        height: 46,
        borderRadius: 23,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        justifyContent: 'center',
        alignItems: 'center',
    },
    countPill: {
        borderRadius: Radius.pill,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 18,
        height: 46,
        justifyContent: 'center',
    },
    count: {fontSize: 14, fontWeight: '800'},
    total: {fontSize: 13, fontWeight: '600'},
});
