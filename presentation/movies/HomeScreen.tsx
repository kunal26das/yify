import Ionicons from '@expo/vector-icons/Ionicons';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {Animated, FlatList, Platform, RefreshControl, ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Reanimated from 'react-native-reanimated';
import type {Movie} from '@/domain';
import {Analytics} from '@/presentation/analytics/events';
import {PressableScale, enterRise} from '../components/motion';
import {ThemedText} from '../components/themed-text';
import {Screen} from '../components/screen';
import {WebAdvertisement} from '../components/WebAdvertisement';
import {FontFamily, Radius, Spacing} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';
import {useReloadWhenOnline} from '../hooks/use-reload-when-online';
import {useResponsive} from '../hooks/use-responsive';
import {HeroBillboard} from './components/HeroBillboard';
import {HomeFooter} from './components/HomeFooter';
import {HoverCardHost} from './components/HoverCard';
import {MovieRail} from './components/MovieRail';
import {SkeletonBlock} from './components/PosterSkeleton';
import {useTopBarHeight} from './components/TopBar';
import {TopTenProvider} from './components/TopTenContext';
import {POSTER_GAP} from './components/moviePosterLayout';
import {useGoTo} from './constants/destinations';
import {useWatchlist} from './useWatchlist';
import type {ShelfQuery} from './constants/homeShelves';
import type {HomeViewModel, ShelfState} from './useHomeViewModel';
import type {ShowsViewModel} from './useShowsViewModel';
import {ShowStrip} from './components/ShowStrip';
import {useHomeScrollVisibility} from './useHomeScrollVisibility';

type HomeRow =
    | {kind: 'shelf'; key: string; shelf: ShelfState}
    | {kind: 'watchlist'; key: string; movies: Movie[]}
    | {kind: 'shows'; key: string};

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
    shows,
}: {
    shelves: HomeViewModel;
    shows?: ShowsViewModel;
}) {
    const insets = useSafeAreaInsets();
    const {colors} = usePalette();
    const {width, height, isPhone, isTablet, gutter} = useResponsive();
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
    const watchlist = useWatchlist();
    const goTo = useGoTo();
    const topBarHeight = useTopBarHeight();

    const [scrollY] = useState(() => new Animated.Value(0));
    const heroHeight = (isPhone ? 580 : isTablet ? 620 : Math.round(Math.max(460, Math.min(height * 0.68, 560)))) - Spacing.xxl;
    const [measuredHeroHeight, setMeasuredHeroHeight] = useState(heroHeight);
    const {heroVisible} = useHomeScrollVisibility(scrollY, measuredHeroHeight);
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
        if (shelvesError) Analytics.loadError('home');
    }, [shelvesError]);

    const topTenMovies = useMemo(
        () => shelfStates.find((shelf) => shelf.key === 'top-10')?.movies ?? [],
        [shelfStates]
    );

    const posterWidth = isPhone ? 128 : isTablet ? 144 : 160;
    const skeletons = skeletonCount(width, posterWidth, gutter);

    const rows = useMemo<HomeRow[]>(() => {
        const next: HomeRow[] = shelfStates.map((shelf) => ({
            kind: 'shelf',
            key: `shelf-${shelf.key}`,
            shelf,
        }));
        if ((shows?.shows.length ?? 0) > 0) next.splice(1, 0, {kind: 'shows', key: 'shows-strip'});
        if (watchlist.length > 0) next.push({kind: 'watchlist', key: 'watchlist', movies: watchlist});
        return next;
    }, [shelfStates, watchlist, shows?.shows.length]);

    const handleRetry = useCallback(() => {
        Analytics.retry('home');
        reloadShelves();
    }, [reloadShelves]);

    useReloadWhenOnline(handleRetry, !!shelvesError);

    const renderRow = useCallback(
        ({item}: {item: HomeRow}) => {
            if (item.kind === 'shelf') {
                return (
                    <ShelfRow
                        shelf={item.shelf}
                        posterWidth={posterWidth}
                        gutter={gutter}
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

            return <ShowStrip shows={shows?.shows ?? []} gutter={gutter} posterWidth={posterWidth}/>;
        },
        [
            posterWidth,
            gutter,
            skeletons,
            loadShelf,
            goTo,
            shows?.shows,
        ]
    );

    if (shelvesLoading && heroMovies.length === 0 && !shelvesError) {
        return (
            <Screen>
                <HomeSkeleton
                    heroHeight={heroHeight}
                    posterWidth={posterWidth}
                    gutter={gutter}
                    shelves={shelfStates}
                    onNavigate={goTo}
                    skeletons={skeletons}
                />
            </Screen>
        );
    }

    if (shelvesError && heroMovies.length === 0) {
        const message = (
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
                        <View style={[styles.cta, {backgroundColor: colors.accentStrong}]}>
                            <Ionicons name="refresh" size={18} color={colors.onAccent}/>
                            <ThemedText style={[styles.ctaLabel, {color: colors.onAccent}]}>Try again</ThemedText>
                        </View>
                    </PressableScale>
                </Reanimated.View>
        );
        return <Screen>{Platform.OS === 'web' ? (
            <ScrollView contentContainerStyle={{flexGrow: 1}}>
                {message}
                <HomeFooter/>
            </ScrollView>
        ) : message}</Screen>;
    }

    return (
        <TopTenProvider movies={topTenMovies}>
            <HoverCardHost>
                <Screen>
                    <AnimatedFlatList
                        data={rows}
                        keyExtractor={(item) => item.key}
                        renderItem={renderRow}
                        onScroll={onScroll}
                        scrollEventThrottle={16}
                        showsVerticalScrollIndicator={false}
                        ListHeaderComponent={
                            <>
                                {heroMovies.length > 0 ? (
                                    <View
                                        style={styles.heroWrap}
                                        onLayout={(event) => setMeasuredHeroHeight(event.nativeEvent.layout.height)}
                                    >
                                        <HeroBillboard
                                            visible={heroVisible}
                                            movies={heroMovies}
                                            width={width}
                                            height={heroHeight}
                                            trailers={heroTrailers}
                                            backdrops={heroBackdrops}
                                            onRequestTrailer={requestHeroTrailer}
                                        />
                                    </View>
                                ) : null}
                                <WebAdvertisement gutter={gutter}/>
                            </>
                        }
                        ListFooterComponent={<HomeFooter/>}
                        contentContainerStyle={{
                            paddingTop: topBarHeight,
                            paddingBottom: insets.bottom + 96,
                        }}
                        refreshControl={
                            <RefreshControl
                                refreshing={shelvesRefreshing}
                                onRefresh={reloadShelves}
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
                      skeletons,
                      onLoad,
                      onNavigate,
                  }: {
    shelf: ShelfState;
    posterWidth: number;
    gutter: number;
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

    return (
        <MovieRail
            title={shelf.title}
            subtitle={shelf.subtitle}
            movies={shelf.movies}
            variant={shelf.variant}
            markNew={shelf.markNew}
            posterWidth={posterWidth}
            gutter={gutter}
            loading={shelf.status !== 'loaded'}
            skeletonCount={skeletons}
            onSeeAll={() => {
                Analytics.shelfSeeAll(shelf.title);
                onNavigate(buildBrowseHref(shelf.query));
            }}
        />
    );
}

function HomeSkeleton({
                          heroHeight,
                          posterWidth,
                          gutter,
                          shelves,
                          onNavigate,
                          skeletons,
                      }: {
    heroHeight: number;
    posterWidth: number;
    gutter: number;
    shelves: ShelfState[];
    onNavigate: (href: string) => void;
    skeletons: number;
}) {
    const {width} = useResponsive();
    const topBarHeight = useTopBarHeight();
    const split = width >= 760;
    const innerWidth = Math.max(1, width - gutter * 2);
    const gap = split ? 48 : 24;
    const artWidth = split ? Math.round((innerWidth - gap) * 0.56) : innerWidth;
    const copy = (
        <View style={[styles.heroSkeletonContent, {width: split ? innerWidth - gap - artWidth : innerWidth}]}>
            <SkeletonBlock style={styles.heroSkeletonTitle}/>
            <SkeletonBlock style={styles.heroSkeletonMeta}/>
            <SkeletonBlock style={{height: 60, width: '95%', borderRadius: Radius.sm}}/>
            <View style={styles.heroSkeletonCtaRow}>
                <SkeletonBlock style={styles.heroSkeletonCta}/>
                <SkeletonBlock style={styles.heroSkeletonCircle}/>
            </View>
        </View>
    );
    const artwork = <SkeletonBlock style={{width: artWidth, height: Math.round(artWidth * 9 / 16), borderRadius: Radius.sm}}/>;
    const content = (
        <View style={{paddingTop: topBarHeight}}>
            <View style={{minHeight: heroHeight, paddingHorizontal: gutter, paddingVertical: split ? 40 : 20, gap, flexDirection: split ? 'row' : 'column', alignItems: split ? 'center' : 'flex-start', marginBottom: Spacing.xxl}}>
                {split ? copy : artwork}
                {split ? artwork : copy}
            </View>
            {shelves.slice(0, 3).map(shelf => (
                <MovieRail
                    key={shelf.key}
                    title={shelf.title}
                    subtitle={shelf.subtitle}
                    movies={[]}
                    variant={shelf.variant}
                    posterWidth={posterWidth}
                    gutter={gutter}
                    loading
                    skeletonCount={skeletons}
                    onSeeAll={() => {
                        Analytics.shelfSeeAll(shelf.title);
                        onNavigate(buildBrowseHref(shelf.query));
                    }}
                />
            ))}
            {Platform.OS === 'web' ? <HomeFooter/> : null}
        </View>
    );
    return Platform.OS === 'web' ? <ScrollView>{content}</ScrollView> : content;
}

const styles = StyleSheet.create({
    heroWrap: {marginBottom: Spacing.xxl},

    centered: {flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 6},
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

    heroSkeletonContent: {gap: Spacing.md},
    heroSkeletonTitle: {width: '85%', height: 44, borderRadius: Radius.sm},
    heroSkeletonMeta: {width: '60%', height: 14, borderRadius: Radius.sm},
    heroSkeletonCtaRow: {flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6},
    heroSkeletonCta: {width: 140, height: 46, borderRadius: Radius.sm},
    heroSkeletonCircle: {width: 46, height: 46, borderRadius: Radius.sm},

});
