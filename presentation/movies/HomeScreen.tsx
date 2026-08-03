import {Ionicons} from '@expo/vector-icons';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Animated, FlatList, Platform, RefreshControl, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Reanimated from 'react-native-reanimated';
import type {Movie} from '@/domain';
import {Analytics} from '@/presentation/analytics/events';
import {LinearGradient} from '../components/linear-gradient';
import {PressableScale, enterFade, enterRise} from '../components/motion';
import {ThemedText} from '../components/themed-text';
import {Screen} from '../components/screen';
import {ThemedView} from '../components/themed-view';
import {FontFamily, Radius, Spacing, Typography} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';
import {useResponsive} from '../hooks/use-responsive';
import {ChipBar} from './components/ChipBar';
import {HeroBillboard} from './components/HeroBillboard';
import {HomeFooter} from './components/HomeFooter';
import {HoverCardHost} from './components/HoverCard';
import {MovieRail} from './components/MovieRail';
import {landscapeWidth} from './components/MovieLandscapeItem';
import {LandscapeSkeleton, PosterSkeleton, SkeletonBlock} from './components/PosterSkeleton';
import {ScrollProgress} from './components/ScrollProgress';
import {TopBar, useTopBarHeight} from './components/TopBar';
import {TopTenProvider} from './components/TopTenContext';
import {VideoCard} from './components/VideoCard';
import {POSTER_GAP} from './components/moviePosterLayout';
import {FEED_CHIPS, chipFor} from './constants/feedChips';
import {useGoTo} from './constants/destinations';
import {useWatchlist} from './useWatchlist';
import type {ShelfQuery, ShelfVariant} from './constants/homeShelves';
import type {HomeViewModel, ShelfState} from './useHomeViewModel';
import type {FeedViewModel} from './useFeedViewModel';
import type {ShowsViewModel} from './useShowsViewModel';
import {ShowStrip} from './components/ShowStrip';

const SCROLL_AT_TOP_THRESHOLD = 8;

const CARD_MIN_WIDTH = 300;
const SINGLE_COLUMN_MAX_WIDTH = 480;
const COLUMN_GAP = 16;
const ROW_GAP = 24;
const THUMB_ASPECT = 16 / 9;
const INITIAL_SKELETON_ROWS = 4;
const PAGING_SKELETON_ROWS = 2;
const FEED_SOURCE = 'home_feed';

type Palette = ReturnType<typeof usePalette>['colors'];

type HomeRow =
    | {kind: 'shelf'; key: string; shelf: ShelfState}
    | {kind: 'watchlist'; key: string; movies: Movie[]}
    | {kind: 'shows'; key: string}
    | {kind: 'heading'; key: string}
    | {kind: 'chips'; key: string}
    | {kind: 'cards'; key: string; movies: Movie[]; endIndex: number};

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<HomeRow>);

function buildBrowseHref(query: ShelfQuery): string {
    const params = new URLSearchParams();
    if (query.genre) params.set('genre', query.genre);
    if (query.quality) params.set('quality', query.quality);
    if (query.minimum_rating) params.set('minimum_rating', String(query.minimum_rating));
    if (query.sort_by) params.set('sort_by', query.sort_by);
    if (query.order_by) params.set('order_by', query.order_by);
    const qs = params.toString();
    return qs ? `/movies?${qs}` : '/movies';
}

function skeletonCount(width: number, posterWidth: number, gutter: number): number {
    const available = Math.max(0, width - gutter * 2);
    return Math.max(3, Math.ceil(available / (posterWidth + POSTER_GAP)) + 1);
}

export function HomeScreen({
    shelves,
    feed,
    shows,
}: {
    shelves: HomeViewModel;
    feed: FeedViewModel;
    shows?: ShowsViewModel;
}) {
    const insets = useSafeAreaInsets();
    const {colors, scheme} = usePalette();
    const {width, height, contentMaxWidth, isPhone, isTablet, gutter} = useResponsive();
    const {
        heroMovies,
        heroTrailers,
        heroBackdrops,
        requestHeroTrailer,
        shelves: shelfStates,
        loading: shelvesLoading,
        refreshing: shelvesRefreshing,
        error: shelvesError,
        loadInitial: loadShelvesInitial,
        loadShelf,
        reload: reloadShelves,
    } = shelves;
    const {
        chip,
        setChip,
        movies: feedMovies,
        totalCount,
        loading: feedLoading,
        refreshing: feedRefreshing,
        error: feedError,
        hasMore,
        loadInitial: loadFeedInitial,
        loadMore,
        reload: reloadFeed,
    } = feed;

    const watchlist = useWatchlist();
    const goTo = useGoTo();
    const topBarHeight = useTopBarHeight();

    const listRef = useRef<FlatList<HomeRow>>(null);
    const scrollY = useRef(new Animated.Value(0)).current;
    const [atTop, setAtTop] = useState(true);
    const [gridVisible, setGridVisible] = useState(false);
    const [lastGridIndex, setLastGridIndex] = useState(0);
    const [chipsPinned, setChipsPinned] = useState(false);
    const prevFeedLengthRef = useRef(0);
    const lastRequestedCountRef = useRef(-1);

    useEffect(() => {
        const id = scrollY.addListener(({value}) => {
            setAtTop(value <= SCROLL_AT_TOP_THRESHOLD);
        });
        return () => scrollY.removeListener(id);
    }, [scrollY]);

    const onScroll = useMemo(
        () =>
            Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {
                useNativeDriver: Platform.OS !== 'web',
            }),
        [scrollY]
    );

    useEffect(() => {
        loadShelvesInitial();
    }, [loadShelvesInitial]);

    useEffect(() => {
        loadFeedInitial();
    }, [loadFeedInitial]);

    const errorMessage = shelvesError ?? feedError;

    useEffect(() => {
        if (errorMessage) Analytics.loadError('home');
    }, [errorMessage]);

    useEffect(() => {
        if (feedMovies.length < prevFeedLengthRef.current) setLastGridIndex(0);
        prevFeedLengthRef.current = feedMovies.length;
    }, [feedMovies.length]);

    const topTenMovies = useMemo(
        () => shelfStates.find((shelf) => shelf.key === 'top-10')?.movies ?? [],
        [shelfStates]
    );

    const posterWidth = isPhone ? 126 : isTablet ? 146 : 158;
    const heroHeight = isPhone
        ? Math.round(Math.min(height * 0.62, 560))
        : Math.round(Math.min(height * 0.78, 620));
    const skeletons = skeletonCount(width, posterWidth, gutter);

    const gridWidth = Math.min(width, contentMaxWidth);
    const columnsWidth = Math.max(0, gridWidth - gutter * 2);

    const numColumns = useMemo(() => {
        if (width < SINGLE_COLUMN_MAX_WIDTH) return 1;
        return Math.max(2, Math.floor((columnsWidth + COLUMN_GAP) / (CARD_MIN_WIDTH + COLUMN_GAP)));
    }, [width, columnsWidth]);

    const cardWidth = Math.max(
        1,
        Math.floor((columnsWidth - COLUMN_GAP * (numColumns - 1)) / numColumns)
    );

    const rows = useMemo<HomeRow[]>(() => {
        const next: HomeRow[] = shelfStates.map((shelf) => ({
            kind: 'shelf',
            key: `shelf-${shelf.key}`,
            shelf,
        }));
        if ((shows?.shows.length ?? 0) > 0) next.splice(1, 0, {kind: 'shows', key: 'shows-strip'});
        if (watchlist.length > 0) next.push({kind: 'watchlist', key: 'watchlist', movies: watchlist});
        next.push({kind: 'heading', key: 'browse-heading'});
        next.push({kind: 'chips', key: 'browse-chips'});
        for (let start = 0; start < feedMovies.length; start += numColumns) {
            const slice = feedMovies.slice(start, start + numColumns);
            next.push({
                kind: 'cards',
                key: `row-${slice[0].id}`,
                movies: slice,
                endIndex: start + slice.length,
            });
        }
        return next;
    }, [shelfStates, watchlist, feedMovies, numColumns, shows?.shows.length]);


    const selectChip = useCallback(
        (key: string) => {
            if (key === chip) return;
            Analytics.feedChipSelect(key, 'home');
            Analytics.filtersApplied({...chipFor(key).query});
            setChip(key);
        },
        [chip, setChip]
    );

    const handleEndReached = useCallback(() => {
        if (!hasMore || feedLoading || feedMovies.length === 0) return;
        if (!gridVisible) return;
        if (lastRequestedCountRef.current === feedMovies.length) return;
        lastRequestedCountRef.current = feedMovies.length;
        Analytics.browseLoadMore(feedMovies.length);
        loadMore();
    }, [gridVisible, hasMore, feedLoading, feedMovies.length, loadMore]);

    const handleRefresh = useCallback(() => {
        reloadShelves();
        reloadFeed();
    }, [reloadShelves, reloadFeed]);

    const handleRetry = useCallback(() => {
        Analytics.retry('home');
        reloadShelves();
        reloadFeed();
    }, [reloadShelves, reloadFeed]);

    const handleScrollToTop = useCallback(() => {
        Analytics.scrollToTop();
        listRef.current?.scrollToOffset({offset: 0, animated: true});
    }, []);

    const viewabilityConfig = useMemo(
        () => ({itemVisiblePercentThreshold: 10, minimumViewTime: 50}),
        []
    );

    const onViewableItemsChanged = useCallback(
        ({viewableItems}: {viewableItems: {item: HomeRow}[]}) => {
            let end = -1;
            let chipsVisible = false;
            for (const token of viewableItems) {
                const row = token.item;
                if (!row) continue;
                if (row.kind === 'chips') chipsVisible = true;
                if (row.kind === 'cards' && row.endIndex > end) end = row.endIndex;
            }
            setGridVisible(end >= 0);
            setChipsPinned(end >= 0 && !chipsVisible);
            if (end >= 0) setLastGridIndex(end);
        },
        []
    );

    const renderRow = useCallback(
        ({item}: {item: HomeRow}) => {
            if (item.kind === 'shelf') {
                return (
                    <ShelfRow
                        shelf={item.shelf}
                        posterWidth={posterWidth}
                        gutter={gutter}
                        colors={colors}
                        skeletons={skeletons}
                        onLoad={loadShelf}
                        onNavigate={goTo}
                    />
                );
            }

            if (item.kind === 'watchlist') {
                return (
                    <MovieRail
                        title="Watchlist"
                        movies={item.movies}
                        variant="landscape"
                        posterWidth={posterWidth}
                        gutter={gutter}
                        onSeeAll={() => {
                            Analytics.shelfSeeAll('My List');
                            goTo('/watchlist');
                        }}
                    />
                );
            }

            if (item.kind === 'shows') {
                return <ShowStrip shows={shows?.shows ?? []} gutter={gutter} posterWidth={posterWidth}/>;
            }

            if (item.kind === 'heading') {
                return (
                    <View style={[styles.headingRow, {paddingHorizontal: gutter}]}>
                        <ThemedText type="heading" style={{color: colors.text}}>
                            Browse all
                        </ThemedText>
                        <ThemedText style={[Typography.videoMeta, {color: colors.textMuted}]}>
                            Every title in the catalog, filtered your way
                        </ThemedText>
                    </View>
                );
            }

            if (item.kind === 'chips') {
                return (
                    <View
                        style={[
                            styles.chipRow,
                            {backgroundColor: colors.background},
                        ]}
                    >
                        <View style={styles.chipRowInner}>
                            <ChipBar chips={FEED_CHIPS} active={chip} onSelect={selectChip} contentPadding={gutter}/>
                        </View>
                    </View>
                );
            }

            return (
                <View style={[styles.cardRow, {paddingHorizontal: gutter}]}>
                    {item.movies.map((movie) => (
                        <VideoCard key={movie.id} movie={movie} width={cardWidth} source={FEED_SOURCE}/>
                    ))}
                </View>
            );
        },
        [
            posterWidth,
            gutter,
            colors,
            skeletons,
            loadShelf,
            goTo,
            contentMaxWidth,
            chip,
            selectChip,
            cardWidth,
        ]
    );

    if (shelvesLoading && heroMovies.length === 0 && !shelvesError) {
        return (
            <Screen overlays={<TopBar active="home"/>}>
                <HomeSkeleton
                    heroHeight={heroHeight}
                    posterWidth={posterWidth}
                    gutter={gutter}
                    colors={colors}
                    skeletons={skeletons}
                />
            </Screen>
        );
    }

    if (shelvesError && heroMovies.length === 0) {
        return (
            <Screen overlays={<TopBar active="home"/>}>
                <Reanimated.View entering={enterRise()} style={[styles.centered, {paddingTop: topBarHeight}]}>
                    <Ionicons name="cloud-offline-outline" size={56} color={colors.textMuted}/>
                    <ThemedText type="heading" style={styles.stateTitle}>Something went wrong</ThemedText>
                    <ThemedText style={[styles.stateMessage, {color: colors.textMuted}]}>
                        {shelvesError}
                    </ThemedText>
                    <PressableScale
                        onPress={handleRetry}
                        accessibilityRole="button"
                        accessibilityLabel="Try again"
                        pressedScale={0.94}
                        pressedOpacity={0.85}
                        hoveredScale={1.03}
                    >
                        <View style={[styles.cta, {backgroundColor: colors.accent}]}>
                            <Ionicons name="refresh" size={18} color={colors.onAccent}/>
                            <ThemedText style={[styles.ctaLabel, {color: colors.onAccent}]}>Try again</ThemedText>
                        </View>
                    </PressableScale>
                </Reanimated.View>
            </Screen>
        );
    }

    const skeletonRows = feedLoading
        ? feedMovies.length === 0
            ? INITIAL_SKELETON_ROWS
            : feedRefreshing
                ? 0
                : PAGING_SKELETON_ROWS
        : 0;
    const showEmptyFeed = !feedLoading && !feedError && feedMovies.length === 0;
    const showProgress = gridVisible && feedMovies.length > 0;

    return (
        <TopTenProvider movies={topTenMovies}>
            <HoverCardHost>
                <Screen
                    overlays={
                        <>
                            {(
                                <ScrollProgress
                                    current={Math.min(lastGridIndex, feedMovies.length)}
                                    total={totalCount}
                                    atTop={atTop}
                                    onScrollToTop={handleScrollToTop}
                                    bottomInset={insets.bottom}
                                    visible={showProgress}
                                />
                            )}
                            <TopBar
                                active="home"
                                below={
                                    chipsPinned ? (
                                        <View style={styles.chipRowInner}>
                                            <ChipBar
                                                chips={FEED_CHIPS}
                                                active={chip}
                                                onSelect={selectChip}
                                                contentPadding={gutter}
                                            />
                                        </View>
                                    ) : null
                                }
                            />
                        </>
                    }
                >
                    <AnimatedFlatList
                        ref={listRef}
                        data={rows}
                        keyExtractor={(item) => item.key}
                        renderItem={renderRow}
                        onScroll={onScroll}
                        scrollEventThrottle={16}
                        showsVerticalScrollIndicator={false}
                        ListHeaderComponent={
                            heroMovies.length > 0 ? (
                                <Animated.View
                                    style={[
                                        styles.heroWrap,
                                        {
                                            opacity: scrollY.interpolate({
                                                inputRange: [0, heroHeight * 0.75],
                                                outputRange: [1, 0],
                                                extrapolate: 'clamp',
                                            }),
                                            transform: [
                                                {
                                                    scale: scrollY.interpolate({
                                                        inputRange: [-heroHeight, 0, heroHeight],
                                                        outputRange: [1.15, 1, 0.92],
                                                        extrapolate: 'clamp',
                                                    }),
                                                },
                                                {
                                                    translateY: scrollY.interpolate({
                                                        inputRange: [0, heroHeight],
                                                        outputRange: [0, heroHeight * 0.22],
                                                        extrapolate: 'clamp',
                                                    }),
                                                },
                                            ],
                                        },
                                    ]}
                                >
                                    <HeroBillboard
                                        movies={heroMovies}
                                        width={width}
                                        height={heroHeight}
                                        trailers={heroTrailers}
                                    backdrops={heroBackdrops}
                                        onRequestTrailer={requestHeroTrailer}
                                    />
                                </Animated.View>
                            ) : null
                        }
                        ListFooterComponent={
                            <>
                                <View style={[styles.feedFooter, {paddingHorizontal: gutter}]}>
                                    {Array.from({length: skeletonRows}).map((_, row) => (
                                        <FeedSkeletonRow key={row} cardWidth={cardWidth} columns={numColumns}/>
                                    ))}
                                    {showEmptyFeed ? (
                                        <Reanimated.View entering={enterFade()} style={styles.stateBox}>
                                            <Ionicons name="film-outline" size={48} color={colors.textMuted}/>
                                            <ThemedText style={[Typography.sectionTitle, {color: colors.text}]}>
                                                Nothing to watch here
                                            </ThemedText>
                                            <ThemedText
                                                style={[
                                                    Typography.videoMeta,
                                                    styles.stateMessage,
                                                    {color: colors.textMuted},
                                                ]}
                                            >
                                                Pick another category to keep browsing.
                                            </ThemedText>
                                        </Reanimated.View>
                                    ) : null}
                                    {feedError && feedMovies.length > 0 ? (
                                        <FeedRetryRow
                                            colors={colors}
                                            onRetry={() => {
                                                Analytics.retry('browse_more');
                                                loadMore();
                                            }}
                                        />
                                    ) : null}
                                </View>
                                <HomeFooter/>
                            </>
                        }
                        onViewableItemsChanged={onViewableItemsChanged}
                        viewabilityConfig={viewabilityConfig}
                        onEndReached={handleEndReached}
                        onEndReachedThreshold={0.5}
                        contentContainerStyle={{
                            paddingTop: topBarHeight,
                            paddingBottom: insets.bottom + 96,
                        }}
                        refreshControl={
                            <RefreshControl
                                refreshing={shelvesRefreshing || feedRefreshing}
                                onRefresh={handleRefresh}
                                tintColor={colors.accent}
                                colors={[colors.accent]}
                                progressViewOffset={topBarHeight}
                            />
                        }
                        initialNumToRender={4}
                        maxToRenderPerBatch={4}
                        updateCellsBatchingPeriod={40}
                        windowSize={Platform.OS === 'web' ? 21 : 9}
                    />
                </Screen>
            </HoverCardHost>
        </TopTenProvider>
    );
}

function ShelfRow({
                      shelf,
                      posterWidth,
                      gutter,
                      colors,
                      skeletons,
                      onLoad,
                      onNavigate,
                  }: {
    shelf: ShelfState;
    posterWidth: number;
    gutter: number;
    colors: Palette;
    skeletons: number;
    onLoad: (key: string) => void;
    onNavigate: (href: string) => void;
}) {
    useEffect(() => {
        if (shelf.needsRequest) onLoad(shelf.key);
    }, [shelf.needsRequest, shelf.key, onLoad]);

    useEffect(() => {
        if (shelf.status === 'loaded' && shelf.movies.length > 0) Analytics.shelfImpression(shelf.key);
    }, [shelf.status, shelf.key, shelf.movies.length]);

    if (shelf.status === 'empty' || shelf.status === 'error') return null;

    if (shelf.status === 'loaded') {
        return (
            <MovieRail
                title={shelf.title}
                subtitle={shelf.subtitle}
                movies={shelf.movies}
                variant={shelf.variant}
                markNew={shelf.markNew}
                posterWidth={posterWidth}
                gutter={gutter}
                onSeeAll={() => {
                    Analytics.shelfSeeAll(shelf.title);
                    onNavigate(buildBrowseHref(shelf.query));
                }}
            />
        );
    }

    return (
        <ShelfSkeleton
            title={shelf.title}
            variant={shelf.variant}
            posterWidth={posterWidth}
            gutter={gutter}
            colors={colors}
            skeletons={skeletons}
        />
    );
}

function ShelfSkeleton({
                           title,
                           variant,
                           posterWidth,
                           gutter,
                           colors,
                           skeletons,
                       }: {
    title: string;
    variant: ShelfVariant;
    posterWidth: number;
    gutter: number;
    colors: Palette;
    skeletons: number;
}) {
    const landscape = variant === 'landscape';
    const count = landscape
        ? Math.max(2, Math.ceil((skeletons * (posterWidth + POSTER_GAP)) / (landscapeWidth(posterWidth) + POSTER_GAP)))
        : skeletons;

    return (
        <Reanimated.View entering={enterFade()} style={styles.skeletonRail}>
            <ThemedText type="heading" style={[styles.shelfSkeletonTitle, {color: colors.text, marginLeft: gutter}]}>
                {title}
            </ThemedText>
            <View style={[styles.skeletonRow, {paddingHorizontal: gutter - POSTER_GAP / 2}]}>
                {Array.from({length: count}).map((_, i) =>
                    landscape ? (
                        <LandscapeSkeleton key={i} posterWidth={posterWidth}/>
                    ) : (
                        <PosterSkeleton key={i} width={posterWidth}/>
                    )
                )}
            </View>
        </Reanimated.View>
    );
}

function HomeSkeleton({
                          heroHeight,
                          posterWidth,
                          gutter,
                          colors,
                          skeletons,
                      }: {
    heroHeight: number;
    posterWidth: number;
    gutter: number;
    colors: Palette;
    skeletons: number;
}) {
    return (
        <View>
            <View style={{height: heroHeight}}>
                <SkeletonBlock style={styles.heroSkeletonFill}/>
                <View style={styles.heroSkeletonContent}>
                    <SkeletonBlock style={styles.heroSkeletonTagline}/>
                    <SkeletonBlock style={styles.heroSkeletonTitle}/>
                    <SkeletonBlock style={styles.heroSkeletonMeta}/>
                    <View style={styles.heroSkeletonCtaRow}>
                        <SkeletonBlock style={styles.heroSkeletonCta}/>
                        <SkeletonBlock style={styles.heroSkeletonCta}/>
                        <SkeletonBlock style={styles.heroSkeletonCircle}/>
                    </View>
                </View>
                <LinearGradient
                    colors={['rgba(6,6,8,0)', colors.background]}
                    bands={12}
                    style={styles.meltFade}
                    pointerEvents="none"
                />
            </View>
            {[0, 1, 2].map((row) => (
                <View key={row} style={styles.skeletonRail}>
                    <View style={[styles.skeletonTitle, {backgroundColor: colors.surfaceSunken, marginLeft: gutter}]}/>
                    <View style={[styles.skeletonRow, {paddingHorizontal: gutter - POSTER_GAP / 2}]}>
                        {Array.from({length: skeletons}).map((_, i) => (
                            <PosterSkeleton key={i} width={posterWidth}/>
                        ))}
                    </View>
                </View>
            ))}
        </View>
    );
}

function FeedSkeletonRow({cardWidth, columns}: {cardWidth: number; columns: number}) {
    const thumbHeight = Math.round(cardWidth / THUMB_ASPECT);

    return (
        <View style={styles.skeletonCardRow}>
            {Array.from({length: columns}).map((_, column) => (
                <View key={column} style={{width: cardWidth}}>
                    <SkeletonBlock style={{height: thumbHeight, borderRadius: Radius.card}}/>
                    <SkeletonBlock style={styles.skeletonCardTitle}/>
                    <SkeletonBlock style={styles.skeletonCardMeta}/>
                </View>
            ))}
        </View>
    );
}

function FeedRetryRow({colors, onRetry}: {colors: Palette; onRetry: () => void}) {
    return (
        <Reanimated.View entering={enterFade()} style={styles.retryRow}>
            <ThemedText style={[Typography.videoMeta, {color: colors.textMuted}]}>
                Couldn&apos;t load more movies.
            </ThemedText>
            <PressableScale
                onPress={onRetry}
                accessibilityRole="button"
                accessibilityLabel="Try again"
                pressedScale={0.94}
                pressedOpacity={0.85}
                hoveredScale={1.03}
            >
                <View style={[styles.retryButton, {borderColor: colors.border}]}>
                    <Ionicons name="refresh" size={16} color={colors.accent}/>
                    <ThemedText style={[styles.ctaLabel, {color: colors.accent}]}>Try again</ThemedText>
                </View>
            </PressableScale>
        </Reanimated.View>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1},

    heroWrap: {marginBottom: Spacing.xl},
    meltFade: {position: 'absolute', left: 0, right: 0, bottom: 0, height: 96},

    headingRow: {
        width: '100%',
        alignSelf: 'center',
        gap: Spacing.xs,
        marginTop: Spacing.lg,
        marginBottom: Spacing.sm,
    },
    chipRow: {},
    chipRowInner: {width: '100%', alignSelf: 'center'},
    cardRow: {
        width: '100%',
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: COLUMN_GAP,
        marginTop: ROW_GAP,
    },
    feedFooter: {width: '100%', alignSelf: 'center'},
    skeletonCardRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: COLUMN_GAP,
        marginTop: ROW_GAP,
    },
    skeletonCardTitle: {height: 14, width: '72%', borderRadius: 4, marginTop: Spacing.md},
    skeletonCardMeta: {height: 11, width: '48%', borderRadius: 4, marginTop: Spacing.sm},

    centered: {flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 6},
    stateBox: {alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxxl},
    stateTitle: {marginTop: 12},
    stateMessage: {fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 320},
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: Radius.pill,
        paddingHorizontal: 22,
        paddingVertical: 12,
        marginTop: 20,
    },
    ctaLabel: {fontSize: 15, fontFamily: FontFamily.bold},

    retryRow: {alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl},
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
    },

    heroSkeletonFill: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
    heroSkeletonContent: {
        position: 'absolute',
        left: Spacing.xl,
        right: Spacing.xl,
        bottom: Spacing.xxl + Spacing.sm,
        gap: Spacing.md,
    },
    heroSkeletonTagline: {width: 140, height: 14, borderRadius: 4},
    heroSkeletonTitle: {width: '75%', height: 34, borderRadius: 6},
    heroSkeletonMeta: {width: '60%', height: 14, borderRadius: 4},
    heroSkeletonCtaRow: {flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6},
    heroSkeletonCta: {flex: 1, height: 48, borderRadius: Radius.pill},
    heroSkeletonCircle: {width: 48, height: 48, borderRadius: 24},

    skeletonRail: {marginBottom: Spacing.xl},
    skeletonTitle: {width: 160, height: 20, borderRadius: 6, marginBottom: Spacing.md},
    shelfSkeletonTitle: {marginBottom: Spacing.md},
    skeletonRow: {flexDirection: 'row', overflow: 'hidden'},
});
