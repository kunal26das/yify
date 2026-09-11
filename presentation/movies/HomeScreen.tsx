import Ionicons from '@expo/vector-icons/Ionicons';
import {Link} from 'expo-router';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FlatList, Platform, RefreshControl, ScrollView, StyleSheet, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Movie} from '@/domain';
import {Analytics} from '@/presentation/analytics/events';
import {PressableScale} from '../components/motion';
import {Screen} from '../components/screen';
import {ThemedText} from '../components/themed-text';
import {WebAdvertisement} from '../components/WebAdvertisement';
import {FontFamily, Radius, Spacing} from '../constants/theme';
import {useSearchHistory} from '../di/DependenciesContext';
import {usePalette} from '../hooks/use-palette';
import {useReloadWhenOnline} from '../hooks/use-reload-when-online';
import {useResponsive} from '../hooks/use-responsive';
import {ChipBar} from './components/ChipBar';
import {HomeFooter} from './components/HomeFooter';
import {HoverCardHost} from './components/HoverCard';
import {MoviePosterItem} from './components/MoviePosterItem';
import {PosterSkeleton} from './components/PosterSkeleton';
import {ScrollProgress} from './components/ScrollProgress';
import {ShowStrip} from './components/ShowStrip';
import {useTopBarHeight} from './components/TopBar';
import {TopBarSlot} from './components/TopBarSlot';
import {POSTER_CAPTION_HEIGHT, POSTER_GAP} from './components/moviePosterLayout';
import {useGoTo} from './constants/destinations';
import {FEED_CHIPS, chipFor} from './constants/feedChips';
import type {FeedViewModel} from './useFeedViewModel';
import type {ShowsViewModel} from './useShowsViewModel';
import {useWatchlist} from './useWatchlist';

type HomeRow = {kind: 'movies'; key: string; movies: Movie[]; endIndex: number} | {kind: 'shows'; key: string};

const QUICK_LINKS = [
    {label: 'Latest', href: '/movies?sort_by=date_added&order_by=desc'},
    {label: 'Popular', href: '/movies?sort_by=download_count&order_by=desc'},
    {label: '4K', href: '/movies?quality=2160p&sort_by=download_count&order_by=desc'},
    {label: 'Top rated', href: '/movies?sort_by=rating&order_by=desc&minimum_rating=7'},
] as const;

function CatalogLink({label, href, compact}: {label: string; href: string; compact?: string}) {
    const {colors} = usePalette();
    const {isPhone} = useResponsive();
    return (
        <Link href={href as never} asChild>
            <PressableScale accessibilityRole="link" accessibilityLabel={label} contentStyle={styles.link}>
                <ThemedText type="caption" style={{color: colors.accent}}>{isPhone && compact ? compact : label}</ThemedText>
                <Ionicons name="arrow-forward" size={15} color={colors.accent}/>
            </PressableScale>
        </Link>
    );
}

function CatalogIntro() {
    const {colors} = usePalette();
    const {isPhone, gutter} = useResponsive();
    const [query, setQuery] = useState('');
    const [focused, setFocused] = useState(false);
    const searchHistory = useSearchHistory();
    const goTo = useGoTo();
    const submit = () => {
        const term = query.trim();
        if (!term) {
            goTo('/movies');
            return;
        }
        searchHistory.remember(term);
        Analytics.search(term);
        goTo(`/movies?query=${encodeURIComponent(term)}`);
    };
    return (
        <View style={[styles.intro, {paddingHorizontal: gutter}]}>
            <ThemedText type="micro" style={[styles.eyebrow, {color: colors.accent}]}>YOUR NEXT GREAT WATCH</ThemedText>
            <ThemedText accessibilityRole="header" type="display" style={[styles.introTitle, isPhone && styles.introTitlePhone]}>
                A world of movies. Find yours.
            </ThemedText>
            <ThemedText style={[styles.introCopy, {color: colors.textMuted}]}>Explore trailers, ratings and where to watch.</ThemedText>
            <View style={[styles.searchBox, {backgroundColor: colors.surfaceSunken, borderColor: focused ? colors.accent : colors.borderStrong}]}>
                <Ionicons name="search-outline" size={21} color={colors.textMuted}/>
                <TextInput value={query} onChangeText={setQuery} placeholder="Search movies…" placeholderTextColor={colors.textFaint}
                    accessibilityLabel="Search the movie catalog" autoCapitalize="none" autoCorrect={false} returnKeyType="search"
                    onSubmitEditing={submit} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                    style={[styles.searchInput, {color: colors.text}]}/>
                <PressableScale onPress={submit} accessibilityRole="button" accessibilityLabel="Search catalog"
                    contentStyle={[styles.searchButton, {backgroundColor: colors.accentStrong}]}>
                    <ThemedText type="caption" style={{color: colors.onAccent}}>Search</ThemedText>
                </PressableScale>
            </View>
            <View style={styles.quickLinks}>{QUICK_LINKS.map(({label, href}) => <CatalogLink key={label} label={label} href={href}/>)}</View>
        </View>
    );
}

function CatalogRetry({message, onRetry}: {message: string; onRetry: () => void}) {
    const {colors} = usePalette();
    return (
        <View style={styles.retry}>
            <ThemedText style={[styles.retryText, {color: colors.textMuted}]}>{message}</ThemedText>
            <PressableScale onPress={onRetry} accessibilityRole="button" accessibilityLabel="Try again"
                contentStyle={[styles.retryButton, {borderColor: colors.borderStrong}]}>
                <Ionicons name="refresh" size={16} color={colors.accent}/>
                <ThemedText type="caption" style={{color: colors.accent}}>Try again</ThemedText>
            </PressableScale>
        </View>
    );
}

export function HomeScreen({featured, feed, shows}: {featured: FeedViewModel; feed: FeedViewModel; shows?: ShowsViewModel}) {
    const {colors} = usePalette();
    const {width, contentMaxWidth, isPhone, gutter} = useResponsive();
    const insets = useSafeAreaInsets();
    const topBarHeight = useTopBarHeight();
    const watchlist = useWatchlist();
    const listRef = useRef<FlatList<HomeRow>>(null);
    const [atTop, setAtTop] = useState(true);
    const [lastIndex, setLastIndex] = useState(0);
    const gridVisible = useRef(false);
    const lastRequestedCount = useRef(-1);
    const innerWidth = Math.min(width, contentMaxWidth) - gutter * 2;
    const columns = Math.max(2, Math.floor((innerWidth + POSTER_GAP) / (184 + POSTER_GAP)));
    const posterWidth = Math.max(1, Math.floor((innerWidth + POSTER_GAP) / columns) - POSTER_GAP);
    const popularWidth = isPhone ? Math.min(148, posterWidth) : posterWidth;
    const contentPadding = gutter - POSTER_GAP / 2;
    const {movies, chip, setChip, totalCount, loading, refreshing, error, hasMore, loadInitial, loadMore, reload} = feed;
    const loadFeatured = featured.loadInitial;
    const reloadFeatured = featured.reload;
    const reloadShows = shows?.reload;
    const hoverKey = useMemo(() => JSON.stringify([chip, featured.movies.map(movie => movie.id), movies.map(movie => movie.id)]), [chip, featured.movies, movies]);

    useEffect(() => {loadInitial();}, [loadInitial]);
    useEffect(() => {loadFeatured();}, [loadFeatured]);

    const refresh = useCallback(() => {
        lastRequestedCount.current = -1;
        reloadFeatured();
        reload();
        reloadShows?.();
    }, [reloadFeatured, reload, reloadShows]);
    useReloadWhenOnline(refresh, !!error || !!featured.error);

    const rows = useMemo<HomeRow[]>(() => {
        const result: HomeRow[] = [];
        for (let start = 0; start < movies.length; start += columns) {
            const slice = movies.slice(start, start + columns);
            result.push({kind: 'movies', key: `movies-${slice[0].id}`, movies: slice, endIndex: start + slice.length});
            if (start === columns && (shows?.shows.length ?? 0) > 0) result.push({kind: 'shows', key: 'shows'});
        }
        return result;
    }, [movies, columns, shows?.shows]);

    const selectChip = useCallback((key: string) => {
        if (key === chip) return;
        Analytics.feedChipSelect(key, 'home');
        Analytics.filtersApplied({...chipFor(key).query});
        lastRequestedCount.current = -1;
        setLastIndex(0);
        setChip(key);
    }, [chip, setChip]);

    const viewabilityConfig = useMemo(() => ({itemVisiblePercentThreshold: 10, minimumViewTime: 50}), []);
    const onViewableItemsChanged = useCallback(({viewableItems}: {viewableItems: {item: HomeRow}[]}) => {
        const end = viewableItems.reduce((max, {item}) => item.kind === 'movies' ? Math.max(max, item.endIndex) : max, 0);
        gridVisible.current = end > 0;
        if (end > 0) setLastIndex(end);
    }, []);
    const requestMore = useCallback(() => {
        if (!hasMore || loading || error || movies.length === 0) return;
        lastRequestedCount.current = movies.length;
        Analytics.browseLoadMore(movies.length);
        loadMore();
    }, [hasMore, loading, error, movies.length, loadMore]);
    const more = useCallback(() => {
        if (!gridVisible.current || lastRequestedCount.current === movies.length) return;
        requestMore();
    }, [movies.length, requestMore]);
    const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => setAtTop(event.nativeEvent.contentOffset.y <= 8), []);
    const renderRow = useCallback(({item}: {item: HomeRow}) => item.kind === 'shows' ? (
        <ShowStrip shows={shows?.shows ?? []} gutter={gutter} posterWidth={Math.min(posterWidth, 160)}/>
    ) : (
        <View style={[styles.posterRow, {paddingHorizontal: contentPadding}]}>
            {item.movies.map((movie) => <MoviePosterItem key={movie.id} movie={movie} width={posterWidth} showCaption source="home_feed"/>)}
        </View>
    ), [shows?.shows, gutter, posterWidth, contentPadding]);

    const skeletonGrid = (
        <View style={[styles.skeletonGrid, {paddingHorizontal: contentPadding}]}>
            {Array.from({length: columns * 2}, (_, i) => <View key={i} style={{paddingBottom: POSTER_CAPTION_HEIGHT}}><PosterSkeleton width={posterWidth}/></View>)}
        </View>
    );

    return (
        <HoverCardHost resetKey={hoverKey}>
            <Screen overlays={<>
                <TopBarSlot/>
                {lastIndex > 0 && movies.length > 0 ? <ScrollProgress current={Math.min(lastIndex, movies.length)} total={totalCount}
                    atTop={atTop} onScrollToTop={() => {Analytics.scrollToTop(); listRef.current?.scrollToOffset({offset: 0, animated: true});}}
                    bottomInset={insets.bottom} visible={!atTop}/> : null}
            </>}>
                <FlatList ref={listRef} data={rows} keyExtractor={(item) => item.key} renderItem={renderRow}
                    style={[styles.list, {maxWidth: contentMaxWidth}]} contentContainerStyle={{paddingTop: topBarHeight, paddingBottom: insets.bottom + 80}}
                    ListHeaderComponent={<>
                        <CatalogIntro/>
                        <View style={[styles.sectionHeading, {marginHorizontal: gutter, borderBottomColor: colors.border}]}>
                            <View style={styles.headingLabel}><Ionicons name="star" size={19} color={colors.accent}/><ThemedText accessibilityRole="header" type="heading">Popular movies</ThemedText></View>
                            <CatalogLink label="View all popular movies" compact="View all" href="/movies?sort_by=download_count&order_by=desc"/>
                        </View>
                        {featured.loading && featured.movies.length === 0 ? (
                            <View style={[styles.popularSkeleton, {paddingHorizontal: contentPadding}]}>{Array.from({length: 6}, (_, i) => <View key={i} style={{paddingBottom: POSTER_CAPTION_HEIGHT}}><PosterSkeleton width={popularWidth}/></View>)}</View>
                        ) : featured.movies.length > 0 ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: contentPadding}}>
                                {featured.movies.map((movie) => <MoviePosterItem key={movie.id} movie={movie} width={popularWidth} showCaption source="home_popular"/>)}
                            </ScrollView>
                        ) : <CatalogRetry message={featured.error ? 'Popular movies couldn’t load.' : 'No popular movies yet.'} onRetry={reloadFeatured}/>}
                        <View style={[styles.savedLinks, {paddingHorizontal: gutter}]}>
                            <CatalogLink label={watchlist.length > 0 ? `Your watchlist · ${watchlist.length} saved` : 'Your watchlist'} href="/watchlist"/>
                            <CatalogLink label="Explore TV shows" href="/shows"/>
                        </View>
                        <WebAdvertisement gutter={gutter}/>
                        <View style={[styles.sectionHeading, {marginHorizontal: gutter, borderBottomColor: colors.border}]}>
                            <View style={styles.catalogHeading}>
                                <ThemedText accessibilityRole="header" type="heading">{chip === 'new' ? 'Latest additions' : `${chipFor(chip).label} movies`}</ThemedText>
                                {totalCount !== null ? <ThemedText type="caption" style={{color: colors.textMuted}}>{totalCount.toLocaleString()} titles</ThemedText> : null}
                            </View>
                            <CatalogLink label="Browse all movies" compact="Browse all" href="/movies"/>
                        </View>
                        <ChipBar chips={FEED_CHIPS} active={chip} onSelect={selectChip} contentPadding={gutter}/>
                    </>}
                    ListEmptyComponent={loading ? skeletonGrid : <CatalogRetry message={error ? 'Movies couldn’t load.' : 'No movies in this category yet.'} onRetry={reload}/>}
                    ListFooterComponent={<>
                        {loading && movies.length > 0 && !refreshing ? skeletonGrid : null}
                        {error && movies.length > 0 ? <CatalogRetry message="Couldn’t load more movies." onRetry={() => {lastRequestedCount.current = -1; loadMore();}}/> : null}
                        {!loading && !error && hasMore && movies.length > 0 ? (
                            <View style={styles.loadMore}><PressableScale onPress={requestMore} accessibilityRole="button" accessibilityLabel="Load more movies"
                                contentStyle={[styles.retryButton, {borderColor: colors.borderStrong}]}><ThemedText type="caption" style={{color: colors.accent}}>Load more movies</ThemedText></PressableScale></View>
                        ) : null}
                        <HomeFooter/>
                    </>}
                    onViewableItemsChanged={onViewableItemsChanged} viewabilityConfig={viewabilityConfig} onEndReached={more} onEndReachedThreshold={0.5}
                    onScroll={onScroll} scrollEventThrottle={64}
                    refreshControl={<RefreshControl refreshing={refreshing || featured.refreshing} onRefresh={refresh} tintColor={colors.accent} colors={[colors.accent]} progressViewOffset={topBarHeight}/>}
                    initialNumToRender={4} maxToRenderPerBatch={4} windowSize={Platform.OS === 'web' ? 13 : 9}
                    keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}/>
            </Screen>
        </HoverCardHost>
    );
}

const styles = StyleSheet.create({
    list: {flex: 1, width: '100%', alignSelf: 'center'},
    intro: {alignItems: 'center', paddingTop: Spacing.xxl, paddingBottom: Spacing.xl},
    eyebrow: {letterSpacing: 1.7, marginBottom: Spacing.sm},
    introTitle: {fontSize: 38, lineHeight: 46, textAlign: 'center'},
    introTitlePhone: {fontSize: 27, lineHeight: 34},
    introCopy: {fontSize: 15, lineHeight: 22, marginTop: Spacing.sm, textAlign: 'center'},
    searchBox: {width: '100%', maxWidth: 600, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.pill, paddingLeft: 16, paddingRight: 5, marginTop: Spacing.xl, gap: 10},
    searchInput: {flex: 1, minWidth: 0, height: 50, fontSize: 16, fontFamily: FontFamily.regular, paddingVertical: 0},
    searchButton: {minHeight: 40, borderRadius: Radius.pill, justifyContent: 'center', paddingHorizontal: 18},
    quickLinks: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: Spacing.xl, marginTop: Spacing.sm},
    link: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 44},
    sectionHeading: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: Spacing.md, paddingBottom: Spacing.sm, marginTop: Spacing.md, marginBottom: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth},
    headingLabel: {flexDirection: 'row', alignItems: 'center', gap: Spacing.sm},
    catalogHeading: {gap: 2},
    posterRow: {flexDirection: 'row', paddingBottom: Spacing.md},
    popularSkeleton: {flexDirection: 'row', overflow: 'hidden'},
    skeletonGrid: {flexDirection: 'row', flexWrap: 'wrap'},
    savedLinks: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.sm, marginTop: Spacing.sm, marginBottom: Spacing.sm},
    retry: {alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xl},
    retryText: {textAlign: 'center', fontSize: 14},
    retryButton: {borderWidth: 1, borderRadius: Radius.pill, minHeight: 44, paddingHorizontal: Spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm},
    loadMore: {alignItems: 'center', paddingVertical: Spacing.xl},
});
