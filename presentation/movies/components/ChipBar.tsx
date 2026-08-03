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

interface ChipMetrics {
    x: number;
    width: number;
}

const REVEAL_RETRY_MS = 160;

export function ChipBar({chips, active, onSelect, contentPadding = Spacing.md}: ChipBarProps) {
    const {colors} = usePalette();
    const scrollRef = useRef<ScrollView | null>(null);
    const metrics = useRef<Record<string, ChipMetrics>>({});
    const viewportWidth = useRef(0);

    const pending = useRef<string | null>(null);

    const revealActive = useCallback(
        (animated: boolean) => {
            const chip = metrics.current[active];
            const viewport = viewportWidth.current;
            if (!chip || !scrollRef.current || viewport <= 0) {
                pending.current = active;
                return;
            }
            pending.current = null;
            const centered = chip.x - (viewport - chip.width) / 2;
            scrollRef.current.scrollTo({x: Math.max(0, centered), y: 0, animated});
        },
        [active]
    );

    useEffect(() => {
        pending.current = active;
        revealActive(false);
        const retry = setTimeout(() => revealActive(true), REVEAL_RETRY_MS);
        return () => clearTimeout(retry);
    }, [active, revealActive]);

    const onViewportLayout = useCallback(
        (event: LayoutChangeEvent) => {
            viewportWidth.current = event.nativeEvent.layout.width;
            revealActive(false);
        },
        [revealActive]
    );

    const onChipLayout = useCallback(
        (key: string, event: LayoutChangeEvent) => {
            const {x, width} = event.nativeEvent.layout;
            metrics.current[key] = {x, width};
            if (pending.current === key) revealActive(false);
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
                contentContainerStyle={[styles.content, {paddingHorizontal: contentPadding}]}
            >
                {chips.map((chip) => {
                    const selected = chip.key === active;
                    return (
                        <PressableScale
                            key={chip.key}
                            accessibilityRole="button"
                            accessibilityState={{selected}}
                            accessibilityLabel={chip.label}
                            onPress={() => onSelect(chip.key)}
                            onLayout={(event) => onChipLayout(chip.key, event)}
                            pressedScale={0.94}
                            pressedOpacity={0.85}
                            contentStyle={[
                                styles.chip,
                                {
                                    backgroundColor: selected ? colors.accent : colors.surfaceSunken,
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
