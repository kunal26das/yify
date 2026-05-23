import {useEffect, useRef, useState} from 'react';
import {Animated, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View} from 'react-native';
import {ThemedText} from '../../components/themed-text';
import {LinearGradient} from '../../components/linear-gradient';
import {usePalette} from '../../hooks/use-palette';
import {useResponsive} from '../../hooks/use-responsive';
import {Radius, Spacing} from '../../constants/theme';
import {
    Genre,
    GENRE_OPTIONS,
    ORDER_OPTIONS,
    OrderBy,
    Quality,
    QUALITY_OPTIONS,
    RATING_OPTIONS,
    SORT_BY_OPTIONS,
    SortBy,
} from '../constants/movieFilterOptions';
import type {MovieFilters} from '../useMoviesViewModel';

interface MovieFilterModalProps {
    visible: boolean;
    onClose: () => void;
    filters: MovieFilters;
    onFiltersChange: (f: MovieFilters) => void;
    onApply: (filters: MovieFilters) => void;
    onClear: () => void;
    bottomInset: number;
}

interface FilterChipGroupProps<T extends string | number> {
    title: string;
    options: { value: T; label: string }[];
    selectedValue: T;
    onSelect: (value: T) => void;
}

function FilterChipGroup<T extends string | number>({
                                                        title,
                                                        options,
                                                        selectedValue,
                                                        onSelect,
                                                    }: FilterChipGroupProps<T>) {
    const {colors} = usePalette();

    return (
        <View style={styles.section}>
            <ThemedText style={[styles.sectionLabel, {color: colors.textMuted}]}>{title}</ThemedText>
            <View style={styles.chipRow}>
                {options.map(({value, label}) => {
                    const selected = selectedValue === value;
                    return (
                        <Pressable
                            key={String(value) || 'all'}
                            accessibilityRole="button"
                            accessibilityState={{selected}}
                            onPress={() => onSelect(value)}
                            style={({pressed}) => [
                                styles.chip,
                                {
                                    backgroundColor: selected ? colors.accent : colors.surfaceSunken,
                                    borderColor: selected ? colors.accent : colors.border,
                                    opacity: pressed ? 0.85 : 1,
                                },
                            ]}
                        >
                            <ThemedText
                                style={[
                                    styles.chipLabel,
                                    {
                                        color: selected ? colors.onAccent : colors.text,
                                        fontWeight: selected ? '700' : '500'
                                    },
                                ]}
                            >
                                {label}
                            </ThemedText>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

export function MovieFilterModal({
                                     visible,
                                     onClose,
                                     filters,
                                     onFiltersChange,
                                     onApply,
                                     onClear,
                                     bottomInset,
                                 }: MovieFilterModalProps) {
    const {height: windowHeight} = useWindowDimensions();
    const {isLarge} = useResponsive();
    const {colors} = usePalette();

    // Drive the backdrop fade and the sheet slide/scale from one progress value
    // so the scrim fades in place instead of sliding up with the sheet.
    const [mounted, setMounted] = useState(visible);
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setMounted(true);
            Animated.timing(progress, {toValue: 1, duration: 260, useNativeDriver: true}).start();
        } else {
            Animated.timing(progress, {toValue: 0, duration: 200, useNativeDriver: true}).start(({finished}) => {
                if (finished) setMounted(false);
            });
        }
    }, [visible, progress]);

    const handleApply = () => {
        onApply(filters);
        onClose();
    };

    const handleReset = () => {
        onClear();
        onClose();
    };

    if (!mounted) return null;

    const translateY = progress.interpolate({inputRange: [0, 1], outputRange: [windowHeight * 0.5, 0]});
    const sheetScale = progress.interpolate({inputRange: [0, 1], outputRange: [0.96, 1]});
    const sheetTransform = isLarge ? [{scale: sheetScale}] : [{translateY}];

    return (
        <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
            <View style={[styles.root, isLarge && styles.rootCentered]}>
                <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, {opacity: progress}]}
                               pointerEvents="none"/>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close filters"/>
                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            maxHeight: windowHeight * 0.88,
                            opacity: isLarge ? progress : 1,
                            transform: sheetTransform,
                        },
                        isLarge ? styles.sheetCentered : styles.sheetBottom,
                    ]}
                >
                    {!isLarge ?
                        <View style={[styles.dragIndicator, {backgroundColor: colors.textMuted + '55'}]}/> : null}
                    <View style={styles.header}>
                        <ThemedText type="heading">Filters</ThemedText>
                        <Pressable onPress={handleReset} hitSlop={8} accessibilityRole="button"
                                   style={({pressed}) => ({opacity: pressed ? 0.6 : 1})}>
                            <ThemedText style={[styles.resetLabel, {color: colors.accent}]}>Reset</ThemedText>
                        </Pressable>
                    </View>

                    <View style={styles.scrollWrap}>
                        <ScrollView
                            style={styles.scrollView}
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            <FilterChipGroup
                                title="Quality"
                                options={QUALITY_OPTIONS}
                                selectedValue={filters.quality ?? Quality.All}
                                onSelect={(value) =>
                                    onFiltersChange({
                                        ...filters,
                                        quality: value === Quality.All ? undefined : (value as Quality)
                                    })
                                }
                            />
                            <FilterChipGroup
                                title="Minimum rating"
                                options={RATING_OPTIONS}
                                selectedValue={filters.minimum_rating ?? 0}
                                onSelect={(value) =>
                                    onFiltersChange({
                                        ...filters,
                                        minimum_rating: value === 0 ? undefined : Number(value)
                                    })
                                }
                            />
                            <FilterChipGroup
                                title="Genre"
                                options={GENRE_OPTIONS}
                                selectedValue={filters.genre ?? Genre.All}
                                onSelect={(value) =>
                                    onFiltersChange({
                                        ...filters,
                                        genre: value === Genre.All ? undefined : (value as Genre)
                                    })
                                }
                            />
                            <FilterChipGroup
                                title="Sort by"
                                options={SORT_BY_OPTIONS}
                                selectedValue={filters.sort_by ?? SortBy.DateAdded}
                                onSelect={(value) => onFiltersChange({...filters, sort_by: value as SortBy})}
                            />
                            <FilterChipGroup
                                title="Order"
                                options={ORDER_OPTIONS}
                                selectedValue={filters.order_by ?? OrderBy.Desc}
                                onSelect={(value) => onFiltersChange({...filters, order_by: value as OrderBy})}
                            />
                        </ScrollView>
                        {/* Bottom fade cues that the list scrolls. */}
                        <LinearGradient
                            colors={[colors.surface + '00', colors.surface]}
                            bands={10}
                            style={styles.scrollFade}
                            pointerEvents="none"
                        />
                    </View>

                    <View style={[styles.footer, {
                        paddingBottom: (isLarge ? 16 : bottomInset + 16),
                        borderTopColor: colors.border
                    }]}>
                        <Pressable onPress={handleApply} accessibilityRole="button"
                                   style={({pressed}) => ({opacity: pressed ? 0.9 : 1})}>
                            <View style={[styles.applyButton, {backgroundColor: colors.accent}]}>
                                <ThemedText style={[styles.applyButtonLabel, {color: colors.onAccent}]}>Apply
                                    filters</ThemedText>
                            </View>
                        </Pressable>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {flex: 1, justifyContent: 'flex-end'},
    rootCentered: {justifyContent: 'center', alignItems: 'center', padding: 24},
    scrim: {backgroundColor: 'rgba(0, 0, 0, 0.55)'},
    sheet: {overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth},
    sheetBottom: {borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl},
    sheetCentered: {borderRadius: Radius.xl, width: '100%', maxWidth: 480},
    dragIndicator: {alignSelf: 'center', width: 38, height: 5, borderRadius: 3, marginTop: 10, marginBottom: 2},
    scrollWrap: {flexShrink: 1},
    scrollView: {flexShrink: 1},
    scrollContent: {paddingHorizontal: Spacing.xl, paddingTop: 4, paddingBottom: Spacing.xl},
    scrollFade: {position: 'absolute', left: 0, right: 0, bottom: 0, height: 36},
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.sm,
    },
    resetLabel: {fontSize: 16, fontWeight: '700'},
    section: {paddingVertical: Spacing.md},
    sectionLabel: {fontSize: 13, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5},
    chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
    chip: {borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 9},
    chipLabel: {fontSize: 14, lineHeight: 18},
    footer: {paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth},
    applyButton: {borderRadius: Radius.pill, paddingVertical: 15, alignItems: 'center', justifyContent: 'center'},
    applyButtonLabel: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
});
