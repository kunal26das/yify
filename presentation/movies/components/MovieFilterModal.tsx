import {
    BottomSheetFooter,
    BottomSheetModal,
    BottomSheetScrollView,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import type {BottomSheetFooterProps} from '@gorhom/bottom-sheet';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemedText} from '@/components/themed-text';
import {useThemeColor} from '@/hooks/use-theme-color';
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
import type {MovieFilters} from '@/presentation/movies/useMoviesViewModel';

interface MovieFilterModalProps {
    visible: boolean;
    onClose: () => void;
    filters: MovieFilters;
    onFiltersChange: (f: MovieFilters) => void;
    onApply: (filters: MovieFilters) => void;
    onClear: () => void;
}

function FilterSection({
                           title,
                           children,
                       }: {
    title: string;
    children: React.ReactNode;
}) {
    const textColor = useThemeColor({}, 'text');
    return (
        <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, {color: textColor}]}>
                {title}
            </ThemedText>
            {children}
        </View>
    );
}

function Chip({
                  label,
                  selected,
                  onPress,
              }: {
    label: string;
    selected: boolean;
    onPress: () => void;
}) {
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');
    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.chip,
                {borderColor: iconColor},
                selected && {backgroundColor: iconColor + '30'},
            ]}
        >
            <ThemedText
                style={[styles.chipLabel, {color: selected ? textColor : iconColor}]}
            >
                {label}
            </ThemedText>
        </Pressable>
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
    const backgroundColor = useThemeColor({}, 'background');
    const iconColor = useThemeColor({}, 'icon');
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const [footerHeight, setFooterHeight] = useState(80);

    const snapPoints = useMemo(() => ['85%'], []);

    useEffect(() => {
        if (visible) {
            bottomSheetRef.current?.present();
        } else {
            bottomSheetRef.current?.dismiss();
        }
    }, [visible]);

    const handleApply = () => {
        onApply(filters);
        onClose();
    };

    const renderFooter = useCallback(
        (props: BottomSheetFooterProps) => (
            <BottomSheetFooter {...props} bottomInset={insets.bottom}>
                <View
                    style={styles.footerContainer}
                    onLayout={(e) =>
                        setFooterHeight(e.nativeEvent.layout.height + insets.bottom)
                    }
                >
                    <Pressable
                        onPress={handleApply}
                        style={({pressed}) => [
                            styles.applyButton,
                            {backgroundColor: iconColor, opacity: pressed ? 0.8 : 1},
                        ]}
                    >
                        <Text style={styles.applyButtonLabel}>Apply filters</Text>
                    </Pressable>
                </View>
            </BottomSheetFooter>
        ),
        [iconColor, insets.bottom, handleApply]
    );

    return (
        <BottomSheetModal
            ref={bottomSheetRef}
            snapPoints={snapPoints}
            onDismiss={onClose}
            enablePanDownToClose
            backgroundStyle={{backgroundColor}}
            handleIndicatorStyle={styles.handleIndicator}
            footerComponent={renderFooter}
        >
            <BottomSheetScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: 16,
                        paddingBottom: footerHeight,
                    },
                ]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <ThemedText type="subtitle">Filters</ThemedText>
                    <Pressable
                        onPress={() => {
                            onClear();
                            onClose();
                        }}
                        hitSlop={12}
                    >
                        <ThemedText style={{color: iconColor}}>Reset</ThemedText>
                    </Pressable>
                </View>
                <FilterSection title="Quality">
                    <View style={styles.chipRow}>
                        {QUALITY_OPTIONS.map(({value, label}) => (
                            <Chip
                                key={value || 'all'}
                                label={label}
                                selected={(filters.quality ?? Quality.All) === value}
                                onPress={() =>
                                    onFiltersChange({
                                        ...filters,
                                        quality: value === Quality.All ? undefined : value,
                                    })
                                }
                            />
                        ))}
                    </View>
                </FilterSection>

                <FilterSection title="Minimum rating">
                    <View style={styles.chipRow}>
                        {RATING_OPTIONS.map(({value, label}) => (
                            <Chip
                                key={value}
                                label={label}
                                selected={(filters.minimum_rating ?? 0) === value}
                                onPress={() =>
                                    onFiltersChange({
                                        ...filters,
                                        minimum_rating: value === 0 ? undefined : value,
                                    })
                                }
                            />
                        ))}
                    </View>
                </FilterSection>

                <FilterSection title="Genre">
                    <View style={styles.chipRow}>
                        {GENRE_OPTIONS.map(({value, label}) => (
                            <Chip
                                key={value || 'all'}
                                label={label}
                                selected={(filters.genre ?? Genre.All) === value}
                                onPress={() =>
                                    onFiltersChange({
                                        ...filters,
                                        genre: value === Genre.All ? undefined : value,
                                    })
                                }
                            />
                        ))}
                    </View>
                </FilterSection>

                <FilterSection title="Sort by">
                    <View style={styles.chipRow}>
                        {SORT_BY_OPTIONS.map(({value, label}) => (
                            <Chip
                                key={value}
                                label={label}
                                selected={(filters.sort_by ?? SortBy.DateAdded) === value}
                                onPress={() =>
                                    onFiltersChange({
                                        ...filters,
                                        sort_by: value,
                                    })
                                }
                            />
                        ))}
                    </View>
                </FilterSection>

                <FilterSection title="Order">
                    <View style={styles.chipRow}>
                        {ORDER_OPTIONS.map(({value, label}) => (
                            <Chip
                                key={value}
                                label={label}
                                selected={(filters.order_by ?? OrderBy.Desc) === value}
                                onPress={() =>
                                    onFiltersChange({
                                        ...filters,
                                        order_by: value,
                                    })
                                }
                            />
                        ))}
                    </View>
                </FilterSection>
            </BottomSheetScrollView>
        </BottomSheetModal>
    );
}

const styles = StyleSheet.create({
    handleIndicator: {
        backgroundColor: 'rgba(128,128,128,0.4)',
        width: 36,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 16,
        marginBottom: 8,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 16,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 10,
        opacity: 0.8,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    chipLabel: {
        fontSize: 14,
    },
    footerContainer: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
    },
    applyButton: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    applyButtonLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
