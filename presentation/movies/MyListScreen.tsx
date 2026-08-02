import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import type {Movie} from '@/domain';
import {Analytics} from '@/lib/analytics-events';
import {toggleWatchlist} from '@/lib/watchlist';
import {LinearGradient} from '../components/linear-gradient';
import {PressableScale, enterRise, shiftLayout} from '../components/motion';
import {ThemedText} from '../components/themed-text';
import {ThemedView} from '../components/themed-view';
import {Radius, Spacing, Typography} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';
import {useResponsive} from '../hooks/use-responsive';
import {usePlayer, type PlayerVideo} from '../player/PlayerContext';
import {HoverCardHost} from './components/HoverCard';
import {MoviePosterItem} from './components/MoviePosterItem';
import {ScrollProgress} from './components/ScrollProgress';
import {TopBar, useTopBarHeight} from './components/TopBar';
import {metaParts, thumbFor} from './components/format';
import {POSTER_GAP, POSTER_MIN_WIDTH} from './components/moviePosterLayout';
import {useGoTo} from './constants/destinations';
import {useWatchlist} from './useWatchlist';

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
    const count = `${movies.length} ${movies.length === 1 ? 'video' : 'videos'}`;

    const heading = (
        <View style={isPhone ? styles.headingOverlay : styles.headingBeside}>
            <ThemedText
                type="title"
                style={isPhone ? styles.onCoverTitle : {color: colors.text}}
            >
                My List
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
                    contentStyle={[styles.playAll, {backgroundColor: colors.accent}]}
                >
                    <Ionicons name="play" size={16} color={colors.onAccent}/>
                    <ThemedText style={[styles.playAllLabel, {color: colors.onAccent}]}>
                        Play all
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

function SavedPoster({movie, width}: {movie: Movie; width: number}) {
    const {colors} = usePalette();

    return (
        <Animated.View layout={shiftLayout} style={styles.cell}>
            <MoviePosterItem movie={movie} width={width} source="my_list" hideRankFlag/>
            <PressableScale
                onPress={() => {
                    Analytics.watchlistRemove(movie);
                    toggleWatchlist(movie);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${movie.title} from My List`}
                hitSlop={8}
                pressedScale={0.86}
                pressedOpacity={0.6}
                hoveredScale={1.08}
                style={styles.removeAnchor}
                contentStyle={[styles.removeButton, {backgroundColor: colors.scrim}]}
            >
                <Ionicons name="close" size={16} color="#FFFFFF"/>
            </PressableScale>
        </Animated.View>
    );
}

export function MyListScreen() {
    const insets = useSafeAreaInsets();
    const {colors} = usePalette();
    const {width, contentMaxWidth, gutter} = useResponsive();
    const topBarHeight = useTopBarHeight();
    const movies = useWatchlist();
    const player = usePlayer();
    const goTo = useGoTo();

    const listRef = useRef<FlatList<Movie>>(null);
    const prevCountRef = useRef(0);
    const [lastVisibleIndex, setLastVisibleIndex] = useState(0);
    const [isAtTop, setIsAtTop] = useState(true);

    const queue = useMemo(
        () => movies.map(toPlayerVideo).filter((video): video is PlayerVideo => video !== null),
        [movies]
    );

    const playAll = useCallback(() => {
        const first = queue[0];
        if (!first) return;
        player.setQueue(queue);
        player.open(first);
        goTo(`/movie/${first.movieId}`);
    }, [goTo, player, queue]);

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
        if (movies.length < prevCountRef.current) setLastVisibleIndex(0);
        prevCountRef.current = movies.length;
    }, [movies.length]);

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
        ({item}: {item: Movie}) => <SavedPoster movie={item} width={itemWidth}/>,
        [itemWidth]
    );

    return (
        <HoverCardHost>
            <ThemedView style={styles.container}>
                {movies.length === 0 ? (
                    <Animated.View
                        entering={enterRise()}
                        style={[styles.empty, {paddingTop: topBarHeight, paddingBottom: bottomInset}]}
                    >
                        <Ionicons name="bookmark-outline" size={48} color={colors.textFaint}/>
                        <ThemedText type="heading" style={styles.emptyTitle}>
                            Your list is empty
                        </ThemedText>
                        <ThemedText style={[styles.emptyBody, {color: colors.textMuted}]}>
                            Open any movie and tap Save to keep it here.
                        </ThemedText>
                        <PressableScale
                            onPress={() => {
                                Analytics.browseAllOpen('my_list_empty');
                                goTo('/browse');
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Find something to watch"
                            pressedScale={0.95}
                            pressedOpacity={0.85}
                            hoveredScale={1.03}
                            contentStyle={[styles.cta, {backgroundColor: colors.accent}]}
                        >
                            <Ionicons name="search" size={16} color={colors.onAccent}/>
                            <ThemedText style={[styles.ctaLabel, {color: colors.onAccent}]}>
                                Find something to watch
                            </ThemedText>
                        </PressableScale>
                    </Animated.View>
                ) : (
                    <FlatList
                        ref={listRef}
                        key={`grid-${numColumns}`}
                        data={movies}
                        numColumns={numColumns}
                        keyExtractor={(item: Movie) => String(item.id)}
                        renderItem={renderItem}
                        ListHeaderComponent={
                            <View style={[styles.header, {paddingHorizontal: POSTER_GAP / 2}]}>
                                <PlaylistHeader
                                    movies={movies}
                                    canPlayAll={queue.length > 0}
                                    onPlayAll={playAll}
                                />
                            </View>
                        }
                        onViewableItemsChanged={onViewableItemsChanged}
                        viewabilityConfig={viewabilityConfig}
                        onScroll={onScroll}
                        scrollEventThrottle={16}
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
                )}
                <ScrollProgress
                    current={Math.min(lastVisibleIndex + 1, movies.length)}
                    total={movies.length}
                    atTop={isAtTop}
                    onScrollToTop={scrollToTop}
                    bottomInset={bottomInset}
                    visible={movies.length > 0}
                />
                <TopBar active="my-list"/>
            </ThemedView>
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
    removeButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },

    empty: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: Spacing.xs},
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
