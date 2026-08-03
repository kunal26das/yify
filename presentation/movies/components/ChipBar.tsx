import {useCallback, useEffect, useRef} from 'react';
import {type LayoutChangeEvent, ScrollView, StyleSheet, View} from 'react-native';
import {Duration, PressableScale} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {usePalette} from '../../hooks/use-palette';
import {Radius, Spacing} from '../../constants/theme';

interface ChipBarProps {
    chips: readonly {key: string; label: string}[];
    active: string;
    onSelect: (key: string) => void;
    contentPadding?: number;
}

const REVEAL_RETRIES = [0, 120, 400];

export function ChipBar({chips, active, onSelect, contentPadding = Spacing.md}: ChipBarProps) {
    const {colors} = usePalette();
    const scrollRef = useRef<ScrollView | null>(null);
    const contentRef = useRef<View | null>(null);
    const chipRefs = useRef<Record<string, View | null>>({});
    const viewportWidth = useRef(0);

    const revealActive = useCallback(
        (animated: boolean) => {
            const node = chipRefs.current[active];
            const content = contentRef.current;
            const viewport = viewportWidth.current;
            if (!node || !content || !scrollRef.current || viewport <= 0) return;
            node.measureLayout(
                content as never,
                (x: number, _y: number, width: number) => {
                    const centered = x - (viewport - width) / 2;
                    scrollRef.current?.scrollTo({x: Math.max(0, centered), y: 0, animated});
                },
                () => undefined
            );
        },
        [active]
    );

    useEffect(() => {
        const timers = REVEAL_RETRIES.map((delay) =>
            setTimeout(() => revealActive(delay > 0), delay)
        );
        return () => timers.forEach(clearTimeout);
    }, [revealActive]);

    const onViewportLayout = useCallback(
        (event: LayoutChangeEvent) => {
            viewportWidth.current = event.nativeEvent.layout.width;
            revealActive(false);
        },
        [revealActive]
    );

    return (
        <View style={styles.container}>
            <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                onLayout={onViewportLayout}
                onContentSizeChange={() => revealActive(false)}
            >
                <View
                    ref={contentRef}
                    style={[styles.content, {paddingHorizontal: contentPadding}]}
                >
                    {chips.map((chip) => {
                        const selected = chip.key === active;
                        return (
                            <PressableScale
                                key={chip.key}
                                ref={(node: View | null) => {
                                    chipRefs.current[chip.key] = node;
                                }}
                                accessibilityRole="button"
                                accessibilityState={{selected}}
                                accessibilityLabel={chip.label}
                                onPress={() => onSelect(chip.key)}
                                pressedScale={0.94}
                                pressedOpacity={0.85}
                                contentStyle={[
                                    styles.chip,
                                    {
                                        backgroundColor: selected
                                            ? colors.accent
                                            : colors.surfaceSunken,
                                        borderColor: selected ? 'transparent' : colors.border,
                                        transitionProperty: ['backgroundColor', 'borderColor'],
                                        transitionDuration: Duration.fast,
                                    },
                                ]}
                            >
                                <ThemedText
                                    numberOfLines={1}
                                    style={[
                                        styles.chipLabel,
                                        {color: selected ? colors.onAccent : colors.text},
                                    ]}
                                >
                                    {chip.label}
                                </ThemedText>
                            </PressableScale>
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
        gap: Spacing.md,
        paddingVertical: Spacing.md,
    },
    chip: {
        height: 34,
        borderRadius: Radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipLabel: {fontSize: 14, lineHeight: 18, fontWeight: '500'},
});
