import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {router} from 'expo-router';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import type {CastMember, Movie, MovieDetails, Torrent} from '@/domain';
import {Analytics} from '@/lib/analytics-events';
import {PressableScale, enterFade, enterRise} from '../components/motion';
import {ThemedText} from '../components/themed-text';
import {Radius, Spacing, Typography} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';
import {useResponsive} from '../hooks/use-responsive';
import {usePlayer, type PlayerVideo} from '../player/PlayerContext';
import {DescriptionCard} from './components/DescriptionCard';
import {HoverCardHost} from './components/HoverCard';
import {MovieRail} from './components/MovieRail';
import {ScreenshotLightbox} from './components/ScreenshotLightbox';
import {TopBar, useTopBarHeight} from './components/TopBar';
import {TorrentNoticeSheet} from './components/TorrentNoticeSheet';
import {VideoRow} from './components/VideoRow';
import {WatchActions} from './components/WatchActions';
import {WatchProviders} from './components/WatchProviders';
import {metaParts, thumbFor} from './components/format';
import {useGoTo} from './constants/destinations';
import {Genre} from './constants/movieFilterOptions';
import type {MovieDetailsViewModel} from './useMovieDetailsViewModel';

const IS_WEB = Platform.OS === 'web';
const WIDE_MIN_WIDTH = 900;
const RIGHT_COLUMN_WIDTH = 402;
const LEFT_COLUMN_MAX = 1100;
const LEFT_COLUMN_MIN = 360;
const COLUMN_GAP = 24;
const PLAYER_ASPECT = 16 / 9;
const DRAG_STRIP_HEIGHT = 24;
const DRAG_ACTIVATE_OFFSET = 12;
const MINIMIZE_DISTANCE = 40;
const MINIMIZE_VELOCITY = 520;
const TORRENT_GAP = 10;
const TORRENT_MIN_WIDTH = 232;
const UP_NEXT_THUMB_MAX = 176;
const UP_NEXT_THUMB_RATIO = 0.44;
const SUGGESTION_SOURCE = 'watch_up_next';
const RELATED_TITLE = 'More like this';
const RELATED_POSTER_PHONE = 118;
const RELATED_POSTER_LARGE = 132;

const GENRE_VALUES = new Set<string>(Object.values(Genre));

function genreHref(genre: string): string | null {
    if (typeof genre !== 'string') return null;
    const value = genre.trim().toLowerCase();
    return GENRE_VALUES.has(value) && value !== Genre.All ? `/movies?genre=${value}` : null;
}

function headlineParts(details: MovieDetails): string[] {
    return [
        details.rating > 0 ? `${details.rating.toFixed(1)}/10` : null,
        ...metaParts(details),
        ...details.genres,
    ].filter((part): part is string => !!part);
}

function toPlayerQueue(movies: Movie[]): PlayerVideo[] {
    const queue: PlayerVideo[] = [];
    for (const movie of movies) {
        const videoId = movie.ytTrailerCode;
        if (!videoId) continue;
        queue.push({
            movieId: movie.id,
            videoId,
            title: movie.title,
            subtitle: metaParts(movie).join(' · '),
            thumbnailUrl: thumbFor(movie),
        });
    }
    return queue;
}

export function WatchScreen({viewModel}: {viewModel: MovieDetailsViewModel}) {
    const {details, suggestions, loading, error, reload} = viewModel;
    const {colors} = usePalette();
    const {width, contentMaxWidth, gutter, isPhone} = useResponsive();
    const insets = useSafeAreaInsets();
    const topBarHeight = useTopBarHeight();
    const {video, open, minimize, setInlineRect, setQueue} = usePlayer();
    const goTo = useGoTo();

    const [titleExpanded, setTitleExpanded] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [noticeTorrent, setNoticeTorrent] = useState<Torrent | null>(null);

    const wide = width >= WIDE_MIN_WIDTH;
    const trailerCode = details?.ytTrailerCode || undefined;
    const movieId = details?.id;

    const layout = useMemo(() => {
        if (!wide) {
            return {
                playerX: 0,
                playerY: topBarHeight,
                playerWidth: width,
                playerHeight: Math.round(width / PLAYER_ASPECT),
                columnWidth: width,
                columnX: 0,
            };
        }
        const usable = Math.min(width, contentMaxWidth) - gutter * 2;
        const columnWidth = Math.max(
            LEFT_COLUMN_MIN,
            Math.min(LEFT_COLUMN_MAX, usable - RIGHT_COLUMN_WIDTH - COLUMN_GAP)
        );
        const rowWidth = columnWidth + COLUMN_GAP + RIGHT_COLUMN_WIDTH;
        const columnX = Math.max(gutter, Math.round((width - rowWidth) / 2));
        return {
            playerX: columnX,
            playerY: topBarHeight + Spacing.xl,
            playerWidth: columnWidth,
            playerHeight: Math.round(columnWidth / PLAYER_ASPECT),
            columnWidth,
            columnX,
        };
    }, [contentMaxWidth, gutter, topBarHeight, wide, width]);

    const {playerX, playerY, playerWidth, playerHeight, columnWidth, columnX} = layout;
    const belowPlayerGap = IS_WEB ? Spacing.md : DRAG_STRIP_HEIGHT;
    const pad = wide ? 0 : gutter;
    const bodyWidth = columnWidth - pad * 2;
    const upNextThumb = wide
        ? Math.round(RIGHT_COLUMN_WIDTH * UP_NEXT_THUMB_RATIO)
        : Math.min(UP_NEXT_THUMB_MAX, Math.round(bodyWidth * UP_NEXT_THUMB_RATIO));

    const scrollYRef = useRef(0);
    const ownedIdRef = useRef<number | null>(null);
    const videoRef = useRef(video);

    useEffect(() => {
        videoRef.current = video;
    }, [video]);

    const owns = video?.movieId != null && video.movieId === movieId;

    useEffect(() => {
        if (error) Analytics.loadError('details');
    }, [error]);

    useEffect(() => {
        setTitleExpanded(false);
    }, [movieId]);

    useEffect(() => {
        if (!details) return;
        if (!trailerCode) {
            ownedIdRef.current = null;
            setInlineRect(null);
            minimize();
            return;
        }
        ownedIdRef.current = details.id;
        open({
            movieId: details.id,
            videoId: trailerCode,
            title: details.title,
            subtitle: metaParts(details).join(' · '),
            thumbnailUrl: thumbFor(details),
        });
    }, [details, minimize, open, setInlineRect, trailerCode]);

    useEffect(() => {
        if (!trailerCode || !owns) return;
        setQueue(toPlayerQueue(suggestions));
    }, [owns, setQueue, suggestions, trailerCode]);

    const publishRect = useCallback(
        (scrollY: number) => {
            scrollYRef.current = scrollY;
            setInlineRect({
                x: playerX,
                y: wide ? playerY - scrollY : playerY,
                width: playerWidth,
                height: playerHeight,
            });
        },
        [playerHeight, playerWidth, playerX, playerY, setInlineRect, wide]
    );

    useEffect(() => {
        if (!trailerCode) return;
        publishRect(scrollYRef.current);
    }, [publishRect, trailerCode]);

    const handleScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (!trailerCode) return;
            publishRect(event.nativeEvent.contentOffset.y);
        },
        [publishRect, trailerCode]
    );

    useEffect(
        () => () => {
            const owned = ownedIdRef.current;
            if (owned == null || videoRef.current?.movieId !== owned) return;
            setInlineRect(null);
            minimize();
        },
        [minimize, setInlineRect]
    );

    const collapseAndLeave = useCallback(() => {
        minimize();
        if (router.canGoBack()) router.back();
        else router.replace('/');
    }, [minimize]);

    const dragToMinimize = useMemo(
        () =>
            Gesture.Pan()
                .runOnJS(true)
                .activeOffsetY(DRAG_ACTIVATE_OFFSET)
                .failOffsetX([-20, 20])
                .onEnd((event) => {
                    if (event.translationY > MINIMIZE_DISTANCE || event.velocityY > MINIMIZE_VELOCITY) {
                        collapseAndLeave();
                    }
                }),
        [collapseAndLeave]
    );

    const handleGenre = useCallback(
        (genre: string) => {
            Analytics.genreOpen(genre);
            const href = genreHref(genre);
            if (href) goTo(href);
        },
        [goTo]
    );

    const handleShare = useCallback(() => {
        if (!details) return;
        const link = trailerCode ? `https://youtu.be/${trailerCode}` : undefined;
        const heading = details.titleLong || details.title;
        void Share.share({
            title: details.title,
            message: link ? `${heading}\n${link}` : heading,
            ...(link ? {url: link} : {}),
        }).catch(() => {});
    }, [details, trailerCode]);

    const handleDownload = useCallback(() => {
        if (!details) return;
        const torrent = details.torrents[0];
        if (!torrent) return;
        Analytics.torrentTap(details.id, torrent);
        setNoticeTorrent(torrent);
    }, [details]);

    const handleTorrent = useCallback(
        (torrent: Torrent) => {
            if (!details) return;
            Analytics.torrentTap(details.id, torrent);
            setNoticeTorrent(torrent);
        },
        [details]
    );

    const handleScreenshot = useCallback(
        (index: number) => {
            if (!details) return;
            Analytics.screenshotOpen(details.id, index);
            setLightboxIndex(index);
        },
        [details]
    );

    if (loading) {
        return (
            <View style={[styles.root, {backgroundColor: colors.background}]}>
                <View style={[styles.centered, {paddingTop: topBarHeight}]}>
                    <ActivityIndicator size="large" color={colors.accent}/>
                </View>
                <TopBar/>
            </View>
        );
    }

    if (error || !details) {
        return (
            <View style={[styles.root, {backgroundColor: colors.background}]}>
                <View style={[styles.centered, {paddingTop: topBarHeight}]}>
                    <Animated.View entering={enterRise()} style={styles.errorBox}>
                        <Ionicons name="cloud-offline-outline" size={52} color={colors.textFaint}/>
                        <ThemedText style={[Typography.watchTitle, styles.errorTitle, {color: colors.text}]}>
                            Couldn&apos;t load this movie
                        </ThemedText>
                        <ThemedText style={[styles.errorMessage, {color: colors.textMuted}]}>
                            {error ?? 'Movie not found'}
                        </ThemedText>
                        <PressableScale
                            onPress={() => {
                                Analytics.retry('details');
                                reload();
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Try again"
                            pressedScale={0.95}
                            pressedOpacity={0.85}
                        >
                            <View style={[styles.retryButton, {backgroundColor: colors.accent}]}>
                                <Ionicons name="refresh" size={18} color={colors.onAccent}/>
                                <ThemedText style={[styles.retryLabel, {color: colors.onAccent}]}>
                                    Try again
                                </ThemedText>
                            </View>
                        </PressableScale>
                    </Animated.View>
                </View>
                <TopBar/>
            </View>
        );
    }

    const primary = (
        <>
            <Headline
                details={details}
                expanded={titleExpanded}
                onToggle={() => setTitleExpanded((value) => !value)}
            />
            <WatchActions details={details} onShare={handleShare} onDownload={handleDownload} pad={pad}/>
            <DescriptionCard details={details} onGenrePress={handleGenre}/>
            <WatchProviders details={details} pad={pad}/>
        </>
    );

    const secondary = (
        <>
            <ScreenshotStrip
                screenshots={details.screenshotUrls}
                pad={pad}
                onPress={handleScreenshot}
            />
            <CastStrip cast={details.cast} pad={pad}/>
            <TorrentGrid torrents={details.torrents} bodyWidth={bodyWidth} onPress={handleTorrent}/>
        </>
    );

    const upNext = <UpNextSection movies={suggestions} thumbWidth={upNextThumb}/>;

    const relatedRail = (
        <RelatedRail
            movies={suggestions}
            posterWidth={isPhone ? RELATED_POSTER_PHONE : RELATED_POSTER_LARGE}
            gutter={pad}
        />
    );

    const reserved = trailerCode ? (
        <View
            style={[
                styles.reserved,
                {left: playerX, top: playerY, width: playerWidth, height: playerHeight},
            ]}
            pointerEvents="box-none"
        />
    ) : null;

    const inlineBackdrop = trailerCode ? null : (
        <View style={{width: playerWidth, height: playerHeight, marginHorizontal: -pad}}>
            <NoTrailerBackdrop details={details} radius={wide ? Radius.card : 0}/>
        </View>
    );

    const dragStrip =
        !IS_WEB && trailerCode ? (
            <GestureDetector gesture={dragToMinimize}>
                <View
                    style={[
                        styles.dragStrip,
                        {left: playerX, top: playerY + playerHeight, width: playerWidth},
                    ]}
                />
            </GestureDetector>
        ) : null;

    const overlays = (
        <>
            {reserved}
            {dragStrip}
            <TopBar/>
            {lightboxIndex != null ? (
                <ScreenshotLightbox
                    images={details.screenshotUrls}
                    initialIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                />
            ) : null}
            <TorrentNoticeSheet
                torrent={noticeTorrent}
                onClose={() => {
                    if (noticeTorrent) Analytics.torrentNoticeDismissed(details.id);
                    setNoticeTorrent(null);
                }}
                bottomInset={insets.bottom}
            />
        </>
    );

    if (!wide) {
        return (
            <HoverCardHost>
                <View style={[styles.root, {backgroundColor: colors.background}]}>
                    <ScrollView
                        style={styles.fill}
                        showsVerticalScrollIndicator={false}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        contentContainerStyle={[
                            styles.stack,
                            {
                                paddingHorizontal: pad,
                                paddingTop: trailerCode
                                    ? topBarHeight + playerHeight + belowPlayerGap
                                    : topBarHeight,
                                paddingBottom: insets.bottom + Spacing.xxl,
                            },
                        ]}
                    >
                        {inlineBackdrop}
                        {primary}
                        {relatedRail}
                        {secondary}
                    </ScrollView>
                    {overlays}
                </View>
            </HoverCardHost>
        );
    }

    return (
        <HoverCardHost>
            <View style={[styles.root, {backgroundColor: colors.background}]}>
                <View style={[styles.row, {paddingLeft: columnX, paddingTop: playerY}]}>
                    <View style={{width: columnWidth}}>
                        <ScrollView
                            style={styles.fill}
                            showsVerticalScrollIndicator={false}
                            onScroll={handleScroll}
                            scrollEventThrottle={16}
                            contentContainerStyle={[
                                styles.stack,
                                {paddingBottom: insets.bottom + Spacing.xxl},
                            ]}
                        >
                            {trailerCode ? (
                                <View style={{height: playerHeight}}/>
                            ) : (
                                <View style={{height: playerHeight}}>
                                    <NoTrailerBackdrop details={details} radius={Radius.card}/>
                                </View>
                            )}
                            <View style={{height: Math.max(Spacing.lg, belowPlayerGap)}}/>
                            {primary}
                            {secondary}
                        </ScrollView>
                    </View>
                    <View style={styles.columnGap}/>
                    <View style={styles.upNextColumn}>
                        <ScrollView
                            style={styles.fill}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{paddingBottom: insets.bottom + Spacing.xxl}}
                        >
                            {upNext}
                        </ScrollView>
                    </View>
                </View>
                {overlays}
            </View>
        </HoverCardHost>
    );
}

function Headline({
    details,
    expanded,
    onToggle,
}: {
    details: MovieDetails;
    expanded: boolean;
    onToggle: () => void;
}) {
    const {colors} = usePalette();
    const meta = headlineParts(details).join(' · ');

    return (
        <View style={styles.headline}>
            <PressableScale
                onPress={onToggle}
                accessibilityRole="button"
                accessibilityLabel={details.titleLong || details.title}
                accessibilityState={{expanded}}
                pressedScale={1}
                pressedOpacity={0.75}
            >
                <ThemedText
                    numberOfLines={expanded ? undefined : 2}
                    style={[Typography.watchTitle, {color: colors.text}]}
                >
                    {expanded ? details.titleLong || details.title : details.title}
                </ThemedText>
            </PressableScale>
            {meta ? (
                <ThemedText
                    numberOfLines={expanded ? undefined : 1}
                    style={[Typography.videoMeta, styles.headlineMeta, {color: colors.textMuted}]}
                >
                    {meta}
                </ThemedText>
            ) : null}
        </View>
    );
}

function SectionHeading({title}: {title: string}) {
    const {colors} = usePalette();
    return (
        <ThemedText style={[Typography.sectionTitle, styles.sectionHeading, {color: colors.text}]}>
            {title}
        </ThemedText>
    );
}

function UpNextSection({movies, thumbWidth}: {movies: Movie[]; thumbWidth: number}) {
    if (movies.length === 0) return null;
    return (
        <View style={styles.upNextSection}>
            <SectionHeading title={RELATED_TITLE}/>
            <View style={styles.upNextList}>
                {movies.map((movie) => (
                    <VideoRow
                        key={movie.id}
                        movie={movie}
                        thumbWidth={thumbWidth}
                        source={SUGGESTION_SOURCE}
                    />
                ))}
            </View>
        </View>
    );
}

function RelatedRail({
    movies,
    posterWidth,
    gutter,
}: {
    movies: Movie[];
    posterWidth: number;
    gutter: number;
}) {
    if (movies.length === 0) return null;
    return (
        <View style={[styles.relatedRail, {marginHorizontal: -gutter}]}>
            <MovieRail
                title={RELATED_TITLE}
                titleType="section"
                movies={movies}
                variant="standard"
                posterWidth={posterWidth}
                gutter={gutter}
            />
        </View>
    );
}

function ScreenshotStrip({
    screenshots,
    pad,
    onPress,
}: {
    screenshots: string[];
    pad: number;
    onPress: (index: number) => void;
}) {
    const {colors} = usePalette();
    if (screenshots.length === 0) return null;

    return (
        <View style={styles.section}>
            <SectionHeading title="Screenshots"/>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{marginHorizontal: -pad}}
                contentContainerStyle={[styles.strip, {paddingHorizontal: pad}]}
            >
                {screenshots.map((uri, index) => (
                    <PressableScale
                        key={uri}
                        onPress={() => onPress(index)}
                        accessibilityRole="button"
                        accessibilityLabel={`View screenshot ${index + 1} full screen`}
                        pressedScale={0.97}
                        pressedOpacity={0.85}
                        hoveredScale={1.02}
                    >
                        <Image
                            source={{uri}}
                            style={[styles.screenshot, {backgroundColor: colors.surfaceSunken}]}
                            contentFit="cover"
                            transition={200}
                            cachePolicy="memory-disk"
                        />
                    </PressableScale>
                ))}
            </ScrollView>
        </View>
    );
}

function CastStrip({cast, pad}: {cast: CastMember[]; pad: number}) {
    if (cast.length === 0) return null;
    return (
        <View style={styles.section}>
            <SectionHeading title="Cast"/>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{marginHorizontal: -pad}}
                contentContainerStyle={[styles.strip, {paddingHorizontal: pad}]}
            >
                {cast.map((member, index) => (
                    <CastCard key={`${member.name}-${index}`} member={member}/>
                ))}
            </ScrollView>
        </View>
    );
}

function CastCard({member}: {member: CastMember}) {
    const {colors} = usePalette();
    return (
        <View style={styles.castCard}>
            {member.imageUrl ? (
                <Image
                    source={{uri: member.imageUrl}}
                    style={[styles.castImage, {backgroundColor: colors.surfaceSunken}]}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                />
            ) : (
                <View
                    style={[
                        styles.castImage,
                        styles.castPlaceholder,
                        {backgroundColor: colors.surfaceSunken, borderColor: colors.border},
                    ]}
                >
                    <Ionicons name="person" size={26} color={colors.textFaint}/>
                </View>
            )}
            <ThemedText
                numberOfLines={1}
                style={[Typography.videoMeta, styles.castName, {color: colors.text}]}
            >
                {member.name}
            </ThemedText>
            {member.character ? (
                <ThemedText
                    numberOfLines={1}
                    style={[Typography.videoMeta, styles.castCharacter, {color: colors.textMuted}]}
                >
                    {member.character}
                </ThemedText>
            ) : null}
        </View>
    );
}

function TorrentGrid({
    torrents,
    bodyWidth,
    onPress,
}: {
    torrents: Torrent[];
    bodyWidth: number;
    onPress: (torrent: Torrent) => void;
}) {
    if (torrents.length === 0) return null;

    const columns = Math.max(1, Math.floor(bodyWidth / TORRENT_MIN_WIDTH));
    const cardWidth = Math.floor((bodyWidth - TORRENT_GAP * (columns - 1)) / columns);

    return (
        <View style={styles.section}>
            <SectionHeading title="Available qualities"/>
            <View style={styles.torrentGrid}>
                {torrents.map((torrent, index) => (
                    <TorrentCard
                        key={`${torrent.quality}-${torrent.size}-${index}`}
                        torrent={torrent}
                        width={cardWidth}
                        onPress={() => onPress(torrent)}
                    />
                ))}
            </View>
        </View>
    );
}

function TorrentCard({
    torrent,
    width,
    onPress,
}: {
    torrent: Torrent;
    width: number;
    onPress: () => void;
}) {
    const {colors} = usePalette();
    const label = [torrent.type, torrent.videoCodec].filter(Boolean).join(' · ') || 'Torrent';

    return (
        <PressableScale
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${torrent.quality} ${label}, ${torrent.size}`}
            pressedScale={0.98}
            pressedOpacity={0.85}
            contentStyle={[
                styles.torrentCard,
                {width, backgroundColor: colors.surfaceSunken, borderColor: colors.border},
            ]}
        >
            <View style={styles.torrentTop}>
                <View style={[styles.qualityPill, {backgroundColor: colors.accentSoft}]}>
                    <ThemedText style={[styles.qualityLabel, {color: colors.accent}]}>
                        {torrent.quality}
                    </ThemedText>
                </View>
                <ThemedText
                    numberOfLines={1}
                    style={[Typography.videoMeta, styles.torrentType, {color: colors.text}]}
                >
                    {label}
                </ThemedText>
            </View>
            <View style={styles.torrentMetaRow}>
                <ThemedText
                    numberOfLines={1}
                    style={[Typography.videoMeta, {color: colors.textMuted}]}
                >
                    {torrent.size}
                </ThemedText>
                <View style={styles.seedPeer}>
                    <Ionicons name="arrow-up" size={11} color={colors.seed}/>
                    <ThemedText style={[Typography.videoMeta, {color: colors.seed}]}>
                        {torrent.seeds}
                    </ThemedText>
                </View>
                <View style={styles.seedPeer}>
                    <Ionicons name="arrow-down" size={11} color={colors.peer}/>
                    <ThemedText style={[Typography.videoMeta, {color: colors.peer}]}>
                        {torrent.peers}
                    </ThemedText>
                </View>
            </View>
        </PressableScale>
    );
}

function NoTrailerBackdrop({details, radius}: {details: MovieDetails; radius: number}) {
    const {colors} = usePalette();
    const uri = thumbFor(details);

    return (
        <Animated.View
            entering={enterFade()}
            style={[
                StyleSheet.absoluteFill,
                styles.backdrop,
                {backgroundColor: colors.surfaceSunken, borderRadius: radius},
            ]}
        >
            {uri ? (
                <Image
                    source={{uri}}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={220}
                    cachePolicy="memory-disk"
                />
            ) : null}
            <View style={[StyleSheet.absoluteFill, styles.backdropScrim]}/>
            <Ionicons name="videocam-off-outline" size={26} color="#FFFFFF"/>
            <ThemedText style={styles.backdropLabel} lightColor="#FFFFFF" darkColor="#FFFFFF">
                No trailer available
            </ThemedText>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    root: {flex: 1},
    fill: {flex: 1},
    row: {flex: 1, flexDirection: 'row'},
    columnGap: {width: COLUMN_GAP},
    stack: {gap: Spacing.md},
    centered: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl},

    errorBox: {alignItems: 'center', maxWidth: 360},
    errorTitle: {marginTop: Spacing.lg, textAlign: 'center'},
    errorMessage: {fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: Spacing.sm},
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        borderRadius: Radius.pill,
        paddingHorizontal: 22,
        paddingVertical: 12,
        marginTop: Spacing.xl,
    },
    retryLabel: {fontSize: 15, fontWeight: '600'},

    reserved: {position: 'absolute', zIndex: 20},
    dragStrip: {position: 'absolute', height: DRAG_STRIP_HEIGHT, zIndex: 20},
    backdrop: {alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, overflow: 'hidden'},
    backdropScrim: {backgroundColor: 'rgba(0, 0, 0, 0.55)'},
    backdropLabel: {fontSize: 14, lineHeight: 19, fontWeight: '600'},

    headline: {gap: 2},
    headlineMeta: {marginTop: 2},

    section: {gap: Spacing.sm, marginTop: Spacing.sm},
    upNextSection: {gap: Spacing.sm},
    sectionHeading: {marginBottom: 2},
    upNextColumn: {width: RIGHT_COLUMN_WIDTH},
    upNextList: {gap: Spacing.md},
    relatedRail: {marginTop: Spacing.sm, marginBottom: -Spacing.md},
    strip: {gap: Spacing.md},

    screenshot: {width: 260, aspectRatio: 16 / 9, borderRadius: Radius.card},

    castCard: {width: 92, alignItems: 'center', gap: 2},
    castImage: {width: 76, height: 76, borderRadius: 38, marginBottom: Spacing.xs},
    castPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
    },
    castName: {fontWeight: '600', textAlign: 'center'},
    castCharacter: {textAlign: 'center'},

    torrentGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: TORRENT_GAP},
    torrentCard: {
        borderRadius: Radius.card,
        borderWidth: StyleSheet.hairlineWidth,
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    torrentTop: {flexDirection: 'row', alignItems: 'center', gap: Spacing.sm},
    qualityPill: {
        borderRadius: Radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 3,
        minWidth: 56,
        alignItems: 'center',
    },
    qualityLabel: {fontSize: 12.5, lineHeight: 17, fontWeight: '700'},
    torrentType: {flex: 1, textTransform: 'capitalize'},
    torrentMetaRow: {flexDirection: 'row', alignItems: 'center', gap: Spacing.md},
    seedPeer: {flexDirection: 'row', alignItems: 'center', gap: 2},
});
