import { BottomSheet, Button, Host, RNHostView } from '@expo/ui';
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    useColorScheme,
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText, useThemeColor } from '@/presentation';
import {
    Genre,
    GENRE_OPTIONS,
    OrderBy,
    ORDER_OPTIONS,
    Quality,
    QUALITY_OPTIONS,
    RATING_OPTIONS,
    SortBy,
    SORT_BY_OPTIONS,
} from '../constants/movieFilterOptions';
import type { MovieFilters } from '@/presentation';

interface MovieFilterModalProps {
    visible: boolean;
    onClose: () => void;
    filters: MovieFilters;
    onFiltersChange: (f: MovieFilters) => void;
    onApply: (filters: MovieFilters) => void;
    onClear: () => void;
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
                {options.map(({ value, label }) => {
                    const selected = selectedValue === value;
                    return (
                        <Pressable
                            key={String(value) || 'all'}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
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
                                    selected && { color: accentColor, fontWeight: '600' },
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
}: MovieFilterModalProps) {
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const textColor = useThemeColor({}, 'text');
    const backgroundColor = useThemeColor({}, 'background');
    const footerBottomPadding =
        (Platform.OS === 'android' ? Math.max(insets.bottom, 24) : insets.bottom) + 16;
    const androidScrollMaxHeight =
        Platform.OS === 'android'
            ? windowHeight - 72 - 88 - footerBottomPadding
            : undefined;

    const handleApply = () => {
        onApply(filters);
        onClose();
    };

    const handleReset = () => {
        onClear();
        onClose();
    };

    return (
        <BottomSheet
            isPresented={visible}
            onDismiss={onClose}
            snapPoints={['full']}
            showDragIndicator
        >
            <RNHostView style={styles.host}>
            <View style={styles.container}>
            <ScrollView
                style={[
                    styles.scrollView,
                    androidScrollMaxHeight != null && { maxHeight: androidScrollMaxHeight },
                ]}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={Platform.OS === 'android'}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.header}>
                    <ThemedText type="subtitle">Filters</ThemedText>
                    <Host matchContents style={styles.headerButtonHost}>
                        <Button variant="text" label="Reset" onPress={handleReset} />
                    </Host>
                </View>

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
                        backgroundColor,
                        paddingBottom: footerBottomPadding,
                        borderTopColor: textColor + '20',
                    },
                ]}
            >
                <Host matchContents style={styles.applyButtonHost}>
                    <Button variant="filled" label="Apply filters" onPress={handleApply} />
                </Host>
            </View>
            </View>
            </RNHostView>
        </BottomSheet>
    );
}

const styles = StyleSheet.create({
    host: {
        flex: 1,
        minHeight: 0,
        width: '100%',
    },
    container: {
        flex: 1,
        minHeight: 0,
    },
    scrollView: {
        flex: 1,
        minHeight: 0,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 12,
        marginBottom: 8,
    },
    headerButtonHost: {
        alignSelf: 'flex-end',
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
    applyButtonHost: {
        width: '100%',
    },
});
