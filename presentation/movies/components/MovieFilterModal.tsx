import { BottomSheet, Button, Host, Picker, RNHostView } from '@expo/ui';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
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
} from '@/presentation/movies/constants/movieFilterOptions';
import type { MovieFilters } from '@/presentation/movies/useMoviesViewModel';

interface MovieFilterModalProps {
    visible: boolean;
    onClose: () => void;
    filters: MovieFilters;
    onFiltersChange: (f: MovieFilters) => void;
    onApply: (filters: MovieFilters) => void;
    onClear: () => void;
}

function FilterRow({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <View style={styles.row}>
            <ThemedText style={styles.rowLabel}>{title}</ThemedText>
            <View style={styles.rowControl}>{children}</View>
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
    const textColor = useThemeColor({}, 'text');

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
            <RNHostView>
            <View style={styles.flex}>
            <ScrollView
                style={styles.flex}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: insets.bottom + 96 },
                ]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <ThemedText type="subtitle">Filters</ThemedText>
                    <Host matchContents style={styles.headerButtonHost}>
                        <Button variant="text" label="Reset" onPress={handleReset} />
                    </Host>
                </View>

                <FilterRow title="Quality">
                    <Host matchContents style={styles.pickerHost}>
                        <Picker
                            selectedValue={(filters.quality ?? Quality.All) as string}
                            onValueChange={(value: string | number) =>
                                onFiltersChange({
                                    ...filters,
                                    quality:
                                        (value as Quality) === Quality.All
                                            ? undefined
                                            : (value as Quality),
                                })
                            }
                        >
                            {QUALITY_OPTIONS.map(({ value, label }) => (
                                <Picker.Item
                                    key={value || 'all'}
                                    label={label}
                                    value={value}
                                />
                            ))}
                        </Picker>
                    </Host>
                </FilterRow>

                <FilterRow title="Minimum rating">
                    <Host matchContents style={styles.pickerHost}>
                        <Picker
                            selectedValue={filters.minimum_rating ?? 0}
                            onValueChange={(value: string | number) =>
                                onFiltersChange({
                                    ...filters,
                                    minimum_rating:
                                        Number(value) === 0
                                            ? undefined
                                            : Number(value),
                                })
                            }
                        >
                            {RATING_OPTIONS.map(({ value, label }) => (
                                <Picker.Item
                                    key={value}
                                    label={label}
                                    value={value}
                                />
                            ))}
                        </Picker>
                    </Host>
                </FilterRow>

                <FilterRow title="Genre">
                    <Host matchContents style={styles.pickerHost}>
                        <Picker
                            selectedValue={(filters.genre ?? Genre.All) as string}
                            onValueChange={(value: string | number) =>
                                onFiltersChange({
                                    ...filters,
                                    genre:
                                        (value as Genre) === Genre.All
                                            ? undefined
                                            : (value as Genre),
                                })
                            }
                        >
                            {GENRE_OPTIONS.map(({ value, label }) => (
                                <Picker.Item
                                    key={value || 'all'}
                                    label={label}
                                    value={value}
                                />
                            ))}
                        </Picker>
                    </Host>
                </FilterRow>

                <FilterRow title="Sort by">
                    <Host matchContents style={styles.pickerHost}>
                        <Picker
                            selectedValue={(filters.sort_by ?? SortBy.DateAdded) as string}
                            onValueChange={(value: string | number) =>
                                onFiltersChange({
                                    ...filters,
                                    sort_by: value as SortBy,
                                })
                            }
                        >
                            {SORT_BY_OPTIONS.map(({ value, label }) => (
                                <Picker.Item
                                    key={value}
                                    label={label}
                                    value={value}
                                />
                            ))}
                        </Picker>
                    </Host>
                </FilterRow>

                <FilterRow title="Order">
                    <Host matchContents style={styles.pickerHost}>
                        <Picker
                            selectedValue={(filters.order_by ?? OrderBy.Desc) as string}
                            onValueChange={(value: string | number) =>
                                onFiltersChange({
                                    ...filters,
                                    order_by: value as OrderBy,
                                })
                            }
                        >
                            {ORDER_OPTIONS.map(({ value, label }) => (
                                <Picker.Item
                                    key={value}
                                    label={label}
                                    value={value}
                                />
                            ))}
                        </Picker>
                    </Host>
                </FilterRow>
            </ScrollView>

            <View
                style={[
                    styles.footer,
                    {
                        paddingBottom: insets.bottom + 16,
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
    flex: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 12,
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
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
    },
    rowLabel: {
        fontSize: 16,
        flexShrink: 0,
    },
    rowControl: {
        flex: 1,
        alignItems: 'flex-end',
    },
    pickerHost: {
        minWidth: 120,
    },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 20,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    applyButtonHost: {
        width: '100%',
    },
});
