import {Modal, Pressable, ScrollView, StyleSheet, useColorScheme, useWindowDimensions, View,} from 'react-native';
import {ThemedText} from '../../components/themed-text';
import {useDeviceCornerRadius} from '../../hooks/use-device-corner-radius';
import {useThemeColor} from '../../hooks/use-theme-color';
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

function FilterChipGroup<T extends string | number>(
    {
        title,
        options,
        selectedValue,
        onSelect,
    }: FilterChipGroupProps<T>) {
    const colorScheme = useColorScheme();
    const chipBackground =
        colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(17, 24, 28, 0.06)';
    const selectedBackground =
        colorScheme === 'dark' ? 'rgba(10, 126, 164, 0.35)' : 'rgba(10, 126, 164, 0.14)';
    const accentColor = colorScheme === 'dark' ? '#6ec8e8' : '#0a7ea4';

    return (
        <View style={styles.section}>
            <ThemedText style={styles.sectionLabel}>{title}</ThemedText>
            <View style={styles.chipRow}>
                {options.map(({value, label}) => {
                    const selected = selectedValue === value;
                    return (
                        <Pressable
                            key={String(value) || 'all'}
                            accessibilityRole="button"
                            accessibilityState={{selected}}
                            onPress={() => onSelect(value)}
                            style={[
                                styles.chip,
                                {
                                    backgroundColor: selected ? selectedBackground : chipBackground,
                                    borderColor: selected ? accentColor : 'transparent',
                                },
                            ]}
                        >
                            <ThemedText
                                style={[
                                    styles.chipLabel,
                                    selected && {color: accentColor, fontWeight: '600'},
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

export function MovieFilterModal(
    {
        visible,
        onClose,
        filters,
        onFiltersChange,
        onApply,
        onClear,
        bottomInset,
    }: MovieFilterModalProps) {
    const {height: windowHeight} = useWindowDimensions();
    const textColor = useThemeColor({}, 'text');
    const backgroundColor = useThemeColor({}, 'background');
    const cornerRadius = useDeviceCornerRadius();
    const colorScheme = useColorScheme();
    const accentColor = colorScheme === 'dark' ? '#6ec8e8' : '#0a7ea4';

    const handleApply = () => {
        onApply(filters);
        onClose();
    };

    const handleReset = () => {
        onClear();
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={styles.backdrop}>
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={onClose}
                    accessibilityLabel="Close filters"
                />
                <View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor,
                            maxHeight: windowHeight * 0.9,
                            borderTopLeftRadius: cornerRadius,
                            borderTopRightRadius: cornerRadius,
                        },
                    ]}
                >
                    <View style={[styles.dragIndicator, {backgroundColor: textColor + '40'}]}/>
                    <View style={[styles.header, {padding: Math.max(16, cornerRadius / 3)}]}>
                        <ThemedText type="subtitle">Filters</ThemedText>
                        <Pressable
                            onPress={handleReset}
                            hitSlop={8}
                            accessibilityRole="button"
                            style={({pressed}) => ({opacity: pressed ? 0.6 : 1})}
                        >
                            <ThemedText style={[styles.resetLabel, {color: accentColor}]}>
                                Reset
                            </ThemedText>
                        </Pressable>
                    </View>

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
                                    quality: value === Quality.All ? undefined : (value as Quality),
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
                                    minimum_rating: value === 0 ? undefined : Number(value),
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
                                    genre: value === Genre.All ? undefined : (value as Genre),
                                })
                            }
                        />

                        <FilterChipGroup
                            title="Sort by"
                            options={SORT_BY_OPTIONS}
                            selectedValue={filters.sort_by ?? SortBy.DateAdded}
                            onSelect={(value) =>
                                onFiltersChange({
                                    ...filters,
                                    sort_by: value as SortBy,
                                })
                            }
                        />

                        <FilterChipGroup
                            title="Order"
                            options={ORDER_OPTIONS}
                            selectedValue={filters.order_by ?? OrderBy.Desc}
                            onSelect={(value) =>
                                onFiltersChange({
                                    ...filters,
                                    order_by: value as OrderBy,
                                })
                            }
                        />
                    </ScrollView>

                    <View
                        style={[
                            styles.footer,
                            {
                                paddingBottom: bottomInset + 16,
                                borderTopColor: textColor + '20',
                            },
                        ]}
                    >
                        <Pressable
                            onPress={handleApply}
                            accessibilityRole="button"
                            style={({pressed}) => [styles.applyButton, {opacity: pressed ? 0.85 : 1}]}
                        >
                            <ThemedText style={styles.applyButtonLabel}>Apply filters</ThemedText>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    sheet: {
        overflow: 'hidden',
    },
    dragIndicator: {
        alignSelf: 'center',
        width: 36,
        height: 5,
        borderRadius: 3,
        marginTop: 8,
        marginBottom: 4,
    },
    scrollView: {
        flexShrink: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    resetLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    section: {
        paddingVertical: 12,
    },
    sectionLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    chipLabel: {
        fontSize: 14,
        lineHeight: 18,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    applyButton: {
        backgroundColor: '#0a84ff',
        borderRadius: 999,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    applyButtonLabel: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
});
