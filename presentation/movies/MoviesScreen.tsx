import type {Movie} from '@/domain';
import type {MovieFilters, MoviesViewModel} from './useMoviesViewModel';
import {LiquidGlassGroup, LiquidGlassView} from '../components/liquid-glass-view';
import {LinearGradient} from '../components/linear-gradient';
import {ThemedText} from '../components/themed-text';
import {ThemedView} from '../components/themed-view';
import {usePalette} from '../hooks/use-palette';
import {useResponsive} from '../hooks/use-responsive';
import {FontFamily, Radius} from '../constants/theme';
import {Ionicons} from '@expo/vector-icons';
import {Image as ExpoImage} from 'expo-image';
import {router} from 'expo-router';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FlatList, InteractionManager, Platform, RefreshControl, StyleSheet, TextInput, View,} from 'react-native';
import Animated from 'react-native-reanimated';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Duration, PressableScale, enterPop, enterRise, exitPop} from '../components/motion';
import {checkForNewMovies} from '@/lib/new-movies-task';
import {MovieFilterModal} from './components/MovieFilterModal';
import {Analytics} from '@/lib/analytics-events';
import {MoviePosterItem} from './components/MoviePosterItem';
import {PosterSkeleton} from './components/PosterSkeleton';
import {POSTER_GAP, POSTER_MIN_WIDTH} from './components/moviePosterLayout';
import {INLINE_SEARCH_HEIGHT, SEARCH_ROW_HEIGHT, TopNav, useTopNavHeight, type NavKey} from './components/TopNav';
import {OrderBy, SortBy} from './constants/movieFilterOptions';

interface MoviesScreenProps {
    viewModel: MoviesViewModel;
    autoFocus?: boolean;
}

const SCROLL_AT_TOP_THRESHOLD = 8;

const INLINE_SEARCH_MIN_WIDTH = 720;

type SkeletonItem = {__skeleton: true; id: string};
type GridItem = Movie | SkeletonItem;
const isSkeleton = (item: GridItem): item is SkeletonItem =>
    (item as SkeletonItem).__skeleton === true;

export function MoviesScreen({viewModel, autoFocus}: MoviesScreenProps) {
    const insets = useSafeAreaInsets();
    const {colors, gradients, scheme} = usePalette();
    const {width, contentMaxWidth, isLarge, gutter} = useResponsive();
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

    const loggedQueryRef = useRef<string | null>(null);
    useEffect(() => {
        const q = appliedQuery.trim();
        if (loggedQueryRef.current === null) {
            loggedQueryRef.current = q;
            return;
        }
        if (q && q !== loggedQueryRef.current) Analytics.search(q);
        loggedQueryRef.current = q;
    }, [appliedQuery]);

    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [lastVisibleIndex, setLastVisibleIndex] = useState(0);
    const [isAtTop, setIsAtTop] = useState(true);
    const prevMoviesLengthRef = useRef(0);
    const listRef = useRef<FlatList>(null);
    const searchInputRef = useRef<TextInput>(null);

    const glassTint = scheme === 'dark' ? 'dark' : 'light';
    const gridWidth = Math.min(width, contentMaxWidth);
    const navHeight = useTopNavHeight();
    const inlineSearch = width >= INLINE_SEARCH_MIN_WIDTH;
    const searchRowHeight = inlineSearch ? 0 : SEARCH_ROW_HEIGHT;
    const listTopPadding = navHeight + searchRowHeight + POSTER_GAP / 2;
    const activeNav: NavKey =
        appliedFilters.sort_by === SortBy.DateAdded && appliedFilters.order_by === OrderBy.Desc
            ? 'new'
            : 'movies';

    const numColumns = useMemo(
        () => Math.max(2, Math.floor(gridWidth / (POSTER_MIN_WIDTH + POSTER_GAP))),
        [gridWidth]
    );

    const itemWidth = useMemo(() => {
        const available = gridWidth - POSTER_GAP;
        return Math.floor(available / numColumns) - POSTER_GAP;
    }, [gridWidth, numColumns]);

    const loadingMore = loading && !refreshing && hasMore && movies.length > 0;

    const gridData = useMemo<GridItem[]>(() => {
        if (!loadingMore) return movies;
        const remainder = movies.length % numColumns;
        const fillLastRow = remainder === 0 ? 0 : numColumns - remainder;
        const count = fillLastRow + numColumns;
        const skeletons: GridItem[] = Array.from({length: count}, (_, i) => ({
            __skeleton: true,
            id: `sk-${i}`,
        }));
        return [...movies, ...skeletons];
    }, [movies, loadingMore, numColumns]);

    const prefetchedRef = useRef(0);
    useEffect(() => {
        if (movies.length <= prefetchedRef.current) {
            prefetchedRef.current = movies.length;
            return;
        }
        const fresh = movies.slice(prefetchedRef.current);
        prefetchedRef.current = movies.length;
        const urls = fresh
            .map((m) => m.posterUrls[Math.min(1, m.posterUrls.length - 1)])
            .filter(Boolean) as string[];
        if (urls.length) ExpoImage.prefetch(urls, {cachePolicy: 'memory-disk'});
    }, [movies]);

    const onScroll = useCallback(
        ({nativeEvent}: { nativeEvent: { contentOffset: { y: number } } }) => {
            setIsAtTop(nativeEvent.contentOffset.y <= SCROLL_AT_TOP_THRESHOLD);
        },
        []
    );

    useEffect(() => {
        if (movies.length < prevMoviesLengthRef.current) setLastVisibleIndex(0);
        prevMoviesLengthRef.current = movies.length;
    }, [movies.length]);

    useEffect(() => {
        loadInitial();
    }, [loadInitial]);

    useEffect(() => {
        if (error) Analytics.loadError('browse');
    }, [error]);

    useEffect(() => {
        if (!autoFocus) return;
        const task = InteractionManager.runAfterInteractions(() => {
            searchInputRef.current?.focus();
        });
        return () => task.cancel();
    }, [autoFocus]);

    const handleEndReached = useCallback(() => {
        if (hasMore && !loading) {
            Analytics.browseLoadMore(movies.length);
            loadMore();
        }
    }, [hasMore, loading, loadMore, movies.length]);

    const handleRefresh = useCallback(() => {
        loadInitial();
        void checkForNewMovies(true);
    }, [loadInitial]);

    const renderItem = useCallback(
        ({item}: { item: GridItem }) =>
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

    const viewabilityConfig = useMemo(
        () => ({itemVisiblePercentThreshold: 10, minimumViewTime: 50}),
        []
    );

    const onViewableItemsChanged = useCallback(
        ({viewableItems}: { viewableItems: { index: number | null }[] }) => {
            const maxIndex = viewableItems.reduce(
                (acc, item) => (item.index != null && item.index > acc ? item.index : acc),
                -1
            );
            if (maxIndex >= 0) setLastVisibleIndex(maxIndex);
        },
        []
    );

    const searchField = (
        <View style={inlineSearch ? styles.searchFieldWrapperInline : styles.searchFieldWrapper}>
            <Ionicons name="search" size={inlineSearch ? 16 : 18} color={colors.textMuted} style={styles.searchIcon}/>
            <TextInput
                ref={searchInputRef}
                style={[
                    inlineSearch ? styles.searchInputInline : styles.searchInput,
                    {color: colors.text},
                    Platform.OS === 'web' ? ({outlineStyle: 'none'} as object) : null,
                ]}
                placeholder={inlineSearch ? 'Search movies…' : 'Search movies, genres, years…'}
                placeholderTextColor={colors.textFaint}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="never"
            />
            {searchQuery.length > 0 ? (
                <Animated.View entering={enterPop()} exiting={exitPop}>
                    <PressableScale
                        onPress={() => {
                            Analytics.searchCleared();
                            setSearchQuery('');
                        }}
                        pressedScale={0.85}
                        pressedOpacity={0.6}
                        hoveredScale={1.12}
                        contentStyle={styles.clearButton}
                        hitSlop={8}
                    >
                        <Ionicons name="close-circle" size={18} color={colors.textMuted}/>
                    </PressableScale>
                </Animated.View>
            ) : null}
        </View>
    );

    const InlineSearch = (
        <View style={[styles.inlineSearchPill, {backgroundColor: colors.surfaceSunken, borderColor: colors.border}]}>
            {searchField}
        </View>
    );

    const SearchField = (
        <View style={[styles.searchBarFixed, {paddingHorizontal: gutter}]} pointerEvents="box-none">
            <View
                style={[
                    isLarge && {maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%'},
                ]}
            >
                <View style={styles.searchRow}>
                    <View style={styles.searchPill}>{searchField}</View>
                </View>
            </View>
        </View>
    );

    const Nav = (
        <TopNav
            active={activeNav}
            below={inlineSearch ? undefined : SearchField}
            inline={inlineSearch ? InlineSearch : undefined}
        />
    );

    if (loading && movies.length === 0 && !error) {
        return (
            <ThemedView style={styles.container}>
                <AuroraGlow colors={gradients.accentSubtle} top={insets.top}/>
                <SafeAreaView style={styles.container} edges={[]}>
                    <View style={[styles.centeredContent, {
                        maxWidth: contentMaxWidth,
                        paddingTop: listTopPadding,
                    }]}>
                        <View style={styles.skeletonGrid}>
                            {Array.from({length: numColumns * 4}).map((_, i) => (
                                <PosterSkeleton key={i} width={itemWidth}/>
                            ))}
                        </View>
                    </View>
                </SafeAreaView>
                {Nav}
            </ThemedView>
        );
    }

    if (error && movies.length === 0) {
        return (
            <ThemedView style={styles.container}>
                <AuroraGlow colors={gradients.accentSubtle} top={insets.top}/>
                <SafeAreaView style={styles.centered} edges={['top']}>
                    <Animated.View entering={enterRise()} style={styles.stateBox}>
                        <Ionicons name="cloud-offline-outline" size={56} color={colors.textMuted}/>
                        <ThemedText type="heading" style={styles.stateTitle}>
                            Something went wrong
                        </ThemedText>
                        <ThemedText style={[styles.stateMessage, {color: colors.textMuted}]}>{error}</ThemedText>
                        <PressableScale
                            onPress={() => {
                                Analytics.retry('browse');
                                loadInitial();
                            }}
                            pressedScale={0.94}
                            pressedOpacity={0.85}
                            hoveredScale={1.03}
                        >
                            <View style={[styles.cta, {backgroundColor: colors.accent}]}>
                                <Ionicons name="refresh" size={18} color={colors.onAccent}/>
                                <ThemedText style={[styles.ctaLabel, {color: colors.onAccent}]}>Try again</ThemedText>
                            </View>
                        </PressableScale>
                    </Animated.View>
                </SafeAreaView>
                {Nav}
            </ThemedView>
        );
    }

    const activeFilterCount = [
        appliedFilters.quality,
        appliedFilters.genre,
        appliedFilters.minimum_rating,
    ].filter((v) => v != null).length;

    const currentIndex = Math.min(lastVisibleIndex + 1, movies.length);
    const isEmpty = movies.length === 0;

    return (
        <ThemedView style={styles.container}>
            <AuroraGlow colors={gradients.accentSubtle} top={insets.top}/>
            <SafeAreaView style={styles.container} edges={[]}>
                <FlatList
                    ref={listRef}
                    key={`grid-${numColumns}`}
                    style={[styles.list, isLarge && {maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%'}]}
                    data={gridData}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    numColumns={numColumns}
                    columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
                    ListEmptyComponent={
                        <Animated.View entering={enterRise()} style={styles.stateBox}>
                            <Ionicons name="search-outline" size={52} color={colors.textMuted}/>
                            <ThemedText type="heading" style={styles.stateTitle}>
                                Nothing matches yet
                            </ThemedText>
                            <ThemedText style={[styles.stateMessage, {color: colors.textMuted}]}>
                                Try another search, or reset the filters to see everything.
                            </ThemedText>
                        </Animated.View>
                    }
                    ListFooterComponent={
                        error ? (
                            <Animated.View entering={enterRise()} style={styles.footerError}>
                                <ThemedText style={[styles.stateMessage, {color: colors.textMuted}]}>
                                    Couldn&apos;t load more movies.
                                </ThemedText>
                                <PressableScale
                                    onPress={() => {
                                        Analytics.retry('browse_more');
                                        loadMore();
                                    }}
                                    accessibilityRole="button"
                                    pressedScale={0.94}
                                    pressedOpacity={0.85}
                                    hoveredScale={1.03}
                                >
                                    <View style={[styles.footerRetry, {borderColor: colors.border}]}>
                                        <Ionicons name="refresh" size={16} color={colors.accent}/>
                                        <ThemedText style={[styles.ctaLabel, {color: colors.accent}]}>
                                            Try again
                                        </ThemedText>
                                    </View>
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
                            progressViewOffset={navHeight + searchRowHeight}
                        />
                    }
                    contentContainerStyle={[
                        styles.listContent,
                        {paddingTop: listTopPadding, paddingBottom: insets.bottom + 96},
                    ]}
                    showsVerticalScrollIndicator={false}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                />

                {totalMovieCount != null && !isEmpty && (
                    <View style={[styles.countOverlay, {paddingBottom: insets.bottom + 16}]} pointerEvents="box-none">
                        <LiquidGlassGroup spacing={16} style={styles.countRow}>
                            <Animated.View
                                style={[
                                    styles.scrollToTopButton,
                                    {
                                        transform: [{scale: isAtTop ? 0 : 1}, {translateY: isAtTop ? 12 : 0}],
                                        opacity: isAtTop ? 0 : 1,
                                        transitionProperty: ['transform', 'opacity'],
                                        transitionDuration: Duration.base,
                                        transitionTimingFunction: 'ease-out',
                                    },
                                ]}
                                pointerEvents={isAtTop ? 'none' : 'auto'}
                            >
                                <PressableScale
                                    onPress={() => {
                                        Analytics.scrollToTop();
                                        listRef.current?.scrollToOffset({offset: 0, animated: true});
                                    }}
                                    pressedScale={0.88}
                                    pressedOpacity={0.6}
                                    hoveredScale={1.08}
                                    hitSlop={8}
                                >
                                    <LiquidGlassView
                                        tint={glassTint}
                                        fallbackBackgroundColor={scheme === 'dark' ? 'rgba(48,48,46,0.9)' : 'rgba(255,255,255,0.9)'}
                                        style={[styles.circleGlass, {borderColor: colors.border}]}
                                    >
                                        <Ionicons name="arrow-up" size={20} color={colors.text}/>
                                    </LiquidGlassView>
                                </PressableScale>
                            </Animated.View>

                            <LiquidGlassView
                                tint={glassTint}
                                fallbackBackgroundColor={scheme === 'dark' ? 'rgba(48,48,46,0.9)' : 'rgba(255,255,255,0.9)'}
                                style={[styles.countGlass, {borderColor: colors.border}]}
                            >
                                <ThemedText style={[styles.countText, {color: colors.text}]}>
                                    {currentIndex.toLocaleString()}
                                    <ThemedText style={[styles.countTotal, {color: colors.textMuted}]}>
                                        {'  /  '}
                                        {totalMovieCount.toLocaleString()}
                                    </ThemedText>
                                </ThemedText>
                            </LiquidGlassView>

                            <PressableScale
                                onPress={() => {
                                    Analytics.filtersOpen();
                                    setFilterModalVisible(true);
                                }}
                                pressedScale={0.88}
                                pressedOpacity={0.85}
                                hoveredScale={1.08}
                                hitSlop={8}
                            >
                                <View style={[styles.circleSolid, {backgroundColor: colors.accent}]}>
                                    <Ionicons name="options" size={20} color={colors.onAccent}/>
                                    {activeFilterCount > 0 ? (
                                        <Animated.View entering={enterPop()} exiting={exitPop} style={[styles.filterBadge, {
                                            backgroundColor: colors.onAccent,
                                            borderColor: colors.accent
                                        }]}>
                                            <ThemedText style={[styles.filterBadgeText, {color: colors.accent}]}>
                                                {activeFilterCount}
                                            </ThemedText>
                                        </Animated.View>
                                    ) : null}
                                </View>
                            </PressableScale>
                        </LiquidGlassGroup>
                    </View>
                )}

                <MovieFilterModal
                    visible={filterModalVisible}
                    bottomInset={insets.bottom}
                    onClose={() => {
                        setFilters(appliedFilters);
                        setFilterModalVisible(false);
                    }}
                    filters={filters}
                    onFiltersChange={setFilters}
                    onApply={(f: MovieFilters) => {
                        Analytics.filtersApplied({
                            genre: f.genre,
                            quality: f.quality,
                            minimum_rating: f.minimum_rating,
                            sort_by: f.sort_by,
                            order_by: f.order_by,
                        });
                        applyFilters(f);
                        listRef.current?.scrollToOffset({offset: 0, animated: true});
                    }}
                    onClear={() => {
                        Analytics.filtersReset();
                        clearFiltersAndReload();
                        listRef.current?.scrollToOffset({offset: 0, animated: true});
                    }}
                />
            </SafeAreaView>
            {Nav}
        </ThemedView>
    );
}

function AuroraGlow({colors, top}: { colors: readonly string[]; top: number }) {
    return (
        <LinearGradient
            colors={[colors[0], colors[1], 'rgba(0,0,0,0)']}
            bands={16}
            style={[styles.aurora, {height: 320 + top}]}
            pointerEvents="none"
        />
    );
}

const styles = StyleSheet.create({
    container: {flex: 1},
    list: {flex: 1},
    listContent: {paddingHorizontal: POSTER_GAP / 2},
    centeredContent: {flex: 1, width: '100%', alignSelf: 'center', paddingHorizontal: POSTER_GAP / 2},
    aurora: {position: 'absolute', top: 0, left: 0, right: 0, opacity: 0.5},

    searchBarFixed: {paddingBottom: 8},
    searchRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
    searchPill: {flex: 1},

    searchBackGlass: {
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchFieldWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 44,
    },
    searchFieldWrapperInline: {
        flexDirection: 'row',
        alignItems: 'center',
        height: INLINE_SEARCH_HEIGHT,
    },
    inlineSearchPill: {
        flex: 1,
        maxWidth: 340,
        height: INLINE_SEARCH_HEIGHT,
        borderRadius: Radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 12,
        justifyContent: 'center',
    },
    searchInputInline: {
        flex: 1,
        height: INLINE_SEARCH_HEIGHT,
        fontSize: 14,
        padding: 0,
        fontFamily: FontFamily.regular,
    },
    searchIcon: {marginRight: 8},
    searchInput: {flex: 1, height: 44, fontSize: 16, padding: 0, fontFamily: FontFamily.regular},
    clearButton: {paddingLeft: 8, justifyContent: 'center', minWidth: 32, minHeight: 32, alignItems: 'center'},

    row: {flexDirection: 'row'},
    centered: {flex: 1, justifyContent: 'center', alignItems: 'center'},

    skeletonGrid: {flexDirection: 'row', flexWrap: 'wrap'},

    stateBox: {alignItems: 'center', paddingHorizontal: 40, paddingTop: 80, gap: 6},
    stateTitle: {marginTop: 12},
    stateMessage: {fontSize: 14, lineHeight: 20, textAlign: 'center'},
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: Radius.pill,
        paddingHorizontal: 22,
        paddingVertical: 12,
        marginTop: 20,
    },
    ctaLabel: {fontSize: 15, fontWeight: '700'},
    footerError: {alignItems: 'center', paddingVertical: 24, gap: 12, width: '100%'},
    footerRetry: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: Radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 20,
        paddingVertical: 10,
    },

    countOverlay: {position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', zIndex: 1},
    countRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
    scrollToTopButton: {justifyContent: 'center', alignItems: 'center'},
    circleGlass: {
        width: 46,
        height: 46,
        borderRadius: 23,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        justifyContent: 'center',
        alignItems: 'center',
    },
    circleSolid: {
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
    countGlass: {
        borderRadius: Radius.pill,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 18,
        height: 46,
        justifyContent: 'center',
    },
    filterBadge: {
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
    filterBadgeText: {fontSize: 11, lineHeight: 14, fontWeight: '800'},
    countText: {fontSize: 14, fontWeight: '800'},
    countTotal: {fontSize: 13, fontWeight: '600'},
});
