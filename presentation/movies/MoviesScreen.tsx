import {Ionicons} from '@expo/vector-icons';
import {Image as ExpoImage} from 'expo-image';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
    FlatList,
    RefreshControl,
    StyleSheet,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native';
import Animated from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import type {Movie} from '@/domain';
import {Analytics} from '@/presentation/analytics/events';
import {useNewMoviesNotifier} from '../di/DependenciesContext';
import {PressableScale, enterFade, enterPop, enterRise, exitPop} from '../components/motion';
import {ThemedText} from '../components/themed-text';
import {Screen} from '../components/screen';
import {ThemedView} from '../components/themed-view';
import {Radius, Spacing, Typography} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';
import {useResponsive} from '../hooks/use-responsive';
import {ChipBar} from './components/ChipBar';
import {HoverCardHost} from './components/HoverCard';
import {MovieFilterModal} from './components/MovieFilterModal';
import {MoviePosterItem} from './components/MoviePosterItem';
import {PosterSkeleton} from './components/PosterSkeleton';
import {ScrollProgress} from './components/ScrollProgress';
import {SearchOverlay} from './components/SearchOverlay';
import {TopBar, useTopBarHeight, type NavKey} from './components/TopBar';
import {POSTER_GAP, POSTER_MIN_WIDTH} from './components/moviePosterLayout';
import {FEED_CHIPS, chipFor} from './constants/feedChips';
import {OrderBy, SortBy} from '@/domain';
import type {MovieFilters, MoviesViewModel} from './useMoviesViewModel';

interface MoviesScreenProps {
    viewModel: MoviesViewModel;
    autoFocus?: boolean;
}

type SkeletonItem = {__skeleton: true; id: string};
type GridItem = Movie | SkeletonItem;

const CHIP_ROW_HEIGHT = 56;
const SCROLL_AT_TOP_THRESHOLD = 8;

function isSkeleton(item: GridItem): item is SkeletonItem {
    return (item as SkeletonItem).__skeleton === true;
}

function hasSelector(filters: MovieFilters): boolean {
    return filters.genre != null || filters.quality != null || filters.minimum_rating != null;
}

function chipMatches(query: MovieFilters, applied: MovieFilters): boolean {
    if (query.genre !== applied.genre) return false;
    if (query.quality !== applied.quality) return false;
    if (query.minimum_rating !== applied.minimum_rating) return false;
    if (hasSelector(query)) return true;
    return query.sort_by === applied.sort_by && query.order_by === applied.order_by;
}



function activeChipKey(applied: MovieFilters): string {
    if (Object.values(applied).every((value) => value == null)) return 'all';
    return FEED_CHIPS.find((chip) => chipMatches(chip.query, applied))?.key ?? '';
}

export function MoviesScreen({viewModel, autoFocus}: MoviesScreenProps) {
    const newMovies = useNewMoviesNotifier();
    const insets = useSafeAreaInsets();
    const {colors} = usePalette();
    const {width, contentMaxWidth, isLarge, isPhone, gutter} = useResponsive();
    const {
        movies,
        totalMovieCount,
        loading,
        refreshing,
        error,
        hasMore,
        searchQuery,
        setSearchQuery,
        filters,
        setFilters,
        appliedFilters,
        applyFilters,
        clearFiltersAndReload,
        loadInitial,
        loadMore,
        appliedQuery,
    } = viewModel;

    const topBarHeight = useTopBarHeight();
    const listRef = useRef<FlatList<GridItem>>(null);
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [searchOverlayVisible, setSearchOverlayVisible] = useState(false);
    const [lastVisibleIndex, setLastVisibleIndex] = useState(0);
    const [isAtTop, setIsAtTop] = useState(true);
    const [pickedChip, setPickedChip] = useState<string | null>(null);
    const lastQueryRef = useRef(appliedQuery);
    const prevMoviesLengthRef = useRef(0);

    const gridWidth = Math.min(width, contentMaxWidth);
    const contentPad = Math.max(0, gutter - POSTER_GAP / 2);
    const gridInner = Math.max(0, gridWidth - contentPad * 2);
    const numColumns = useMemo(
        () => Math.max(2, Math.floor(gridInner / (POSTER_MIN_WIDTH + POSTER_GAP))),
        [gridInner]
    );
    const itemWidth = useMemo(
        () => Math.floor(gridInner / numColumns) - POSTER_GAP,
        [gridInner, numColumns]
    );

    const listTopPadding = topBarHeight + CHIP_ROW_HEIGHT + POSTER_GAP / 2;
    const listBottomPadding = insets.bottom + 96;
    const derivedChip = activeChipKey(appliedFilters);
    const activeChip =
        pickedChip && chipMatches(chipFor(pickedChip).query, appliedFilters) ? pickedChip : derivedChip;


    const activeFilterCount = [
        appliedFilters.quality,
        appliedFilters.genre,
        appliedFilters.minimum_rating,
    ].filter((value) => value != null).length;
    const activeNav: NavKey = 'movies';

    useEffect(() => {
        loadInitial();
    }, [loadInitial]);

    useEffect(() => {
        if (error) Analytics.loadError('browse');
    }, [error]);

    useEffect(() => {
        if (autoFocus && isPhone) setSearchOverlayVisible(true);
    }, [autoFocus, isPhone]);

    useEffect(() => {
        if (movies.length < prevMoviesLengthRef.current) setLastVisibleIndex(0);
        prevMoviesLengthRef.current = movies.length;
    }, [movies.length]);

    const prefetchedRef = useRef(0);
    useEffect(() => {
        if (movies.length <= prefetchedRef.current) {
            prefetchedRef.current = movies.length;
            return;
        }
        const fresh = movies.slice(prefetchedRef.current);
        prefetchedRef.current = movies.length;
        const urls = fresh
            .map((movie) => movie.posterUrls[Math.min(1, movie.posterUrls.length - 1)])
            .filter((url): url is string => !!url);
        if (urls.length) ExpoImage.prefetch(urls, {cachePolicy: 'memory-disk'});
    }, [movies]);

    const loadingMore = loading && !refreshing && hasMore && movies.length > 0;

    const gridData = useMemo<GridItem[]>(() => {
        if (!loadingMore) return movies;
        const remainder = movies.length % numColumns;
        const fillLastRow = remainder === 0 ? 0 : numColumns - remainder;
        const count = fillLastRow + numColumns;
        return [
            ...movies,
            ...Array.from({length: count}, (_, index) => ({__skeleton: true as const, id: `sk-${index}`})),
        ];
    }, [movies, loadingMore, numColumns]);

    const scrollToTop = useCallback(() => {
        listRef.current?.scrollToOffset({offset: 0, animated: true});
    }, []);

    const handleScrollToTop = useCallback(() => {
        Analytics.scrollToTop();
        scrollToTop();
    }, [scrollToTop]);

    const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        setIsAtTop(event.nativeEvent.contentOffset.y <= SCROLL_AT_TOP_THRESHOLD);
    }, []);

    const viewabilityConfig = useMemo(
        () => ({itemVisiblePercentThreshold: 10, minimumViewTime: 50}),
        []
    );

    const onViewableItemsChanged = useCallback(
        ({viewableItems}: {viewableItems: {index: number | null}[]}) => {
            const maxIndex = viewableItems.reduce(
                (acc, item) => (item.index != null && item.index > acc ? item.index : acc),
                -1
            );
            if (maxIndex >= 0) setLastVisibleIndex(maxIndex);
        },
        []
    );

    const handleEndReached = useCallback(() => {
        if (hasMore && !loading) {
            Analytics.browseLoadMore(movies.length);
            loadMore();
        }
    }, [hasMore, loading, loadMore, movies.length]);

    const handleRefresh = useCallback(() => {
        loadInitial();
        void newMovies.check(true);
    }, [loadInitial, newMovies]);

    const handleChipSelect = useCallback(
        (key: string) => {
            const chip = FEED_CHIPS.find((candidate) => candidate.key === key);
            if (!chip) return;
            setPickedChip(key);
            const next: MovieFilters = {
                genre: chip.query.genre,
                quality: chip.query.quality || undefined,
                minimum_rating: chip.query.minimum_rating,
                sort_by: chip.query.sort_by,
                order_by: chip.query.order_by,
            };
            Analytics.filtersApplied({
                genre: next.genre,
                quality: next.quality,
                minimum_rating: next.minimum_rating,
                sort_by: next.sort_by,
                order_by: next.order_by,
            });
            applyFilters(next);
            scrollToTop();
        },
        [appliedFilters, applyFilters, scrollToTop]
    );

    const handleClearFilters = useCallback(() => {
        Analytics.filtersReset();
        clearFiltersAndReload();
        scrollToTop();
    }, [clearFiltersAndReload, scrollToTop]);

    useEffect(() => {
        if (lastQueryRef.current === appliedQuery) return;
        lastQueryRef.current = appliedQuery;
        setLastVisibleIndex(0);
        listRef.current?.scrollToOffset({offset: 0, animated: true});
    }, [appliedQuery]);

    const handleSearchSubmit = useCallback(
        (term: string) => {
            setPickedChip(null);
            applyFilters({});
            setSearchQuery(term);
        },
        [applyFilters, setSearchQuery]
    );

    const openFilters = useCallback(() => {
        Analytics.filtersOpen();
        setFilterModalVisible(true);
    }, []);

    const renderItem = useCallback(
        ({item}: {item: GridItem}) =>
            isSkeleton(item) ? (
                <PosterSkeleton width={itemWidth}/>
            ) : (
                <MoviePosterItem movie={item} width={itemWidth} source="browse_grid"/>
            ),
        [itemWidth]
    );

    const keyExtractor = useCallback(
        (item: GridItem) => (isSkeleton(item) ? item.id : `m-${item.id}`),
        []
    );

    const chipRow = (
        <View style={[styles.chipRow, {height: CHIP_ROW_HEIGHT}]}>
            <View style={[styles.chipRowInner, isLarge && {maxWidth: contentMaxWidth}]}>
                <View style={styles.chipBarArea}>
                    <ChipBar chips={FEED_CHIPS} active={activeChip} onSelect={handleChipSelect} contentPadding={gutter}/>
                </View>
            </View>
        </View>
    );

    const topBar = (
        <TopBar
            active={activeNav}
            searchValue={searchQuery}
            onSearchSubmit={handleSearchSubmit}
            showSearch
            below={chipRow}
        />
    );

    const searchOverlay = (
        <SearchOverlay
            visible={searchOverlayVisible}
            initialQuery={searchQuery}
            onClose={() => setSearchOverlayVisible(false)}
            onSubmit={handleSearchSubmit}
        />
    );

    const filtersControl = (
        <PressableScale
            onPress={openFilters}
            accessibilityRole="button"
            accessibilityLabel="Filters"
            pressedScale={0.88}
            pressedOpacity={0.85}
            hoveredScale={1.08}
            hitSlop={8}
        >
            <View style={[styles.filtersCircle, {backgroundColor: colors.accent}]}>
                <Ionicons name="options" size={20} color={colors.onAccent}/>
                {activeFilterCount > 0 ? (
                    <Animated.View
                        entering={enterPop()}
                        exiting={exitPop}
                        style={[
                            styles.floatingBadge,
                            {backgroundColor: colors.onAccent, borderColor: colors.accent},
                        ]}
                    >
                        <ThemedText style={[styles.floatingBadgeText, {color: colors.accent}]}>
                            {activeFilterCount}
                        </ThemedText>
                    </Animated.View>
                ) : null}
            </View>
        </PressableScale>
    );

    if (loading && movies.length === 0 && !error) {
        return (
            <Screen overlays={<>{topBar}{searchOverlay}</>}>
                <View
                    style={[
                        styles.skeletonScreen,
                        {paddingHorizontal: contentPad},
                        {paddingTop: listTopPadding},
                        isLarge && {maxWidth: contentMaxWidth},
                    ]}
                >
                    <View style={styles.skeletonGrid}>
                        {Array.from({length: numColumns * 4}).map((_, index) => (
                            <PosterSkeleton key={index} width={itemWidth}/>
                        ))}
                    </View>
                </View>
            </Screen>
        );
    }

    if (error && movies.length === 0) {
        return (
            <Screen overlays={<>{topBar}{searchOverlay}</>}>
                <View style={[styles.errorScreen, {paddingTop: listTopPadding + Spacing.xxxl}]}>
                    <Animated.View entering={enterRise()} style={styles.stateBox}>
                        <Ionicons name="cloud-offline-outline" size={48} color={colors.textFaint}/>
                        <ThemedText style={[Typography.sectionTitle, styles.stateTitle, {color: colors.text}]}>
                            Something went wrong
                        </ThemedText>
                        <ThemedText style={[Typography.videoMeta, styles.stateMessage, {color: colors.textMuted}]}>
                            {error}
                        </ThemedText>
                        <PressableScale
                            onPress={() => {
                                Analytics.retry('browse');
                                loadInitial();
                            }}
                            accessibilityRole="button"
                            pressedScale={0.95}
                            pressedOpacity={0.85}
                            contentStyle={[styles.stateAction, {backgroundColor: colors.accent}]}
                        >
                            <Ionicons name="refresh" size={16} color={colors.onAccent}/>
                            <ThemedText style={[styles.stateActionLabel, {color: colors.onAccent}]}>
                                Try again
                            </ThemedText>
                        </PressableScale>
                    </Animated.View>
                </View>
            </Screen>
        );
    }

    const currentIndex = Math.min(lastVisibleIndex + 1, movies.length);

    return (
        <HoverCardHost>
            <Screen
                overlays={
                    <>
                        {topBar}
                        {searchOverlay}

                        <ScrollProgress
                            current={currentIndex}
                            total={totalMovieCount}
                            atTop={isAtTop}
                            onScrollToTop={handleScrollToTop}
                            trailing={filtersControl}
                            bottomInset={insets.bottom}
                            visible={movies.length > 0}
                        />

                        <MovieFilterModal
                            visible={filterModalVisible}
                            bottomInset={insets.bottom}
                            onClose={() => {
                                setFilters(appliedFilters);
                                setFilterModalVisible(false);
                            }}
                            filters={filters}
                            onFiltersChange={setFilters}
                            onApply={(applied: MovieFilters) => {
                                Analytics.filtersApplied({
                                    genre: applied.genre,
                                    quality: applied.quality,
                                    minimum_rating: applied.minimum_rating,
                                    sort_by: applied.sort_by,
                                    order_by: applied.order_by,
                                });
                                applyFilters(applied);
                                scrollToTop();
                            }}
                            onClear={handleClearFilters}
                        />
                    </>
                }
            >
                <FlatList
                    ref={listRef}
                    key={`grid-${numColumns}`}
                    style={[styles.list, isLarge && {maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%'}]}
                    data={gridData}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    numColumns={numColumns}
                    columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
                    ListHeaderComponent={
                        totalMovieCount != null && movies.length > 0 ? (
                            <Animated.View entering={enterFade()}>
                                <ThemedText style={[Typography.videoMeta, styles.countLine, {color: colors.textMuted}]}>
                                    About {totalMovieCount.toLocaleString()} results
                                </ThemedText>
                            </Animated.View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <Animated.View entering={enterRise()} style={styles.stateBox}>
                            <Ionicons name="search-outline" size={48} color={colors.textFaint}/>
                            <ThemedText style={[Typography.sectionTitle, styles.stateTitle, {color: colors.text}]}>
                                No results found
                            </ThemedText>
                            <ThemedText style={[Typography.videoMeta, styles.stateMessage, {color: colors.textMuted}]}>
                                Try different keywords, or clear the filters to see everything.
                            </ThemedText>
                            <PressableScale
                                onPress={handleClearFilters}
                                accessibilityRole="button"
                                pressedScale={0.95}
                                pressedOpacity={0.85}
                                contentStyle={[styles.stateOutlineAction, {borderColor: colors.border}]}
                            >
                                <ThemedText style={[styles.stateActionLabel, {color: colors.accent}]}>
                                    Clear filters
                                </ThemedText>
                            </PressableScale>
                        </Animated.View>
                    }
                    ListFooterComponent={
                        error && movies.length > 0 ? (
                            <Animated.View entering={enterFade()} style={styles.footer}>
                                <ThemedText style={[Typography.videoMeta, styles.stateMessage, {color: colors.textMuted}]}>
                                    Couldn&apos;t load more results.
                                </ThemedText>
                                <PressableScale
                                    onPress={() => {
                                        Analytics.retry('browse_more');
                                        loadMore();
                                    }}
                                    accessibilityRole="button"
                                    pressedScale={0.95}
                                    pressedOpacity={0.85}
                                    contentStyle={[styles.stateOutlineAction, {borderColor: colors.border}]}
                                >
                                    <ThemedText style={[styles.stateActionLabel, {color: colors.accent}]}>
                                        Try again
                                    </ThemedText>
                                </PressableScale>
                            </Animated.View>
                        ) : null
                    }
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={viewabilityConfig}
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={3}
                    initialNumToRender={numColumns * 4}
                    maxToRenderPerBatch={numColumns * 3}
                    updateCellsBatchingPeriod={40}
                    windowSize={11}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={colors.accent}
                            colors={[colors.accent]}
                            progressViewOffset={topBarHeight + CHIP_ROW_HEIGHT}
                        />
                    }
                    contentContainerStyle={[
                        styles.listContent,
                        {paddingHorizontal: contentPad},
                        {paddingTop: listTopPadding, paddingBottom: listBottomPadding},
                    ]}
                    showsVerticalScrollIndicator={false}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                />

            </Screen>
        </HoverCardHost>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1},
    list: {flex: 1},
    listContent: {flexGrow: 1},
    row: {flexDirection: 'row'},
    countLine: {
        fontWeight: '500',
        paddingHorizontal: POSTER_GAP / 2,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.sm,
    },

    chipRow: {},
    chipRowInner: {
        flex: 1,
        width: '100%',
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
    },
    chipBarArea: {flex: 1},
    filterBadge: {
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    filterBadgeText: {fontSize: 11, lineHeight: 14, fontWeight: '700'},

    filtersCircle: {
        width: 46,
        height: 46,
        borderRadius: 23,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 3},
        shadowOpacity: 0.16,
        shadowRadius: 8,
        elevation: 3,
    },
    floatingBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    floatingBadgeText: {fontSize: 11, lineHeight: 14, fontWeight: '800'},

    skeletonScreen: {flex: 1, width: '100%', alignSelf: 'center'},
    skeletonGrid: {flexDirection: 'row', flexWrap: 'wrap'},

    errorScreen: {flex: 1, alignItems: 'center'},
    stateBox: {alignItems: 'center', paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl, gap: Spacing.sm},
    stateTitle: {fontWeight: '700', marginTop: Spacing.sm},
    stateMessage: {textAlign: 'center', maxWidth: 360},
    stateAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        marginTop: Spacing.md,
    },
    stateOutlineAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        borderRadius: Radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        marginTop: Spacing.md,
    },
    stateActionLabel: {fontSize: 14, lineHeight: 18, fontWeight: '700'},
    footer: {alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.xs},
});
