import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useCallback, useEffect, useMemo, useRef} from 'react';
import {
    Animated,
    FlatList,
    Platform,
    Pressable,
    RefreshControl,
    StyleSheet,
    View,
    useWindowDimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LinearGradient} from '../components/linear-gradient';
import {ThemedText} from '../components/themed-text';
import {ThemedView} from '../components/themed-view';
import {usePalette} from '../hooks/use-palette';
import {useResponsive} from '../hooks/use-responsive';
import {FontFamily, Radius, Spacing} from '../constants/theme';
import {HeroBillboard} from './components/HeroBillboard';
import {HomeFooter} from './components/HomeFooter';
import {HoverCardHost} from './components/HoverCard';
import {MovieRail} from './components/MovieRail';
import {PosterSkeleton} from './components/PosterSkeleton';
import {TopNav, useTopNavHeight} from './components/TopNav';
import {TopTenProvider} from './components/TopTenContext';
import {POSTER_GAP} from './components/moviePosterLayout';
import {useWatchlist} from './useWatchlist';
import type {ShelfQuery} from './constants/homeShelves';
import type {HomeViewModel, ShelfState} from './useHomeViewModel';
import {Analytics} from '@/lib/analytics-events';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<ShelfState>);

type Palette = ReturnType<typeof usePalette>['colors'];

function buildBrowseHref(query: ShelfQuery): string {
    const params = new URLSearchParams();
    if (query.genre) params.set('genre', query.genre);
    if (query.quality) params.set('quality', query.quality);
    if (query.minimum_rating) params.set('minimum_rating', String(query.minimum_rating));
    if (query.sort_by) params.set('sort_by', query.sort_by);
    if (query.order_by) params.set('order_by', query.order_by);
    const qs = params.toString();
    return qs ? `/browse?${qs}` : '/browse';
}

function skeletonCount(width: number, posterWidth: number, gutter: number): number {
    const available = Math.max(0, width - gutter * 2);
    return Math.max(3, Math.ceil(available / (posterWidth + POSTER_GAP)) + 1);
}

export function HomeScreen({viewModel}: {viewModel: HomeViewModel}) {
    const insets = useSafeAreaInsets();
    const {colors} = usePalette();
    const {width, isPhone, isTablet, gutter} = useResponsive();
    const {height} = useWindowDimensions();
    const {
        heroMovies,
        heroTrailers,
        requestHeroTrailer,
        shelves,
        loading,
        refreshing,
        error,
        loadInitial,
        loadShelf,
        reload,
    } = viewModel;
    const myList = useWatchlist();
    const navHeight = useTopNavHeight();

    // Drives the nav's transparent-over-hero fade. The native driver keeps it smooth while the list
    // mounts shelves underneath — but on web there is no native scroll node to attach to and the
    // value never advances, so web drives the same animation from JS instead.
    const scrollY = useRef(new Animated.Value(0)).current;
    const onScroll = useMemo(
        () =>
            Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {
                useNativeDriver: Platform.OS !== 'web',
            }),
        [scrollY]
    );

    // The Top 10 shelf is the source of truth for chart rank; every poster on the screen reads it
    // from context so a charting title is flagged wherever it appears.
    const topTenMovies = useMemo(
        () => shelves.find((s) => s.key === 'top-10')?.movies ?? [],
        [shelves]
    );

    useEffect(() => {
        loadInitial();
    }, [loadInitial]);

    useEffect(() => {
        if (error) Analytics.loadError('home');
    }, [error]);

    const posterWidth = isPhone ? 126 : isTablet ? 146 : 158;
    const heroHeight = isPhone ? Math.round(Math.min(height * 0.62, 560)) : Math.round(Math.min(height * 0.78, 620));
    const skeletons = skeletonCount(width, posterWidth, gutter);

    const renderShelf = useCallback(
        ({item}: {item: ShelfState}) => (
            <ShelfRow
                shelf={item}
                posterWidth={posterWidth}
                gutter={gutter}
                colors={colors}
                skeletons={skeletons}
                onLoad={loadShelf}
            />
        ),
        [posterWidth, gutter, colors, skeletons, loadShelf]
    );

    if (loading && heroMovies.length === 0 && !error) {
        return (
            <ThemedView style={styles.container}>
                <HomeSkeleton heroHeight={heroHeight} posterWidth={posterWidth} gutter={gutter} colors={colors}
                              skeletons={skeletons}/>
                <TopNav active="home"/>
            </ThemedView>
        );
    }

    if (error && heroMovies.length === 0) {
        return (
            <ThemedView style={styles.container}>
                <View style={[styles.centered, {paddingTop: navHeight}]}>
                    <Ionicons name="cloud-offline-outline" size={56} color={colors.textMuted}/>
                    <ThemedText type="heading" style={styles.stateTitle}>Something went wrong</ThemedText>
                    <ThemedText style={[styles.stateMessage, {color: colors.textMuted}]}>{error}</ThemedText>
                    <Pressable onPress={() => {
                        Analytics.retry('home');
                        reload();
                    }} style={({pressed}) => ({opacity: pressed ? 0.85 : 1})}>
                        <View style={[styles.cta, {backgroundColor: colors.accent}]}>
                            <Ionicons name="refresh" size={18} color={colors.onAccent}/>
                            <ThemedText style={[styles.ctaLabel, {color: colors.onAccent}]}>Try again</ThemedText>
                        </View>
                    </Pressable>
                </View>
                <TopNav active="home"/>
            </ThemedView>
        );
    }

    return (
        <TopTenProvider movies={topTenMovies}>
        <HoverCardHost>
        <ThemedView style={styles.container}>
            <AnimatedFlatList
                data={shelves}
                onScroll={onScroll}
                scrollEventThrottle={16}
                keyExtractor={(item) => item.key}
                renderItem={renderShelf}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                    <>
                        {heroMovies.length > 0 ? (
                            <View style={styles.heroWrap}>
                                <HeroBillboard
                                    movies={heroMovies}
                                    width={width}
                                    height={heroHeight}
                                    trailers={heroTrailers}
                                    onRequestTrailer={requestHeroTrailer}
                                />
                            </View>
                        ) : (
                            <View style={{height: navHeight}}/>
                        )}
                    </>
                }
                ListFooterComponent={
                    <>
                        {myList.length > 0 ? (
                            <MovieRail
                                title="My List"
                                movies={myList}
                                variant="landscape"
                                posterWidth={posterWidth}
                                gutter={gutter}
                                onSeeAll={() => {
                                    Analytics.shelfSeeAll('My List');
                                    router.push('/my-list' as never);
                                }}
                            />
                        ) : null}
                        <HomeFooter/>
                    </>
                }
                contentContainerStyle={{paddingBottom: insets.bottom + 40}}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={reload}
                        tintColor={colors.accent}
                        colors={[colors.accent]}
                        progressViewOffset={navHeight}
                    />
                }
                initialNumToRender={3}
                maxToRenderPerBatch={3}
                windowSize={5}
            />
            <TopNav active="home" scrollY={scrollY}/>
        </ThemedView>
        </HoverCardHost>
        </TopTenProvider>
    );
}

// One home shelf. Requests its data the first time it mounts near the viewport (so the home
// doesn't fetch every shelf at once), shows a skeleton until it arrives, and collapses if empty.
function ShelfRow({
                      shelf,
                      posterWidth,
                      gutter,
                      colors,
                      skeletons,
                      onLoad,
                  }: {
    shelf: ShelfState;
    posterWidth: number;
    gutter: number;
    colors: Palette;
    skeletons: number;
    onLoad: (key: string) => void;
}) {
    // Keyed off `needsRequest`, not `status`: a shelf held back by the reveal gate displays as
    // loading while its own request has not been made yet, and it still needs to make it.
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
                    router.push(buildBrowseHref(shelf.query) as never);
                }}
            />
        );
    }

    return <ShelfSkeleton title={shelf.title} posterWidth={posterWidth} gutter={gutter} colors={colors}
                          skeletons={skeletons}/>;
}

function ShelfSkeleton({
                           title,
                           posterWidth,
                           gutter,
                           colors,
                           skeletons,
                       }: {
    title: string;
    posterWidth: number;
    gutter: number;
    colors: Palette;
    skeletons: number;
}) {
    return (
        <View style={styles.skeletonRail}>
            <ThemedText type="heading" style={[styles.shelfSkeletonTitle, {color: colors.text, marginLeft: gutter}]}>
                {title}
            </ThemedText>
            <View style={[styles.skeletonRow, {paddingHorizontal: gutter - POSTER_GAP / 2}]}>
                {Array.from({length: skeletons}).map((_, i) => (
                    <PosterSkeleton key={i} width={posterWidth}/>
                ))}
            </View>
        </View>
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
    colors: ReturnType<typeof usePalette>['colors'];
    skeletons: number;
}) {
    return (
        <View>
            <View style={{height: heroHeight, backgroundColor: colors.surfaceSunken}}>
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
                    <View style={[styles.skeletonRow, {paddingHorizontal: gutter - 6}]}>
                        {Array.from({length: skeletons}).map((_, i) => (
                            <PosterSkeleton key={i} width={posterWidth}/>
                        ))}
                    </View>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1},

    heroWrap: {marginBottom: Spacing.xl},
    meltFade: {position: 'absolute', left: 0, right: 0, bottom: 0, height: 96},

    centered: {flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 6},
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
    ctaLabel: {fontSize: 15, fontFamily: FontFamily.bold},

    skeletonRail: {marginBottom: Spacing.xl},
    skeletonTitle: {width: 160, height: 20, borderRadius: 6, marginBottom: Spacing.md},
    shelfSkeletonTitle: {fontSize: 21, lineHeight: 26, marginBottom: Spacing.md},
    skeletonRow: {flexDirection: 'row', overflow: 'hidden'},
});
