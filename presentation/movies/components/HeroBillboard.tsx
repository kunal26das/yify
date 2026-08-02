import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {router} from 'expo-router';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import type {Movie} from '@/domain';
import {Duration, PressableScale, enterFade, enterPop, enterRise} from '../../components/motion';
import {FontFamily, Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {useResponsive} from '../../hooks/use-responsive';
import {LinearGradient} from '../../components/linear-gradient';
import {ThemedText} from '../../components/themed-text';
import {Analytics} from '@/lib/analytics-events';
import {toggleWatchlist} from '@/lib/watchlist';
import {useIsInWatchlist} from '../useWatchlist';
import {HeroTrailerLayer} from './HeroTrailerLayer';
import {useTopTenRank} from './TopTenContext';
import {Thumbnail} from './Thumbnail';
import {thumbPlaceholder} from './format';

const ROTATE_MS = 6500;
const ROTATE_WITH_TRAILER_MS = 30000;
const TRAILER_START_DELAY_MS = 2400;
const SETTLE_MS = 520;

type Colors = ReturnType<typeof usePalette>['colors'];

interface HeroBillboardProps {
    movies: Movie[];
    width: number;
    height: number;
    rounded?: boolean;
    trailers?: Record<number, string | null>;
    backdrops?: Record<number, string | null>;
    onRequestTrailer?: (movieId: number) => void;
}

export function HeroBillboard({
                                  movies,
                                  width,
                                  height,
                                  rounded,
                                  trailers,
                                  backdrops,
                                  onRequestTrailer,
                              }: HeroBillboardProps) {
    const {colors} = usePalette();
    const {isDesktop} = useResponsive();
    const insets = useSafeAreaInsets();
    const count = movies.length;
    const looped = count > 1;

    const [index, setIndex] = useState(0);
    const [measuredPage, setMeasuredPage] = useState(0);
    const [muted, setMuted] = useState(true);
    const [mode, setMode] = useState<'idle' | 'ambient' | 'feature'>('idle');
    const [trailerPlaying, setTrailerPlaying] = useState(false);
    const indexRef = useRef(0);
    const scrollXRef = useRef(0);
    const scrollRef = useRef<ScrollView>(null);
    const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const trailerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingTargetRef = useRef<number | null>(null);
    const scheduleNextRef = useRef<() => void>(() => {});

    const page = measuredPage > 0 ? measuredPage : Math.round(width);

    const activeMovie = movies[index];
    const activeTrailer = activeMovie ? trailers?.[activeMovie.id] : undefined;

    const data = useMemo(() => (looped ? [...movies, movies[0]] : movies), [looped, movies]);

    const realForData = useCallback(
        (d: number) =>
            looped ? (d >= count ? 0 : Math.max(0, d)) : Math.max(0, Math.min(count - 1, d)),
        [looped, count]
    );

    const scrollToData = useCallback(
        (d: number, animated: boolean) => {
            scrollRef.current?.scrollTo({x: d * page, animated});
            if (!animated || page <= 0) return;
            pendingTargetRef.current = d;
            if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
            settleTimerRef.current = setTimeout(() => {
                const target = pendingTargetRef.current;
                pendingTargetRef.current = null;
                if (target == null) return;
                const settled = target * page;
                if (Math.abs(scrollXRef.current - settled) <= 1) return;
                scrollRef.current?.scrollTo({x: settled, animated: false});
                scrollXRef.current = settled;
            }, SETTLE_MS);
        },
        [page]
    );

    const clearAuto = useCallback(() => {
        if (autoTimerRef.current) {
            clearTimeout(autoTimerRef.current);
            autoTimerRef.current = null;
        }
    }, []);

    const scheduleNext = useCallback(() => {
        clearAuto();
        if (!looped || page <= 0) return;
        if (mode === 'feature') return;
        autoTimerRef.current = setTimeout(() => {
            scrollToData(indexRef.current + 1, true);
            scheduleNextRef.current();
        }, mode === 'ambient' ? ROTATE_WITH_TRAILER_MS : ROTATE_MS);
    }, [clearAuto, looped, page, scrollToData, mode]);

    useEffect(() => {
        scheduleNextRef.current = scheduleNext;
    }, [scheduleNext]);

    const setActive = useCallback(
        (real: number) => {
            if (real === indexRef.current || real < 0 || real >= count) return;
            indexRef.current = real;
            setIndex(real);
        },
        [count]
    );

    const scheduleReposition = useCallback(() => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
            if (looped && page > 0 && Math.abs(scrollXRef.current - count * page) < page * 0.04) {
                scrollToData(0, false);
            }
        }, 90);
    }, [looped, page, count, scrollToData]);

    const onScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (page <= 0) return;
            const x = e.nativeEvent.contentOffset.x;
            scrollXRef.current = x;
            setActive(realForData(Math.round(x / page)));
            scheduleNext();
            scheduleReposition();
        },
        [page, setActive, realForData, scheduleNext, scheduleReposition]
    );

    const onBeginDrag = useCallback(() => {
        pendingTargetRef.current = null;
        if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    }, []);

    const onMomentumEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (page <= 0) return;
            const x = e.nativeEvent.contentOffset.x;
            const nearest = Math.round(x / page);
            if (Math.abs(x - nearest * page) > 1) scrollToData(nearest, false);
        },
        [page, scrollToData]
    );

    const goTo = useCallback(
        (real: number) => {
            scrollToData(real, true);
            setActive(real);
        },
        [scrollToData, setActive]
    );

    useEffect(() => {
        if (page > 0) scrollToData(indexRef.current, false);
        scheduleNext();
        return () => {
            clearAuto();
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
        };
    }, [page, scrollToData, scheduleNext, clearAuto]);

    useEffect(() => {
        setMode('idle');
        setTrailerPlaying(false);
        if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current);
        if (!activeMovie) return;
        onRequestTrailer?.(activeMovie.id);
        if (!activeTrailer) return;
        trailerTimerRef.current = setTimeout(() => {
            setMode('ambient');
            Analytics.heroTrailerAutoplay(activeMovie);
        }, TRAILER_START_DELAY_MS);
        return () => {
            if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current);
        };
    }, [activeMovie, activeTrailer, onRequestTrailer]);

    const seenRef = useRef<Set<number>>(new Set());
    useEffect(() => {
        if (!activeMovie || seenRef.current.has(activeMovie.id)) return;
        seenRef.current.add(activeMovie.id);
        Analytics.heroImpression(activeMovie, index);
    }, [index, activeMovie]);

    const onPlay = useCallback(() => {
        if (!activeMovie) return;
        Analytics.heroCta(activeMovie);
        if (activeTrailer) {
            Analytics.trailerPlay(activeMovie);
            setMuted(false);
            setMode('feature');
            return;
        }
        router.push(`/movie/${activeMovie.id}`);
    }, [activeMovie, activeTrailer]);

    const toggleMute = useCallback(() => {
        if (!activeMovie) return;
        setMuted((m) => {
            Analytics.heroMuteToggle(activeMovie, !m);
            return !m;
        });
    }, [activeMovie]);

    if (count === 0) return null;

    return (
        <View
            style={[
                styles.container,
                {width, height, backgroundColor: colors.surfaceSunken},
                rounded && styles.rounded,
            ]}
        >
            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                style={{width, height}}
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={onScroll}
                onMomentumScrollEnd={onMomentumEnd}
                onScrollBeginDrag={onBeginDrag}
                onLayout={(e) => setMeasuredPage(Math.round(e.nativeEvent.layout.width))}
                decelerationRate="fast"
                scrollEnabled={mode !== 'feature'}
            >
                {data.map((movie, i) => (
                    <HeroSlide
                        key={`${movie.id}:${i}`}
                        movie={movie}
                        width={width}
                        height={height}
                        colors={colors}
                        trailerId={i === index && mode !== 'idle' ? activeTrailer ?? null : null}
                        backdropUrl={backdrops?.[movie.id] ?? null}
                        feature={mode === 'feature'}
                        muted={muted}
                        onPlay={onPlay}
                        onTrailerStarted={() => setTrailerPlaying(true)}
                    />
                ))}
            </ScrollView>

            {mode !== 'idle' && activeTrailer && trailerPlaying ? (
                <Animated.View
                    entering={enterPop()}
                    style={[styles.muteButton, isDesktop ? styles.muteButtonWide : {top: insets.top + 64}]}
                >
                    <PressableScale
                        onPress={toggleMute}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={muted ? 'Unmute trailer' : 'Mute trailer'}
                        pressedScale={0.86}
                        pressedOpacity={0.7}
                        hoveredScale={1.1}
                        style={styles.muteHit}
                        contentStyle={styles.muteHit}
                    >
                        <Animated.View key={muted ? 'muted' : 'loud'} entering={enterPop()}>
                            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#fff"/>
                        </Animated.View>
                    </PressableScale>
                </Animated.View>
            ) : null}

            {looped && mode !== 'feature' ? (
                !isDesktop ? (
                    <View style={styles.dots} pointerEvents="box-none">
                        {movies.map((m, i) => (
                            <Pressable
                                key={m.id}
                                hitSlop={6}
                                onPress={() => goTo(i)}
                                accessibilityRole="button"
                                accessibilityState={{selected: i === index}}
                                accessibilityLabel={`Featured: ${m.title}`}
                            >
                                <Animated.View
                                    style={[
                                        styles.dot,
                                        i === index ? styles.dotActive : styles.dotInactive,
                                        {
                                            transitionProperty: ['width', 'backgroundColor'],
                                            transitionDuration: Duration.base,
                                            transitionTimingFunction: 'ease-out',
                                        },
                                    ]}
                                />
                            </Pressable>
                        ))}
                    </View>
                ) : (
                    <HeroThumbStrip movies={movies} index={index} onSelect={goTo}/>
                )
            ) : null}
        </View>
    );
}

const THUMB_WIDTH = 74;
const THUMB_HEIGHT = Math.round((THUMB_WIDTH * 9) / 16);

function HeroThumbStrip({
                            movies,
                            index,
                            onSelect,
                        }: {
    movies: Movie[];
    index: number;
    onSelect: (i: number) => void;
}) {
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({
            x: Math.max(0, (index - 2) * (THUMB_WIDTH + 8)),
            animated: true,
        });
    }, [index]);

    return (
        <View style={styles.thumbStrip} pointerEvents="box-none">
            <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbRow}
            >
                {movies.map((m, i) => {
                    const active = i === index;
                    const art = thumbPlaceholder(m) ?? m.posterUrls[m.posterUrls.length - 1];
                    return (
                        <PressableScale
                            key={m.id}
                            onPress={() => onSelect(i)}
                            accessibilityRole="button"
                            accessibilityState={{selected: active}}
                            accessibilityLabel={`Featured: ${m.title}`}
                            pressedScale={0.93}
                            pressedOpacity={0.8}
                            hoveredScale={1.08}
                            contentStyle={[
                                styles.thumb,
                                active ? styles.thumbActive : styles.thumbInactive,
                                {
                                    transitionProperty: ['borderColor', 'opacity'],
                                    transitionDuration: Duration.base,
                                },
                            ]}
                        >
                            {art ? (
                                <Image
                                    source={{uri: art}}
                                    style={StyleSheet.absoluteFill}
                                    contentFit="cover"
                                    transition={120}
                                    cachePolicy="memory-disk"
                                />
                            ) : null}
                        </PressableScale>
                    );
                })}
            </ScrollView>
        </View>
    );
}

function HeroSlide({
                       movie,
                       width,
                       height,
                       colors,
                       trailerId,
                       backdropUrl,
                       feature,
                       muted,
                       onPlay,
                       onTrailerStarted,
                   }: {
    movie: Movie;
    width: number;
    height: number;
    colors: Colors;
    trailerId: string | null;
    backdropUrl: string | null;
    feature: boolean;
    muted: boolean;
    onPlay: () => void;
    onTrailerStarted: () => void;
}) {
    const rank = useTopTenRank(movie.id);
    const {isDesktop} = useResponsive();
    const {gradients} = usePalette();
    const saved = useIsInWatchlist(movie.id);
    const meta = [
        movie.year ? String(movie.year) : null,
        formatRuntime(movie.runtimeMinutes),
        movie.mpaRating || null,
    ].filter(Boolean) as string[];

    const openDetails = (source: string) => {
        Analytics.movieOpen(movie, source);
        router.push(`/movie/${movie.id}`);
    };

    return (
        <View style={[styles.slide, {width, height}]}>
            {backdropUrl ? (
                <Image
                    source={{uri: backdropUrl}}
                    placeholder={thumbPlaceholder(movie) ? {uri: thumbPlaceholder(movie)} : undefined}
                    placeholderContentFit="cover"
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={260}
                    priority="high"
                    cachePolicy="memory-disk"
                />
            ) : (
                <Thumbnail movie={movie} style={StyleSheet.absoluteFill} transition={260} priority="high"/>
            )}

            {trailerId ? (
                <HeroTrailerLayer
                    videoId={trailerId}
                    width={width}
                    height={height}
                    muted={muted}
                    controls={feature}
                    onStarted={onTrailerStarted}
                />
            ) : null}

            <LinearGradient
                colors={['rgba(6,6,8,0.30)', 'rgba(6,6,8,0.10)', 'rgba(6,6,8,0.55)', 'rgba(6,6,8,0.94)']}
                bands={16}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
            />
            <LinearGradient
                colors={['rgba(6,6,8,0.72)', 'rgba(6,6,8,0)']}
                direction="horizontal"
                bands={10}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
            />
            <LinearGradient
                colors={['rgba(6,6,8,0)', colors.background]}
                bands={12}
                style={styles.meltFade}
                pointerEvents="none"
            />

            <View style={styles.content} pointerEvents="box-none">
                <Pressable
                    onPress={() => openDetails('hero_slide')}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${movie.title}`}
                >
                    <Animated.View entering={enterRise()}>
                        <ThemedText style={[styles.tagline, {color: colors.gold}]} numberOfLines={1}>
                            {taglineFor(movie, rank)}
                        </ThemedText>
                    </Animated.View>

                    <Animated.View entering={enterRise(1)}>
                        <ThemedText type="display" style={styles.title} numberOfLines={2}>
                            {movie.title}
                        </ThemedText>
                    </Animated.View>

                    <Animated.View entering={enterRise(2)} style={styles.metaRow}>
                        {movie.rating > 0 ? (
                            <View style={styles.metaItem}>
                                <Ionicons name="star" size={12} color={colors.gold}/>
                                <ThemedText style={[styles.metaText, styles.metaRating]}>
                                    {movie.rating.toFixed(1)}
                                </ThemedText>
                            </View>
                        ) : null}
                        {meta.map((m, i) => (
                            <View key={m} style={styles.metaItem}>
                                {(i > 0 || movie.rating > 0) ? <View style={styles.metaDot}/> : null}
                                <ThemedText style={styles.metaText}>{m}</ThemedText>
                            </View>
                        ))}
                        {movie.genres.slice(0, 2).map((g) => (
                            <View key={g} style={styles.metaItem}>
                                <View style={styles.metaDot}/>
                                <ThemedText style={styles.metaText}>{g}</ThemedText>
                            </View>
                        ))}
                    </Animated.View>

                    {movie.summary ? (
                        <Animated.View entering={enterRise(3)}>
                            <ThemedText style={styles.summary} numberOfLines={2}>
                                {movie.summary}
                            </ThemedText>
                        </Animated.View>
                    ) : null}
                </Pressable>

                <Animated.View entering={enterFade(4)} style={[styles.ctaRow, isDesktop ? styles.ctaRowWide : null]}>
                    <PressableScale
                        onPress={onPlay}
                        accessibilityRole="button"
                        accessibilityLabel={`Watch ${movie.title}`}
                        pressedScale={0.95}
                        pressedOpacity={0.85}
                        hoveredScale={1.03}
                        style={styles.ctaFlex}
                    >
                        <LinearGradient colors={gradients.accent} direction="horizontal" style={styles.playButton}>
                            <Ionicons name="play" size={20} color="#fff"/>
                            <ThemedText style={styles.playLabel} numberOfLines={1}>Watch Now</ThemedText>
                        </LinearGradient>
                    </PressableScale>

                    <PressableScale
                        onPress={() => {
                            Analytics.heroMoreInfo(movie);
                            openDetails('hero_more_info');
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`More info about ${movie.title}`}
                        pressedScale={0.95}
                        pressedOpacity={0.85}
                        hoveredScale={1.03}
                        style={styles.ctaFlex}
                    >
                        <View style={styles.infoButton}>
                            <Ionicons name="information-circle-outline" size={20} color="#fff"/>
                            <ThemedText style={styles.infoLabel} numberOfLines={1}>More Info</ThemedText>
                        </View>
                    </PressableScale>

                    <PressableScale
                        onPress={() => {
                            const added = toggleWatchlist(movie);
                            if (added) Analytics.watchlistAdd(movie);
                            else Analytics.watchlistRemove(movie);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={
                            saved ? `Remove ${movie.title} from Watchlist` : `Add ${movie.title} to Watchlist`
                        }
                        pressedScale={0.88}
                        pressedOpacity={0.85}
                        hoveredScale={1.08}
                    >
                        <Animated.View
                            style={[
                                styles.addButton,
                                saved && {backgroundColor: colors.accent, borderColor: colors.accent},
                                {
                                    transitionProperty: ['backgroundColor', 'borderColor'],
                                    transitionDuration: Duration.base,
                                },
                            ]}
                        >
                            <Animated.View key={saved ? 'saved' : 'unsaved'} entering={enterPop()}>
                                <Ionicons
                                    name={saved ? 'checkmark' : 'add'}
                                    size={22}
                                    color={saved ? colors.onAccent : '#fff'}
                                />
                            </Animated.View>
                        </Animated.View>
                    </PressableScale>
                </Animated.View>
            </View>
        </View>
    );
}

function taglineFor(movie: Movie, rank: number | null): string {
    if (rank) return `#${rank} in Movies Today`;
    if (movie.rating >= 8) return 'Critically acclaimed';
    if (movie.genres.length > 0) return `Popular in ${movie.genres[0]}`;
    return 'Featured today';
}

function formatRuntime(minutes: number): string | null {
    if (!minutes || minutes <= 0) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const styles = StyleSheet.create({
    container: {overflow: 'hidden'},
    rounded: {borderRadius: Radius.xl},
    slide: {justifyContent: 'flex-end', overflow: 'hidden'},
    meltFade: {position: 'absolute', left: 0, right: 0, bottom: 0, height: 96},

    content: {paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl + Spacing.sm},

    tagline: {fontSize: 14, marginBottom: 8, fontFamily: FontFamily.bold},

    title: {color: '#fff', fontSize: 34, lineHeight: 38},
    metaRow: {flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden', marginTop: 8},
    metaItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
    metaDot: {width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.6)', marginHorizontal: 8},
    metaText: {color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: FontFamily.semibold},
    metaRating: {fontFamily: FontFamily.extrabold},
    summary: {color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20, marginTop: 10, maxWidth: 560},

    ctaRow: {flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18},
    ctaFlex: {flex: 1},
    ctaRowWide: {maxWidth: '42%'},
    playButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 48,
        paddingHorizontal: 16,
        borderRadius: Radius.pill,
    },
    playLabel: {fontSize: 16, color: '#fff', fontFamily: FontFamily.bold},
    addButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(109,109,110,0.5)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.35)',
    },
    infoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 48,
        paddingHorizontal: 16,
        borderRadius: Radius.pill,
        backgroundColor: 'rgba(109,109,110,0.65)',
    },
    infoLabel: {fontSize: 16, color: '#fff', fontFamily: FontFamily.bold},

    muteButton: {
        position: 'absolute',
        right: Spacing.xl,
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(6,6,8,0.35)',
        zIndex: 15,
    },
    muteButtonWide: {bottom: Spacing.xxl + THUMB_HEIGHT + 20},
    muteHit: {flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center'},

    thumbStrip: {
        position: 'absolute',
        right: 0,
        bottom: Spacing.xxl + 8,
        maxWidth: '52%',
        zIndex: 12,
    },
    thumbRow: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.xl},
    thumb: {
        width: THUMB_WIDTH,
        height: THUMB_HEIGHT,
        borderRadius: Radius.sm,
        overflow: 'hidden',
        backgroundColor: 'rgba(6,6,8,0.6)',
    },
    thumbActive: {borderWidth: 2, borderColor: '#fff'},
    thumbInactive: {borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)', opacity: 0.62},

    dots: {
        position: 'absolute',
        bottom: Spacing.md,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
    },
    dot: {width: 7, height: 7, borderRadius: 4},
    dotActive: {backgroundColor: '#fff', width: 22},
    dotInactive: {backgroundColor: 'rgba(255,255,255,0.45)'},
});
