import {LiquidGlassView} from '@/components/liquid-glass-view';
import {Ionicons} from '@expo/vector-icons';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
    ActivityIndicator,
    Animated,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemedText} from '@/components/themed-text';
import {ThemedView} from '@/components/themed-view';
import {useColorScheme} from '@/hooks/use-color-scheme';
import {useThemeColor} from '@/hooks/use-theme-color';
import {MovieFilterModal} from '@/presentation/movies/components/MovieFilterModal';
import {MoviePosterItem} from '@/presentation/movies/components/MoviePosterItem';
import type {MovieFilters, MoviesViewModel} from '@/presentation/movies/useMoviesViewModel';
import {
    POSTER_GAP,
    POSTER_MIN_WIDTH,
} from '@/presentation/movies/components/moviePosterLayout';

const HORIZONTAL_PADDING = 16;

interface MoviesScreenProps {
    viewModel: MoviesViewModel;
}

export function MoviesScreen({viewModel}: MoviesScreenProps) {
    const insets = useSafeAreaInsets();
    const {width} = useWindowDimensions();
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
    const scrollToTopOpacity = useRef(new Animated.Value(0)).current;

    const SCROLL_AT_TOP_THRESHOLD = 8;

    useEffect(() => {
        Animated.timing(scrollToTopOpacity, {
            toValue: isAtTop ? 0 : 1,
            duration: 220,
            useNativeDriver: true,
        }).start();
    }, [isAtTop, scrollToTopOpacity]);

    const onScroll = useCallback(
        ({nativeEvent}: { nativeEvent: { contentOffset: { y: number } } }) => {
            setIsAtTop(nativeEvent.contentOffset.y <= SCROLL_AT_TOP_THRESHOLD);
        },
        []
    );
    const colorScheme = useColorScheme();

    useEffect(() => {
        if (movies.length < prevMoviesLengthRef.current) setLastVisibleIndex(0);
        prevMoviesLengthRef.current = movies.length;
    }, [movies.length]);
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');
    const glassTint = colorScheme === 'dark' ? 'dark' : 'light';
    const searchBarHeight = 40 + POSTER_GAP * 2;
    const listTopPadding = insets.top + searchBarHeight + POSTER_GAP / 2;

    const numColumns = useMemo(
        () =>
            Math.max(
                2,
                Math.floor(
                    (width - HORIZONTAL_PADDING + POSTER_GAP) /
                    (POSTER_MIN_WIDTH + POSTER_GAP)
                )
            ),
        [width]
    );

    useEffect(() => {
        loadInitial();
    }, [loadInitial]);

    const handleEndReached = useCallback(() => {
        if (hasMore && !loading) loadMore();
    }, [hasMore, loading, loadMore]);

    const renderItem = useCallback(
        ({item}: { item: (typeof movies)[0] }) => (
            <MoviePosterItem movie={item} />
        ),
        []
    );

    const keyExtractor = useCallback(
        (item: (typeof movies)[0], index: number) => `${item.id}-${index}`,
        []
    );

    const viewabilityConfig = useMemo(
        () => ({
            itemVisiblePercentThreshold: 10,
            minimumViewTime: 50,
        }),
        []
    );

    const onViewableItemsChanged = useCallback(
        ({viewableItems}: { viewableItems: Array<{ index: number | null }> }) => {
            const maxIndex = viewableItems.reduce(
                (acc, item) =>
                    item.index != null && item.index > acc ? item.index : acc,
                -1
            );
            if (maxIndex >= 0) setLastVisibleIndex(maxIndex);
        },
        []
    );

    if (loading && movies.length === 0) {
        return (
            <ThemedView style={styles.centered}>
                <SafeAreaView style={styles.centered} edges={['top']}>
                    <ActivityIndicator size="large" />
                </SafeAreaView>
            </ThemedView>
        );
    }

    const currentIndex = lastVisibleIndex + 1;

    if (error) {
        return (
            <ThemedView style={styles.centered}>
                <SafeAreaView style={styles.centered} edges={['top']}>
                    <ThemedText>{error}</ThemedText>
                </SafeAreaView>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.container} edges={[]}>
                <FlatList
                    ref={listRef}
                    key={`grid-${numColumns}`}
                    style={styles.list}
                    data={movies}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    numColumns={numColumns}
                    columnWrapperStyle={styles.row}
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={viewabilityConfig}
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.2}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={loadInitial}
                            progressViewOffset={insets.top + searchBarHeight}
                        />
                    }
                    contentContainerStyle={[
                        styles.listContent,
                        {
                            paddingTop: listTopPadding,
                            paddingBottom: 24,
                        },
                    ]}
                    ListFooterComponent={
                        loading ? (
                            <View style={styles.footer}>
                                <ActivityIndicator size="small"/>
                            </View>
                        ) : null
                    }
                    showsVerticalScrollIndicator={false}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                />
                <View
                    style={[styles.searchBarOverlay, {paddingTop: insets.top}]}
                    pointerEvents="box-none"
                >
                    <View style={styles.searchBarFixed}>
                        <LiquidGlassView
                            tint={glassTint}
                            intensity={80}
                            fallbackBackgroundColor={iconColor + '28'}
                            style={styles.glassWrapper}
                        >
                            <View style={styles.searchFieldWrapper}>
                                <TextInput
                                    style={[styles.searchInput, {color: '#000'}]}
                                    placeholder="Search Movies"
                                    placeholderTextColor="#000"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    returnKeyType="search"
                                />
                                {searchQuery.length > 0 ? (
                                    <Pressable
                                        onPress={() => setSearchQuery('')}
                                        style={({pressed}) => [
                                            styles.clearButton,
                                            {opacity: pressed ? 0.6 : 1},
                                        ]}
                                        hitSlop={8}
                                    >
                                        <ThemedText style={[styles.clearButtonLabel, {color: iconColor}]}>
                                            ✕
                                        </ThemedText>
                                    </Pressable>
                                ) : null}
                            </View>
                        </LiquidGlassView>
                    </View>
                </View>
                {totalMovieCount != null && (
                    <View
                        style={[
                            styles.countOverlay,
                            {paddingBottom: insets.bottom + 12},
                        ]}
                        pointerEvents="box-none"
                    >
                        <View style={styles.countRow}>
                            <Animated.View style={{opacity: scrollToTopOpacity}}>
                                <Pressable
                                    onPress={() => listRef.current?.scrollToOffset({offset: 0, animated: true})}
                                    style={({pressed}) => [
                                        styles.scrollToTopButton,
                                        {opacity: pressed ? 0.6 : 1},
                                    ]}
                                    pointerEvents={isAtTop ? 'none' : 'auto'}
                                    hitSlop={8}
                                >
                                    <LiquidGlassView
                                        tint={glassTint}
                                        fallbackBackgroundColor={iconColor + '28'}
                                        style={styles.scrollToTopGlass}
                                    >
                                        <Ionicons name="arrow-up" size={20} color="#000"/>
                                    </LiquidGlassView>
                                </Pressable>
                            </Animated.View>
                            <LiquidGlassView
                                tint={glassTint}
                                fallbackBackgroundColor={iconColor + '28'}
                                style={styles.countGlass}
                            >
                                <ThemedText style={[styles.countText, {color: textColor}]}>
                                    {currentIndex} / {totalMovieCount}
                                </ThemedText>
                            </LiquidGlassView>
                            <Pressable
                                onPress={() => setFilterModalVisible(true)}
                                style={({pressed}) => [
                                    styles.filterCircleButton,
                                    {opacity: pressed ? 0.6 : 1},
                                ]}
                                hitSlop={8}
                            >
                                <LiquidGlassView
                                    tint={glassTint}
                                    fallbackBackgroundColor={iconColor + '28'}
                                    style={styles.scrollToTopGlass}
                                >
                                    <Ionicons name="filter" size={20} color="#000"/>
                                </LiquidGlassView>
                            </Pressable>
                        </View>
                    </View>
                )}
                <MovieFilterModal
                    visible={filterModalVisible}
                    onClose={() => setFilterModalVisible(false)}
                    filters={filters}
                    onFiltersChange={setFilters}
                    onApply={(filters: MovieFilters) => {
                        applyFilters(filters);
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: POSTER_GAP / 2,
    },
    searchBarOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1,
    },
    searchBarFixed: {
        paddingHorizontal: POSTER_GAP,
        paddingVertical: POSTER_GAP,
    },
    glassWrapper: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    searchFieldWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 40,
        borderRadius: 12,
        paddingHorizontal: 14,
    },
    searchInput: {
        flex: 1,
        height: 40,
        paddingHorizontal: 0,
        fontSize: 17,
    },
    clearButton: {
        paddingLeft: 8,
        justifyContent: 'center',
        minWidth: 32,
        minHeight: 32,
        alignItems: 'center',
    },
    clearButtonLabel: {
        fontSize: 18,
        fontWeight: '400',
    },
    row: {
        flexDirection: 'row',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    footer: {
        padding: 16,
        alignItems: 'center',
    },
    countOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 1,
    },
    countRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    filterCircleButton: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    countGlass: {
        borderRadius: 20,
        overflow: 'hidden',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    countText: {
        fontSize: 14,
        fontWeight: '600',
    },
    scrollToTopButton: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollToTopGlass: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
