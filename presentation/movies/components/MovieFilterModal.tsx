import {useCallback, useEffect, useMemo, useRef} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent} from 'react-native';
import {
    BottomSheetBackdrop,
    BottomSheetFooter,
    BottomSheetModal,
    BottomSheetScrollView,
    type BottomSheetBackdropProps,
    type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import Reanimated from 'react-native-reanimated';
import {Duration, PressableScale, enterPop, enterRise} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {LinearGradient} from '../../components/linear-gradient';
import {usePalette} from '../../hooks/use-palette';
import {useResponsive} from '../../hooks/use-responsive';
import {Radius, Spacing} from '../../constants/theme';
import {FEED_CHIPS} from '../constants/feedChips';
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
                                                        index = 0,
                                                    }: FilterChipGroupProps<T> & {index?: number}) {
    const {colors} = usePalette();

    return (
        <Reanimated.View entering={enterRise(index)} style={styles.section}>
            <ThemedText style={[styles.sectionLabel, {color: colors.textMuted}]}>{title}</ThemedText>
            <View style={styles.chipRow}>
                {options.map(({value, label}, i) => {
                    const selected = selectedValue === value;
                    return (
                        <Reanimated.View key={String(value) || 'all'} entering={enterPop(i)}>
                            <PressableScale
                                accessibilityRole="button"
                                accessibilityState={{selected}}
                                onPress={() => onSelect(value)}
                                pressedScale={0.93}
                                pressedOpacity={0.85}
                                hoveredScale={1.05}
                                contentStyle={[
                                    styles.chip,
                                    {
                                        backgroundColor: selected ? colors.accent : colors.surfaceSunken,
                                        borderColor: selected ? colors.accent : colors.border,
                                        transitionProperty: ['backgroundColor', 'borderColor'],
                                        transitionDuration: Duration.fast,
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
                            </PressableScale>
                        </Reanimated.View>
                    );
                })}
            </View>
        </Reanimated.View>
    );
}

const COLLECTION_OPTIONS = FEED_CHIPS.filter((chip) => !chip.key.startsWith('genre-')).map(
    (chip) => ({value: chip.key, label: chip.label})
);

const SNAP_POINTS = ['60%', '90%'];

function collectionValue(filters: {quality?: string; minimum_rating?: number; sort_by?: string; order_by?: string}): string {
    const match = FEED_CHIPS.filter((chip) => !chip.key.startsWith('genre-')).find(
        (chip) =>
            chip.query.sort_by === filters.sort_by &&
            chip.query.order_by === filters.order_by &&
            (chip.query.quality || undefined) === (filters.quality || undefined) &&
            (chip.query.minimum_rating ?? undefined) === (filters.minimum_rating ?? undefined)
    );
    return match?.key ?? '';
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
    const {isLarge} = useResponsive();
    const {colors} = usePalette();

    const sheetRef = useRef<BottomSheetModal>(null);
    const presentedRef = useRef(false);

    useEffect(() => {
        if (visible === presentedRef.current) return;
        presentedRef.current = visible;
        if (visible) sheetRef.current?.present();
        else sheetRef.current?.dismiss();
    }, [visible]);

    const handleDismiss = useCallback(() => {
        presentedRef.current = false;
        onClose();
    }, [onClose]);

    const handleApply = useCallback(() => {
        onApply(filters);
        onClose();
    }, [filters, onApply, onClose]);

    const handleReset = useCallback(() => {
        onClear();
        onClose();
    }, [onClear, onClose]);

    const renderFooter = useCallback(
        (props: BottomSheetFooterProps) => (
            <BottomSheetFooter {...props}>
                <LinearGradient
                    colors={[colors.surfaceElevated + '00', colors.surfaceElevated]}
                    bands={10}
                    style={styles.scrollFade}
                    pointerEvents="none"
                />
                <View style={[styles.footer, {
                    backgroundColor: colors.surfaceElevated,
                    paddingBottom: (isLarge ? Spacing.lg : bottomInset + Spacing.lg),
                    borderTopColor: colors.border
                }]}>
                    <PressableScale onPress={handleApply} accessibilityRole="button"
                                    pressedScale={0.97} pressedOpacity={0.9} hoveredScale={1.01}>
                        <View style={[styles.applyButton, {backgroundColor: colors.accent}]}>
                            <ThemedText style={[styles.applyButtonLabel, {color: colors.onAccent}]}>Apply
                                filters</ThemedText>
                        </View>
                    </PressableScale>
                </View>
            </BottomSheetFooter>
        ),
        [bottomInset, colors.accent, colors.border, colors.onAccent, colors.surfaceElevated, handleApply, isLarge]
    );

    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                opacity={1}
                pressBehavior="close"
                accessibilityLabel="Close filters"
                style={[props.style, {backgroundColor: colors.scrim}]}
            />
        ),
        [colors.scrim]
    );

    const backgroundStyle = useMemo(
        () => [styles.sheetBackground, {backgroundColor: colors.surfaceElevated}],
        [colors.surfaceElevated]
    );

    const handleIndicatorStyle = useMemo(
        () => [styles.handleIndicator, {backgroundColor: colors.borderStrong}],
        [colors.borderStrong]
    );

    const groups = (
        <>
            <FilterChipGroup
                title="Collections"
                index={0}
                options={COLLECTION_OPTIONS}
                selectedValue={collectionValue(filters)}
                onSelect={(value) => {
                    const chip = FEED_CHIPS.find((c) => c.key === value);
                    if (!chip) return;
                    onFiltersChange({
                        ...filters,
                        sort_by: chip.query.sort_by,
                        order_by: chip.query.order_by,
                        quality: chip.query.quality || undefined,
                        minimum_rating: chip.query.minimum_rating,
                    });
                }}
            />
            <FilterChipGroup
                title="Quality"
                index={1}
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
                index={2}
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
                index={3}
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
                index={4}
                options={SORT_BY_OPTIONS}
                selectedValue={filters.sort_by ?? SortBy.DateAdded}
                onSelect={(value) => onFiltersChange({...filters, sort_by: value as SortBy})}
            />
            <FilterChipGroup
                title="Order"
                index={5}
                options={ORDER_OPTIONS}
                selectedValue={filters.order_by ?? OrderBy.Desc}
                onSelect={(value) => onFiltersChange({...filters, order_by: value as OrderBy})}
            />
        </>
    );

    const header = (
        <View style={styles.header}>
            <ThemedText type="heading">Filters</ThemedText>
            <PressableScale onPress={handleReset} hitSlop={8} accessibilityRole="button"
                            pressedScale={0.92} pressedOpacity={0.6} hoveredScale={1.05}>
                <ThemedText style={[styles.resetLabel, {color: colors.accent}]}>Reset</ThemedText>
            </PressableScale>
        </View>
    );

    if (isLarge) {
        return (
            <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
                <Pressable
                    style={[styles.dialogRoot, {backgroundColor: colors.scrim}]}
                    accessibilityLabel="Close filters"
                    onPress={onClose}
                >
                    <Pressable
                        style={[styles.dialog, {backgroundColor: colors.surfaceElevated}]}
                        onPress={(event: GestureResponderEvent) => event.stopPropagation()}
                    >
                        {header}
                        <ScrollView
                            style={styles.scrollView}
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {groups}
                        </ScrollView>
                        <View
                            style={[
                                styles.footer,
                                {
                                    backgroundColor: colors.surfaceElevated,
                                    paddingBottom: Spacing.lg,
                                    borderTopColor: colors.border,
                                },
                            ]}
                        >
                            <PressableScale onPress={handleApply} accessibilityRole="button"
                                            pressedScale={0.97} pressedOpacity={0.9} hoveredScale={1.01}>
                                <View style={[styles.applyButton, {backgroundColor: colors.accent}]}>
                                    <ThemedText style={[styles.applyButtonLabel, {color: colors.onAccent}]}>
                                        Apply filters
                                    </ThemedText>
                                </View>
                            </PressableScale>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        );
    }

    return (
        <BottomSheetModal
            ref={sheetRef}
            snapPoints={SNAP_POINTS}
            index={0}
            enablePanDownToClose
            enableDynamicSizing={false}
            onDismiss={handleDismiss}
            backdropComponent={renderBackdrop}
            footerComponent={renderFooter}
            backgroundStyle={backgroundStyle}
            handleIndicatorStyle={handleIndicatorStyle}
            accessibilityLabel="Filters"
        >
            <View style={styles.content}>
                {header}

                <BottomSheetScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    enableFooterMarginAdjustment
                >
                    {groups}
                </BottomSheetScrollView>
            </View>
        </BottomSheetModal>
    );
}

const styles = StyleSheet.create({
    sheetBackground: {
        borderTopLeftRadius: Radius.xl,
        borderTopRightRadius: Radius.xl,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
    },
    handleIndicator: {width: 38, height: 5, borderRadius: 3},
    content: {flex: 1},
    scrollView: {flex: 1},
    scrollContent: {paddingHorizontal: Spacing.xl, paddingTop: 4, paddingBottom: Spacing.xl},
    scrollFade: {position: 'absolute', left: 0, right: 0, top: -36, height: 36},
    dialogRoot: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl},
    dialog: {width: '100%', maxWidth: 480, maxHeight: '86%', borderRadius: Radius.xl, overflow: 'hidden'},
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.sm,
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
