import {useCallback, useEffect, useRef} from 'react';
import {ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native';
import {Duration, PressableScale} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {usePalette} from '../../hooks/use-palette';
import {useHaptics} from '../../hooks/use-haptics';
import {FontFamily, Radius, Spacing} from '../../constants/theme';

interface ChipBarProps {
    chips: readonly {key: string; label: string}[];
    active: string;
    onSelect: (key: string) => void;
    contentPadding?: number;
}

const REVEAL_RETRIES = [0, 120, 400];

export function ChipBar({chips, active, onSelect, contentPadding = Spacing.md}: ChipBarProps) {
    const {colors} = usePalette();
    const haptics = useHaptics();
    const scrollRef = useRef<ScrollView | null>(null);
    const contentRef = useRef<View | null>(null);
    const chipRefs = useRef<Record<string, View | null>>({});
    const {width} = useWindowDimensions();

    const revealActive = useCallback(
        (animated: boolean) => {
            const node = chipRefs.current[active];
            const content = contentRef.current;
            const scroller = scrollRef.current;
            if (!node || !content || !scroller || width <= 0) return;
            node.measureLayout(
                content as never,
                (x: number, _y: number, chipWidth: number) => {
                    const centered = x - (width - chipWidth) / 2;
                    scroller.scrollTo({x: Math.max(0, centered), y: 0, animated});
                },
                () => undefined
            );
        },
        [active, width]
    );

    useEffect(() => {
        const timers = REVEAL_RETRIES.map((delay) =>
            setTimeout(() => revealActive(delay > 0), delay)
        );
        return () => timers.forEach(clearTimeout);
    }, [revealActive]);

    return (
        <View style={styles.container}>
            <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                onContentSizeChange={() => revealActive(false)}
            >
                <View
                    ref={contentRef}
                    style={[styles.content, {paddingHorizontal: contentPadding}]}
                >
                    {chips.map((chip) => {
                        const selected = chip.key === active;
                        return (
                            <View
                                key={chip.key}
                                ref={(node) => {
                                    chipRefs.current[chip.key] = node;
                                }}
                            >
                            <PressableScale
                                accessibilityRole="button"
                                accessibilityState={{selected}}
                                accessibilityLabel={chip.label}
                                onPress={() => {
                                    haptics.select();
                                    onSelect(chip.key);
                                }}
                                pressedScale={0.98}
                                pressedOpacity={0.85}
                                contentStyle={[
                                    styles.chip,
                                    {
                                        backgroundColor: selected
                                            ? colors.text
                                            : colors.background,
                                        borderColor: selected ? colors.text : colors.border,
                                        transitionProperty: ['backgroundColor', 'borderColor'],
                                        transitionDuration: Duration.fast,
                                    },
                                ]}
                            >
                                <ThemedText
                                    numberOfLines={1}
                                    style={[
                                        styles.chipLabel,
                                        {color: selected ? colors.background : colors.textMuted},
                                    ]}
                                >
                                    {chip.label}
                                </ThemedText>
                            </PressableScale>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {position: 'relative'},
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.md,
    },
    chip: {
        height: 44,
        borderRadius: Radius.sm,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipLabel: {fontSize: 13, lineHeight: 18, fontFamily: FontFamily.medium},
});
