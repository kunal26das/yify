import Ionicons from '@expo/vector-icons/Ionicons';
import {Image} from 'expo-image';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {libraryMovieWatched, liveLibraryCollections, pickWatchlistMovie, selectWatchlistMovies, type Movie, type WatchlistViewOptions} from '@/domain';
import {Analytics} from '@/presentation/analytics/events';
import {LinearGradient} from '../components/linear-gradient';
import {useConfirm} from '../components/confirm-dialog';
import {PressableScale, enterRise, shiftLayout} from '../components/motion';
import {ThemedText} from '../components/themed-text';
import {Screen} from '../components/screen';
import {useToast} from '../components/toast';
import {useLibraryRepository} from '../di/DependenciesContext';
import {Radius, Spacing, Typography} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';
import {usePreferences} from '../hooks/use-preferences';
import {useResponsive} from '../hooks/use-responsive';
import {usePlayer, type PlayerVideo} from '../player/PlayerContext';
import {HoverCardHost} from './components/HoverCard';
import {MoviePosterItem} from './components/MoviePosterItem';
import {ScrollProgress} from './components/ScrollProgress';
import {useTopBarHeight} from './components/TopBar';
import {metaParts, thumbFor} from './components/format';
import {POSTER_GAP, POSTER_MIN_WIDTH} from './components/moviePosterLayout';
import {useGoTo} from './constants/destinations';
import {useRemoveFromWatchlist, useWatchlist} from './useWatchlist';
import {useLibrary} from './useLibrary';
import {WatchlistControls} from './components/WatchlistControls';
import {WatchlistActionsSheet} from './components/WatchlistActionsSheet';

const COVER_ASPECT = 16 / 9;
const COVER_WIDTH_WIDE = 360;
const COVER_SCRIM = ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.28)', 'rgba(0, 0, 0, 0.86)'] as const;
const SCROLL_AT_TOP_THRESHOLD = 8;
const REMOVE_OFFSET = POSTER_GAP / 2 + Spacing.xs;

function toPlayerVideo(movie: Movie): PlayerVideo | null {
    if (!movie.ytTrailerCode) return null;
    const subtitle = metaParts(movie).join(' · ');
    return {
        movieId: movie.id,
        videoId: movie.ytTrailerCode,
        title: movie.title,
        subtitle: subtitle || undefined,
        thumbnailUrl: thumbFor(movie),
    };
}

function PlaylistHeader({
                            movies,
                            canPlayAll,
                            onPlayAll,
                        }: {
    movies: Movie[];
    canPlayAll: boolean;
    onPlayAll: () => void;
}) {
    const {colors} = usePalette();
    const {isPhone, width, contentMaxWidth, gutter} = useResponsive();

    const coverWidth = isPhone ? Math.min(width, contentMaxWidth) - gutter * 2 : COVER_WIDTH_WIDE;
    const coverHeight = Math.round(coverWidth / COVER_ASPECT);
    const cover = movies[0] ? thumbFor(movies[0]) : undefined;
    const count = `${movies.length} ${movies.length === 1 ? 'title' : 'titles'}`;

    const heading = (
        <View style={isPhone ? styles.headingOverlay : styles.headingBeside}>
            <ThemedText
                type="title"
                style={isPhone ? styles.onCoverTitle : {color: colors.text}}
            >
                Watchlist
            </ThemedText>
            <ThemedText
                style={[
                    Typography.videoMeta,
                    isPhone ? styles.onCoverMeta : {color: colors.textMuted},
                ]}
            >
                {count}
            </ThemedText>
            {canPlayAll ? (
                <PressableScale
                    onPress={onPlayAll}
                    accessibilityRole="button"
                    accessibilityLabel="Play all trailers"
                    pressedScale={0.95}
                    pressedOpacity={0.85}
                    hoveredScale={1.03}
                    contentStyle={[styles.playAll, {backgroundColor: colors.accentStrong}]}
                >
                    <Ionicons name="play" size={16} color={colors.onAccent}/>
                    <ThemedText style={[styles.playAllLabel, {color: colors.onAccent}]}>
                        Play trailers
                    </ThemedText>
                </PressableScale>
            ) : null}
        </View>
    );

    return (
        <Animated.View entering={enterRise()} style={isPhone ? undefined : styles.headerRow}>
            <View
                style={[
                    styles.cover,
                    {width: coverWidth, height: coverHeight, backgroundColor: colors.surfaceSunken},
                ]}
            >
                {cover ? (
                    <Image
                        source={{uri: cover}}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                    />
                ) : (
                    <View style={styles.coverFallback}>
                        <Ionicons name="bookmark" size={40} color={colors.textFaint}/>
                    </View>
                )}
                <LinearGradient
                    colors={COVER_SCRIM}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                />
                {isPhone ? heading : null}
            </View>
            {isPhone ? null : heading}
        </Animated.View>
    );
}

function SavedPoster({movie, width, watched, onManage, onToggleWatched}: {
    movie: Movie;
    width: number;
    watched: boolean;
    onManage: (movie: Movie) => void;
    onToggleWatched: (movie: Movie) => void;
}) {
    const {colors} = usePalette();
    return (
        <Animated.View layout={shiftLayout} style={styles.cell}>
            <MoviePosterItem movie={movie} width={width} source="my_list" hideRankFlag/>
            <PressableScale onPress={() => onToggleWatched(movie)} accessibilityRole="checkbox"
                            hitSlop={4}
                            accessibilityState={{checked: watched}}
                            accessibilityLabel={`${watched ? 'Mark as to watch' : 'Mark as watched'}: ${movie.title}`}
                            style={styles.watchedAnchor}
                            contentStyle={[styles.removeButton, {backgroundColor: watched ? colors.accentStrong : colors.scrim}]}>
                <Ionicons name={watched ? 'checkmark-circle' : 'checkmark-circle-outline'} size={20} color="#FFFFFF"/>
            </PressableScale>
            <PressableScale onPress={() => onManage(movie)} accessibilityRole="button"
                            hitSlop={4}
                            accessibilityLabel={`Manage ${movie.title}`} style={styles.removeAnchor}
                            contentStyle={[styles.removeButton, {backgroundColor: colors.scrim}]}>
                <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF"/>
            </PressableScale>
        </Animated.View>
    );
}

export function WatchlistScreen() {
    const insets = useSafeAreaInsets();
    const {colors} = usePalette();
    const {width, contentMaxWidth, gutter} = useResponsive();
    const topBarHeight = useTopBarHeight();
    const movies = useWatchlist();
    const library = useLibraryRepository();
    const libraryState = useLibrary();
    const removeFromWatchlist = useRemoveFromWatchlist();
    const {confirmWatchlistRemoval} = usePreferences();
    const confirm = useConfirm();
    const toast = useToast();
    const [viewOptions, setOptions] = useState<WatchlistViewOptions>({status: 'all', sort: 'saved'});
    const [manage, setManage] = useState<{movie: Movie | null} | null>(null);
    const closeManage = useCallback(() => setManage(null), []);
    const collections = useMemo(() => liveLibraryCollections(libraryState), [libraryState]);
    const options = useMemo(() => viewOptions.collectionId && !collections.some((collection) => collection.id === viewOptions.collectionId)
        ? {...viewOptions, collectionId: undefined} : viewOptions, [collections, viewOptions]);
    const visible = useMemo(() => selectWatchlistMovies(movies, libraryState, options), [movies, libraryState, options]);
    const canPick = visible.some((movie) => !libraryMovieWatched(libraryState, movie.id));
    const genres = useMemo(() => [...new Set(movies.flatMap((movie) => movie.genres))].sort(), [movies]);
    const player = usePlayer();
    const goTo = useGoTo();

    const listRef = useRef<FlatList<Movie>>(null);
    const prevCountRef = useRef(0);
    const [lastVisibleIndex, setLastVisibleIndex] = useState(0);
    const [isAtTop, setIsAtTop] = useState(true);

    const queue = useMemo(
        () => visible.map(toPlayerVideo).filter((video): video is PlayerVideo => video !== null),
        [visible]
    );

    const playAll = useCallback(() => {
        const first = queue[0];
        if (!first) return;
        player.setQueue(queue);
        player.open(first);
        goTo(`/movie/${first.movieId}`);
    }, [goTo, player, queue]);

    const pickForMe = useCallback(() => {
        const choice = pickWatchlistMovie(movies, libraryState, options);
        if (choice) goTo(`/movie/${choice.id}`);
    }, [goTo, movies, libraryState, options]);

    const toggleWatched = useCallback((movie: Movie) => {
        try {
            const watched = !library.isWatched(movie.id);
            library.setWatched(movie.id, watched);
            toast(watched ? 'Marked as watched' : 'Added back to To watch');
        } catch {
            toast('Watched status could not be updated.', 'alert-circle-outline');
        }
    }, [library, toast]);

    const remove = useCallback((movie: Movie) => {
        const apply = () => {
            Analytics.watchlistRemove(movie);
            removeFromWatchlist(movie);
        };
        if (!confirmWatchlistRemoval) {
            apply();
            return;
        }
        confirm({title: 'Remove from Watchlist?', message: `${movie.title} will be removed from your Watchlist.`,
            confirmLabel: 'Remove', icon: 'bookmark-outline', onConfirm: apply});
    }, [confirm, confirmWatchlistRemoval, removeFromWatchlist]);

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
    const bottomInset = insets.bottom;

    useEffect(() => {
        if (visible.length < prevCountRef.current) setLastVisibleIndex(0);
        prevCountRef.current = visible.length;
    }, [visible.length]);

    const onScroll = useCallback(
        ({nativeEvent}: {nativeEvent: {contentOffset: {y: number}}}) => {
            setIsAtTop(nativeEvent.contentOffset.y <= SCROLL_AT_TOP_THRESHOLD);
        },
        []
    );

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

    const scrollToTop = useCallback(() => {
        Analytics.scrollToTop();
        listRef.current?.scrollToOffset({offset: 0, animated: true});
    }, []);

    const renderItem = useCallback(
        ({item}: {item: Movie}) => <SavedPoster movie={item} width={itemWidth}
                                                   watched={libraryMovieWatched(libraryState, item.id)}
                                                   onManage={(movie) => setManage({movie})} onToggleWatched={toggleWatched}/>,
        [itemWidth, libraryState, toggleWatched]
    );

    return (
        <HoverCardHost>
            <Screen
                overlays={
                    <>
                        {visible.length > 0 ? <ScrollProgress
                            current={Math.min(lastVisibleIndex + 1, visible.length)}
                            total={visible.length}
                            atTop={isAtTop}
                            onScrollToTop={scrollToTop}
                            bottomInset={bottomInset}
                            visible={visible.length > 0}
                        /> : null}
                    </>
                }
            >
                <FlatList
                    ref={listRef}
                    key={`grid-${numColumns}`}
                    data={visible}
                    numColumns={numColumns}
                    keyExtractor={(item: Movie) => String(item.id)}
                    renderItem={renderItem}
                    ListHeaderComponent={
                        <View style={[styles.header, {paddingHorizontal: POSTER_GAP / 2}]}>
                            {movies.length > 0 ? (
                                <PlaylistHeader movies={movies} canPlayAll={queue.length > 0} onPlayAll={playAll}/>
                            ) : <ThemedText type="title">Watchlist</ThemedText>}
                            <WatchlistControls options={options} onChange={setOptions} genres={genres} collections={collections}
                                               onManageCollections={() => setManage({movie: null})} onPick={pickForMe} canPick={canPick}/>
                            {visible.length !== movies.length ? (
                                <ThemedText accessibilityLiveRegion="polite" style={[styles.results, {color: colors.textMuted}]}>
                                    {visible.length} of {movies.length} titles
                                </ThemedText>
                            ) : null}
                        </View>
                    }
                    ListEmptyComponent={
                        <Animated.View entering={enterRise()} style={styles.empty}>
                            <Ionicons name={movies.length === 0 ? 'bookmark-outline' : 'search-outline'} size={42} color={colors.textFaint}/>
                            <ThemedText type="heading" style={styles.emptyTitle}>
                                {movies.length === 0 ? 'Your list is empty' : 'No matching titles'}
                            </ThemedText>
                            <ThemedText style={[styles.emptyBody, {color: colors.textMuted}]}>
                                {movies.length === 0 ? 'Open any movie and tap Save to keep it here.' : 'Try another search or change your filters.'}
                            </ThemedText>
                            <PressableScale onPress={() => {
                                if (movies.length > 0) {
                                    setOptions({status: 'all', sort: 'saved'});
                                    return;
                                }
                                Analytics.browseAllOpen('my_list_empty');
                                goTo('/movies');
                            }} accessibilityRole="button" accessibilityLabel={movies.length === 0 ? 'Find something to watch' : 'Clear watchlist filters'}
                                            contentStyle={[styles.cta, {backgroundColor: colors.accentStrong}]}>
                                <ThemedText style={[styles.ctaLabel, {color: colors.onAccent}]}>
                                    {movies.length === 0 ? 'Find something to watch' : 'Clear filters'}
                                </ThemedText>
                            </PressableScale>
                        </Animated.View>
                    }
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={viewabilityConfig}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    keyboardShouldPersistTaps="handled"
                    initialNumToRender={numColumns * 4}
                    maxToRenderPerBatch={numColumns * 3}
                    windowSize={11}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                        width: gridWidth,
                        alignSelf: 'center',
                        paddingHorizontal: contentPad,
                        paddingTop: topBarHeight + Spacing.lg,
                        paddingBottom: bottomInset + 96,
                    }}
                />
                <WatchlistActionsSheet visible={manage != null} movie={manage?.movie ?? null}
                                       library={library} state={libraryState} onClose={closeManage} onRemove={remove}
                                       onSelectCollection={(collectionId) => setOptions((current) => ({...current, collectionId}))}/>

            </Screen>
        </HoverCardHost>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1},

    header: {paddingBottom: Spacing.xl},
    headerRow: {flexDirection: 'row', alignItems: 'stretch', gap: Spacing.xl},
    cover: {borderRadius: Radius.card, overflow: 'hidden', justifyContent: 'flex-end'},
    coverFallback: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headingOverlay: {padding: Spacing.lg, alignItems: 'flex-start', gap: Spacing.xs},
    headingBeside: {flex: 1, justifyContent: 'center', alignItems: 'flex-start', gap: Spacing.xs},
    onCoverTitle: {color: '#FFFFFF'},
    onCoverMeta: {color: 'rgba(255, 255, 255, 0.78)'},
    playAll: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        height: 36,
        paddingHorizontal: 16,
        borderRadius: Radius.pill,
        marginTop: Spacing.sm,
    },
    playAllLabel: {fontSize: 14, lineHeight: 18, fontWeight: '600'},

    cell: {position: 'relative'},
    removeAnchor: {
        position: 'absolute',
        top: REMOVE_OFFSET,
        right: REMOVE_OFFSET,
        zIndex: 20,
        elevation: 6,
    },
    watchedAnchor: {position: 'absolute', bottom: REMOVE_OFFSET, left: REMOVE_OFFSET, zIndex: 20, elevation: 6},
    removeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },

    results: {fontSize: 13, marginTop: Spacing.sm},
    empty: {alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 64, gap: Spacing.xs},
    emptyTitle: {marginTop: Spacing.md},
    emptyBody: {fontSize: 14, lineHeight: 20, textAlign: 'center'},
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        height: 40,
        paddingHorizontal: 20,
        borderRadius: Radius.pill,
        marginTop: Spacing.lg,
    },
    ctaLabel: {fontSize: 14, lineHeight: 18, fontWeight: '600'},
});
