import type {MovieFilters, MoviesViewModel} from './useMoviesViewModel';
import {LiquidGlassGroup, LiquidGlassView} from '../components/liquid-glass-view';
import {LinearGradient} from '../components/linear-gradient';
import {ThemedText} from '../components/themed-text';
import {ThemedView} from '../components/themed-view';
import {usePalette} from '../hooks/use-palette';
import {useResponsive} from '../hooks/use-responsive';
import {FontFamily, Radius, Spacing} from '../constants/theme';
import {Ionicons} from '@expo/vector-icons';
import {Image as ExpoImage} from 'expo-image';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Animated, FlatList, Platform, Pressable, RefreshControl, StyleSheet, TextInput, View,} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {MovieFilterModal} from './components/MovieFilterModal';
import {MoviePosterItem} from './components/MoviePosterItem';
import {PosterSkeleton} from './components/PosterSkeleton';
import {POSTER_GAP, POSTER_MIN_WIDTH} from './components/moviePosterLayout';

interface MoviesScreenProps {
    viewModel: MoviesViewModel;
}

const SCROLL_AT_TOP_THRESHOLD = 8;

export function MoviesScreen({viewModel}: MoviesScreenProps) {
    const insets = useSafeAreaInsets();
    const {colors, gradients, scheme} = usePalette();
    const {width, contentMaxWidth, isLarge} = useResponsive();
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
        applyFilters,
        clearFiltersAndReload,
        loadInitial,
        loadMore,
    } = viewModel;

    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [lastVisibleIndex, setLastVisibleIndex] = useState(0);
    const [isAtTop, setIsAtTop] = useState(true);
    const prevMoviesLengthRef = useRef(0);
    const listRef = useRef<FlatList>(null);
    const [scrollToTopScale] = useState(() => new Animated.Value(0));

    const glassTint = scheme === 'dark' ? 'dark' : 'light';
    const gridWidth = Math.min(width, contentMaxWidth);
    const searchBarHeight = 44 + POSTER_GAP * 2;
    const listTopPadding = insets.top + searchBarHeight + POSTER_GAP / 2;

    const numColumns = useMemo(
        () => Math.max(2, Math.floor(gridWidth / (POSTER_MIN_WIDTH + POSTER_GAP))),
        [gridWidth]
    );

    // Fixed cell width so a partial last row stays left-aligned at normal size
    // instead of stretching to fill the row.
    const itemWidth = useMemo(() => {
        const available = gridWidth - POSTER_GAP; // content padding (POSTER_GAP/2 each side)
        return Math.floor(available / numColumns) - POSTER_GAP;
    }, [gridWidth, numColumns]);

    // Warm the cache for each newly appended movie with the *medium* poster —
    // the exact size the grid renders — so it's ready before the card scrolls in.
    // (The card uses the small image as an instant placeholder.)
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

    useEffect(() => {
        Animated.timing(scrollToTopScale, {
            toValue: isAtTop ? 0 : 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [isAtTop, scrollToTopScale]);

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

    const handleEndReached = useCallback(() => {
        if (hasMore && !loading) loadMore();
    }, [hasMore, loading, loadMore]);

    const renderItem = useCallback(
        ({item}: { item: (typeof movies)[0] }) => <MoviePosterItem movie={item} width={itemWidth}/>,
        [itemWidth]
    );
    const keyExtractor = useCallback((item: (typeof movies)[0]) => String(item.id), []);

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

    // --- Loading (first page): cinematic skeleton grid ---
    if (loading && movies.length === 0 && !error) {
        return (
            <ThemedView style={styles.container}>
                <AuroraGlow colors={gradients.accentSubtle} top={insets.top}/>
                <SafeAreaView style={styles.container} edges={['top']}>
                    <View style={[styles.centeredContent, {
                        maxWidth: contentMaxWidth,
                        paddingTop: insets.top + POSTER_GAP
                    }]}>
                        <View style={styles.skeletonGrid}>
                            {Array.from({length: numColumns * 4}).map((_, i) => (
                                <PosterSkeleton key={i} width={itemWidth}/>
                            ))}
                        </View>
                    </View>
                </SafeAreaView>
            </ThemedView>
        );
    }

    // --- Error state ---
    if (error) {
        return (
            <ThemedView style={styles.container}>
                <AuroraGlow colors={gradients.accentSubtle} top={insets.top}/>
                <SafeAreaView style={styles.centered} edges={['top']}>
                    <View style={styles.stateBox}>
                        <Ionicons name="cloud-offline-outline" size={56} color={colors.textMuted}/>
                        <ThemedText type="heading" style={styles.stateTitle}>
                            Something went wrong
                        </ThemedText>
                        <ThemedText style={[styles.stateMessage, {color: colors.textMuted}]}>{error}</ThemedText>
                        <Pressable onPress={loadInitial} style={({pressed}) => ({opacity: pressed ? 0.85 : 1})}>
                            <View style={[styles.cta, {backgroundColor: colors.accent}]}>
                                <Ionicons name="refresh" size={18} color={colors.onAccent}/>
                                <ThemedText style={[styles.ctaLabel, {color: colors.onAccent}]}>Try again</ThemedText>
                            </View>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </ThemedView>
        );
    }

    const currentIndex = lastVisibleIndex + 1;
    const isEmpty = movies.length === 0;

    return (
        <ThemedView style={styles.container}>
            <AuroraGlow colors={gradients.accentSubtle} top={insets.top}/>
            <SafeAreaView style={styles.container} edges={[]}>
                <FlatList
                    ref={listRef}
                    key={`grid-${numColumns}`}
                    style={[styles.list, isLarge && {maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%'}]}
                    data={movies}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    numColumns={numColumns}
                    columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
                    ListEmptyComponent={
                        <View style={styles.stateBox}>
                            <Ionicons name="search-outline" size={52} color={colors.textMuted}/>
                            <ThemedText type="heading" style={styles.stateTitle}>
                                Nothing matches yet
                            </ThemedText>
                            <ThemedText style={[styles.stateMessage, {color: colors.textMuted}]}>
                                Try another search, or reset the filters to see everything.
                            </ThemedText>
                        </View>
                    }
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={viewabilityConfig}
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={1.25}
                    initialNumToRender={numColumns * 4}
                    maxToRenderPerBatch={numColumns * 3}
                    updateCellsBatchingPeriod={40}
                    windowSize={11}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={loadInitial}
                            tintColor={colors.accent}
                            colors={[colors.accent]}
                            progressViewOffset={insets.top + searchBarHeight}
                        />
                    }
                    contentContainerStyle={[
                        styles.listContent,
                        {paddingTop: listTopPadding, paddingBottom: insets.bottom + 96},
                    ]}
                    ListFooterComponent={
                        loading && hasMore && !isEmpty ? (
                            <View style={styles.footerSkeletons}>
                                {Array.from({length: numColumns}).map((_, i) => (
                                    <PosterSkeleton key={i} width={itemWidth}/>
                                ))}
                            </View>
                        ) : null
                    }
                    showsVerticalScrollIndicator={false}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                />

                {/* Pinned glass search bar */}
                <View style={[styles.searchBarOverlay, {paddingTop: insets.top}]} pointerEvents="box-none">
                    <View
                        style={[
                            styles.searchBarFixed,
                            isLarge && {maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%'},
                        ]}
                    >
                        <LiquidGlassView
                            tint={glassTint}
                            intensity={80}
                            fallbackBackgroundColor={scheme === 'dark' ? 'rgba(48,48,46,0.82)' : 'rgba(255,255,255,0.82)'}
                            style={[styles.glassWrapper, {borderColor: colors.border}]}
                        >
                            <View style={styles.searchFieldWrapper}>
                                <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon}/>
                                <TextInput
                                    style={[
                                        styles.searchInput,
                                        {color: colors.text},
                                        Platform.OS === 'web' ? ({outlineStyle: 'none'} as object) : null,
                                    ]}
                                    placeholder="Search movies, genres, years…"
                                    placeholderTextColor={colors.textFaint}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    returnKeyType="search"
                                    clearButtonMode="never"
                                />
                                {searchQuery.length > 0 ? (
                                    <Pressable
                                        onPress={() => setSearchQuery('')}
                                        style={({pressed}) => [styles.clearButton, {opacity: pressed ? 0.6 : 1}]}
                                        hitSlop={8}
                                    >
                                        <Ionicons name="close-circle" size={18} color={colors.textMuted}/>
                                    </Pressable>
                                ) : null}
                            </View>
                        </LiquidGlassView>
                    </View>
                </View>

                {/* Floating control cluster */}
                {totalMovieCount != null && !isEmpty && (
                    <View style={[styles.countOverlay, {paddingBottom: insets.bottom + 16}]} pointerEvents="box-none">
                        <LiquidGlassGroup spacing={16} style={styles.countRow}>
                            <Animated.View
                                style={[styles.scrollToTopButton, {transform: [{scale: scrollToTopScale}]}]}
                                pointerEvents={isAtTop ? 'none' : 'auto'}
                            >
                                <Pressable
                                    onPress={() => listRef.current?.scrollToOffset({offset: 0, animated: true})}
                                    style={({pressed}) => ({opacity: pressed ? 0.6 : 1})}
                                    hitSlop={8}
                                >
                                    <LiquidGlassView
                                        tint={glassTint}
                                        fallbackBackgroundColor={scheme === 'dark' ? 'rgba(48,48,46,0.9)' : 'rgba(255,255,255,0.9)'}
                                        style={[styles.circleGlass, {borderColor: colors.border}]}
                                    >
                                        <Ionicons name="arrow-up" size={20} color={colors.text}/>
                                    </LiquidGlassView>
                                </Pressable>
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

                            <Pressable
                                onPress={() => setFilterModalVisible(true)}
                                style={({pressed}) => ({opacity: pressed ? 0.85 : 1})}
                                hitSlop={8}
                            >
                                <View style={[styles.circleSolid, {backgroundColor: colors.accent}]}>
                                    <Ionicons name="options" size={20} color={colors.onAccent}/>
                                </View>
                            </Pressable>
                        </LiquidGlassGroup>
                    </View>
                )}

                <MovieFilterModal
                    visible={filterModalVisible}
                    bottomInset={insets.bottom}
                    onClose={() => setFilterModalVisible(false)}
                    filters={filters}
                    onFiltersChange={setFilters}
                    onApply={(f: MovieFilters) => {
                        applyFilters(f);
                        listRef.current?.scrollToOffset({offset: 0, animated: true});
                    }}
                    onClear={() => {
                        clearFiltersAndReload();
                        listRef.current?.scrollToOffset({offset: 0, animated: true});
                    }}
                />
            </SafeAreaView>
        </ThemedView>
    );
}

/** Soft accent glow anchored to the top of the screen. */
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

    searchBarOverlay: {position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1},
    searchBarFixed: {paddingHorizontal: POSTER_GAP, paddingVertical: POSTER_GAP},
    glassWrapper: {borderRadius: Radius.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth},
    searchFieldWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 44,
        borderRadius: Radius.md,
        paddingHorizontal: 14,
    },
    searchIcon: {marginRight: 8},
    searchInput: {flex: 1, height: 44, fontSize: 16, padding: 0, fontFamily: FontFamily.regular},
    clearButton: {paddingLeft: 8, justifyContent: 'center', minWidth: 32, minHeight: 32, alignItems: 'center'},

    row: {flexDirection: 'row'},
    centered: {flex: 1, justifyContent: 'center', alignItems: 'center'},
    footerSkeletons: {flexDirection: 'row', flexWrap: 'wrap'},

    skeletonGrid: {flexDirection: 'row', flexWrap: 'wrap', paddingTop: Spacing.xs},

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
    ctaLabel: {color: '#fff', fontSize: 15, fontWeight: '700'},

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
    countText: {fontSize: 14, fontWeight: '800'},
    countTotal: {fontSize: 13, fontWeight: '600'},
});
