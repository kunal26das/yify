import Ionicons from '@expo/vector-icons/Ionicons';
import {Image} from 'expo-image';
import {router} from 'expo-router';
import {type ComponentProps, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
    type ScrollViewInstance,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import type {Movie} from '@/domain';
import {Duration, PressableScale} from '../../components/motion';
import {FontFamily, Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {usePreferences} from '../../hooks/use-preferences';
import {usePrivacyChoices} from '../../hooks/use-privacy-choices';
import {useResponsive} from '../../hooks/use-responsive';
import {ThemedText} from '../../components/themed-text';
import {Analytics} from '@/presentation/analytics/events';
import {useToggleWatchlist} from '../useWatchlist';
import {useIsInWatchlist} from '../useWatchlist';
import {HeroTrailerLayer} from './HeroTrailerLayer';
import {Thumbnail} from './Thumbnail';
import {thumbFor, thumbPlaceholder} from './format';
import {useReduceMotion} from '../../hooks/use-reduce-motion';
import {usePreviewActive} from '../../hooks/use-preview-active';

const ROTATE_MS = 6500;
const ROTATE_WITH_TRAILER_MS = 30000;
const TRAILER_START_DELAY_MS = 2400;
const SETTLE_MS = 520;
const SCROLL_IDLE_MS = 140;
const CONTROL_SIZE = 46;
const SELECTOR_HEIGHT = CONTROL_SIZE + Spacing.sm;

type Colors = ReturnType<typeof usePalette>['colors'];

interface HeroBillboardProps {
    visible?: boolean;
    movies: Movie[];
    width: number;
    height: number;
    rounded?: boolean;
    trailers?: Record<number, string | null>;
    backdrops?: Record<number, string | null>;
    onRequestTrailer?: (movieId: number) => void;
}

export function HeroBillboard({
                                  visible = true,
                                  movies,
                                  width,
                                  height,
                                  rounded,
                                  trailers,
                                  backdrops,
                                  onRequestTrailer,
                              }: HeroBillboardProps) {
    const {colors} = usePalette();
    const {gutter} = useResponsive();
    const {playback} = usePreferences();
    const {youtube} = usePrivacyChoices();
    const active = usePreviewActive(visible);
    const count = movies.length;
    const looped = count > 1;

    const [index, setIndex] = useState(0);
    const [measuredPage, setMeasuredPage] = useState(0);
    const [contentHeights, setContentHeights] = useState<Record<string, number>>({});
    const [muted, setMuted] = useState(true);
    const [mode, setMode] = useState<'idle' | 'ambient' | 'feature'>('idle');
    const [trailerPlaying, setTrailerPlaying] = useState(false);
    const indexRef = useRef(0);
    const scrollXRef = useRef(0);
    const scrollRef = useRef<ScrollViewInstance>(null);
    const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const trailerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingTargetRef = useRef<number | null>(null);
    const draggingRef = useRef(false);
    const scheduleNextRef = useRef<() => void>(() => {});
    const settleScrollRef = useRef<() => void>(() => {});

    const page = measuredPage > 0 ? measuredPage : width;
    const split = page >= 760;
    const pageGutter = gutter;
    const innerWidth = Math.max(1, page - pageGutter * 2);
    const gap = split ? (innerWidth >= 1000 ? 48 : 32) : 24;
    const artWidth = split ? Math.round((innerWidth - gap) * 0.56) : innerWidth;
    const artHeight = Math.round(artWidth * 9 / 16);
    const copyWidth = split ? innerWidth - gap - artWidth : innerWidth;
    const verticalPadding = split ? 40 : 20;
    const bottomPadding = split && looped ? Spacing.sm : verticalPadding;
    const selectorHeight = looped ? SELECTOR_HEIGHT : 0;
    const measuredContentHeight = Math.max(0, ...movies.map((movie) => contentHeights[`${movie.id}:${copyWidth}`] ?? 0));
    const contentHeight = measuredContentHeight || (split ? 340 : 280);
    const slideHeight = Math.max(
        height - selectorHeight,
        verticalPadding + bottomPadding + (split ? Math.max(artHeight, contentHeight) : artHeight + gap + contentHeight)
    );
    const totalHeight = slideHeight + selectorHeight;
    const measureContent = useCallback((movieId: number, measuredWidth: number, measuredHeight: number) => {
        const key = `${movieId}:${measuredWidth}`;
        const nextHeight = Math.ceil(measuredHeight);
        setContentHeights((previous) => previous[key] === nextHeight ? previous : {...previous, [key]: nextHeight});
    }, []);

    const activeMovie = movies[index];
    const activeTrailer = activeMovie
        ? trailers?.[activeMovie.id] ?? activeMovie.ytTrailerCode ?? null
        : undefined;

    const data = useMemo(() => (looped ? [...movies, movies[0]] : movies), [looped, movies]);

    const realForData = useCallback(
        (d: number) =>
            looped ? (d >= count ? 0 : Math.max(0, d)) : Math.max(0, Math.min(count - 1, d)),
        [looped, count]
    );

    const setActive = useCallback(
        (real: number) => {
            if (real === indexRef.current || real < 0 || real >= count) return;
            indexRef.current = real;
            setIndex(real);
        },
        [count]
    );

    const clearSettling = useCallback(() => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
        idleTimerRef.current = null;
        settleTimerRef.current = null;
        pendingTargetRef.current = null;
    }, []);

    const scrollToData = useCallback(
        (d: number, animated: boolean) => {
            if (!active || page <= 0 || count === 0) return;
            clearSettling();
            const target = Math.max(0, Math.min(d, looped ? count : count - 1));
            if (animated) {
                pendingTargetRef.current = target;
                settleTimerRef.current = setTimeout(() => settleScrollRef.current(), SETTLE_MS);
            } else {
                scrollXRef.current = target * page;
                setActive(realForData(target));
            }
            scrollRef.current?.scrollTo({x: target * page, animated});
        },
        [active, page, count, looped, clearSettling, setActive, realForData]
    );

    const clearAuto = useCallback(() => {
        if (autoTimerRef.current) {
            clearTimeout(autoTimerRef.current);
            autoTimerRef.current = null;
        }
    }, []);

    const reduceMotion = useReduceMotion();


    const scheduleNext = useCallback(() => {
        clearAuto();
        if (!active || draggingRef.current || reduceMotion) return;
        if (!looped || page <= 0) return;
        if (mode === 'feature') return;
        autoTimerRef.current = setTimeout(() => {
            scrollToData(indexRef.current + 1, true);
            scheduleNextRef.current();
        }, mode === 'ambient' ? ROTATE_WITH_TRAILER_MS : ROTATE_MS);
    }, [active, clearAuto, looped, page, scrollToData, mode, reduceMotion]);

    useEffect(() => {
        scheduleNextRef.current = scheduleNext;
    }, [scheduleNext]);

    const settleScroll = useCallback(() => {
        if (!active || draggingRef.current || page <= 0 || count === 0) return;
        const node = Platform.OS === 'web'
            ? scrollRef.current?.getScrollableNode?.() as {scrollLeft?: number} | null
            : null;
        const x = node?.scrollLeft ?? scrollXRef.current;
        const target = Math.max(0, Math.min(pendingTargetRef.current ?? Math.round(x / page), looped ? count : count - 1));
        const real = realForData(target);
        clearSettling();
        setActive(real);
        if (target !== real || Math.abs(x - target * page) > 0.5) {
            scrollToData(real, false);
        }
        scheduleNextRef.current();
    }, [active, page, count, looped, realForData, clearSettling, setActive, scrollToData]);

    useEffect(() => {
        settleScrollRef.current = settleScroll;
    }, [settleScroll]);

    const scheduleSettle = useCallback(() => {
        if (!active || draggingRef.current) return;
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => settleScrollRef.current(), SCROLL_IDLE_MS);
    }, [active]);

    const onScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (!active || page <= 0) return;
            const x = e.nativeEvent.contentOffset.x;
            scrollXRef.current = x;
            setActive(realForData(Math.round(x / page)));
            if (!draggingRef.current) scheduleNext();
            scheduleSettle();
        },
        [active, page, setActive, realForData, scheduleNext, scheduleSettle]
    );

    const onBeginDrag = useCallback(() => {
        draggingRef.current = true;
        clearSettling();
        clearAuto();
    }, [clearSettling, clearAuto]);

    const onEndDrag = useCallback(() => {
        draggingRef.current = false;
        scheduleSettle();
    }, [scheduleSettle]);

    const onMomentumEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            draggingRef.current = false;
            scrollXRef.current = e.nativeEvent.contentOffset.x;
            settleScroll();
        },
        [settleScroll]
    );

    const goTo = useCallback(
        (real: number) => {
            scrollToData(real, !reduceMotion);
            setActive(real);
        },
        [scrollToData, setActive, reduceMotion]
    );

    useEffect(() => {
        draggingRef.current = false;
        if (active && page > 0) scrollToData(Math.min(indexRef.current, count - 1), false);
        return clearSettling;
    }, [active, page, count, scrollToData, clearSettling]);

    useEffect(() => {
        scheduleNext();
        return clearAuto;
    }, [scheduleNext, clearAuto]);

    useEffect(() => {
        setMode('idle');
        setTrailerPlaying(false);
        if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current);
        if (!active) {
            setMuted(true);
            return;
        }
        if (!activeMovie) return;
        onRequestTrailer?.(activeMovie.id);
        if (!youtube || !activeTrailer || !playback.autoplayTrailers || reduceMotion) return;
        trailerTimerRef.current = setTimeout(() => {
            setMode('ambient');
            Analytics.heroTrailerAutoplay(activeMovie);
        }, TRAILER_START_DELAY_MS);
        return () => {
            if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current);
        };
    }, [active, activeMovie, activeTrailer, onRequestTrailer, playback.autoplayTrailers, reduceMotion, youtube]);

    const seenRef = useRef<Set<number>>(new Set());
    useEffect(() => {
        if (!active || !activeMovie || seenRef.current.has(activeMovie.id)) return;
        seenRef.current.add(activeMovie.id);
        Analytics.heroImpression(activeMovie, index);
    }, [active, index, activeMovie]);

    const onPlay = useCallback(() => {
        if (!activeMovie) return;
        Analytics.heroCta(activeMovie);
        if (activeTrailer && youtube) {
            Analytics.trailerPlay(activeMovie);
            setMuted(false);
            setMode('feature');
            return;
        }
        router.push(`/movie/${activeMovie.id}`);
    }, [activeMovie, activeTrailer, youtube]);

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
                {width, height: totalHeight, backgroundColor: colors.background},
                rounded && styles.rounded,
            ]}
        >
            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                style={{width, height: slideHeight, flexGrow: 0}}
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={onScroll}
                onMomentumScrollEnd={onMomentumEnd}
                onScrollBeginDrag={onBeginDrag}
                onScrollEndDrag={onEndDrag}
                onLayout={(e) => setMeasuredPage(e.nativeEvent.layout.width)}
                decelerationRate="fast"
                scrollEnabled={Platform.OS === 'web' || mode !== 'feature'}
            >
                {data.map((movie, i) => (
                    <HeroSlide
                        key={`${movie.id}:${i}`}
                        movie={movie}
                        width={page}
                        height={slideHeight}
                        gutter={pageGutter}
                        gap={gap}
                        verticalPadding={verticalPadding}
                        bottomPadding={bottomPadding}
                        artWidth={artWidth}
                        artHeight={artHeight}
                        copyWidth={copyWidth}
                        split={split}
                        colors={colors}
                        near={Math.abs(i - index) <= 1 || (looped && i === count && (index === 0 || index === count - 1))}
                        selected={i === index}
                        trailerId={active && i === index && mode !== 'idle' ? activeTrailer ?? null : null}
                        hasTrailer={!!(trailers?.[movie.id] ?? movie.ytTrailerCode)}
                        backdropUrl={backdrops?.[movie.id] ?? null}
                        feature={mode === 'feature'}
                        trailerPlaying={trailerPlaying}
                        muted={muted}
                        captions={playback.trailerCaptions}
                        reduceMotion={reduceMotion}
                        onPlay={onPlay}
                        onToggleMute={toggleMute}
                        onCloseTrailer={() => {
                            setMode('idle');
                            setTrailerPlaying(false);
                        }}
                        onTrailerStarted={() => setTrailerPlaying(true)}
                        onMeasureContent={measureContent}
                    />
                ))}
            </ScrollView>

            {looped ? (
                <View style={[styles.selector, {marginHorizontal: pageGutter}]}>
                    <HeroIconButton
                        icon="chevron-back"
                        label="Previous featured movie"
                        colors={colors}
                        reduceMotion={reduceMotion}
                        onPress={() => goTo((index + count - 1) % count)}
                    />
                    <HeroThumbStrip movies={movies} index={index} colors={colors} reduceMotion={reduceMotion} onSelect={goTo}/>
                    <HeroIconButton
                        icon="chevron-forward"
                        label="Next featured movie"
                        colors={colors}
                        reduceMotion={reduceMotion}
                        onPress={() => goTo((index + 1) % count)}
                    />
                </View>
            ) : null}
        </View>
    );
}

const THUMB_HEIGHT = CONTROL_SIZE;
const THUMB_WIDTH = Math.round(THUMB_HEIGHT * 16 / 9);

function HeroThumbStrip({
    movies,
    index,
    colors,
    reduceMotion,
    onSelect,
}: {
    movies: Movie[];
    index: number;
    colors: Colors;
    reduceMotion: boolean;
    onSelect: (i: number) => void;
}) {
    const scrollRef = useRef<ScrollViewInstance>(null);
    const [focused, setFocused] = useState<number | null>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({
            x: Math.max(0, (index - 1) * (THUMB_WIDTH + 8)),
            animated: !reduceMotion,
        });
    }, [index, reduceMotion]);

    return (
        <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.thumbStrip}
            contentContainerStyle={styles.thumbRow}
        >
            {movies.map((movie, i) => {
                const selected = i === index;
                const art = thumbPlaceholder(movie) ?? movie.posterUrls[movie.posterUrls.length - 1];
                return (
                    <PressableScale
                        key={movie.id}
                        onPress={() => onSelect(i)}
                        onFocus={() => setFocused(i)}
                        onBlur={() => setFocused(null)}
                        accessibilityRole="button"
                        accessibilityState={{selected}}
                        accessibilityLabel={`Featured: ${movie.title}`}
                        pressedScale={reduceMotion ? 1 : 0.96}
                        pressedOpacity={0.8}
                        duration={reduceMotion ? 0 : Duration.fast}
                        style={styles.thumbHit}
                        contentStyle={[
                            styles.thumb,
                            {
                                backgroundColor: colors.surfaceSunken,
                                borderColor: focused === i ? colors.text : selected ? colors.accent : colors.border,
                                opacity: selected || focused === i ? 1 : 0.55,
                            },
                        ]}
                    >
                        {art ? (
                            <Image
                                source={{uri: art}}
                                style={StyleSheet.absoluteFill}
                                contentFit="cover"
                                transition={reduceMotion ? 0 : 120}
                                cachePolicy="memory-disk"
                            />
                        ) : null}
                    </PressableScale>
                );
            })}
        </ScrollView>
    );
}

function HeroSlide({
    movie,
    width,
    height,
    gutter,
    gap,
    verticalPadding,
    bottomPadding,
    artWidth,
    artHeight,
    copyWidth,
    split,
    colors,
    near,
    selected,
    trailerId,
    hasTrailer,
    backdropUrl,
    feature,
    trailerPlaying,
    muted,
    captions,
    reduceMotion,
    onPlay,
    onToggleMute,
    onCloseTrailer,
    onTrailerStarted,
    onMeasureContent,
}: {
    movie: Movie;
    width: number;
    height: number;
    gutter: number;
    gap: number;
    verticalPadding: number;
    bottomPadding: number;
    artWidth: number;
    artHeight: number;
    copyWidth: number;
    split: boolean;
    colors: Colors;
    near: boolean;
    selected: boolean;
    trailerId: string | null;
    hasTrailer: boolean;
    backdropUrl: string | null;
    feature: boolean;
    trailerPlaying: boolean;
    muted: boolean;
    captions: boolean;
    reduceMotion: boolean;
    onPlay: () => void;
    onToggleMute: () => void;
    onCloseTrailer: () => void;
    onTrailerStarted: () => void;
    onMeasureContent: (movieId: number, measuredWidth: number, measuredHeight: number) => void;
}) {
    const saved = useIsInWatchlist(movie.id);
    const toggleWatchlist = useToggleWatchlist();
    const [focused, setFocused] = useState<string | null>(null);
    const meta = [
        movie.year ? String(movie.year) : null,
        formatRuntime(movie.runtimeMinutes),
        movie.mpaRating || null,
    ].filter(Boolean) as string[];

    const bestArtRef = useRef<string | null>(null);
    if (backdropUrl) bestArtRef.current = backdropUrl;
    else if (!bestArtRef.current) bestArtRef.current = thumbFor(movie) ?? null;
    const heroArt = bestArtRef.current;
    const titleSize = split ? (copyWidth >= 430 ? 54 : 42) : 36;

    const openDetails = (source: string) => {
        Analytics.movieOpen(movie, source);
        router.push(`/movie/${movie.id}`);
    };

    const artwork = (
        <View style={[styles.artwork, {width: artWidth, height: artHeight, backgroundColor: colors.surfaceSunken}]}>
            {heroArt ? (
                <Image
                    source={near ? {uri: heroArt} : undefined}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={reduceMotion ? 0 : 260}
                    priority={near ? 'high' : undefined}
                    cachePolicy="memory-disk"
                />
            ) : near ? (
                <Thumbnail movie={movie} style={StyleSheet.absoluteFill} transition={reduceMotion ? 0 : 260} priority="high"/>
            ) : null}

            {trailerId ? (
                <HeroTrailerLayer
                    videoId={trailerId}
                    width={artWidth}
                    height={artHeight}
                    muted={muted}
                    controls={feature}
                    captions={captions}
                    onStarted={onTrailerStarted}
                />
            ) : null}

            {trailerId && trailerPlaying ? (
                <View style={styles.artControls} pointerEvents="box-none">
                    {feature ? (
                        <HeroIconButton
                            icon="close"
                            label="Close trailer"
                            colors={colors}
                            reduceMotion={reduceMotion}
                            onImage
                            onPress={onCloseTrailer}
                        />
                    ) : <View/>}
                    <HeroIconButton
                        icon={muted ? 'volume-mute' : 'volume-high'}
                        label={muted ? 'Unmute trailer' : 'Mute trailer'}
                        colors={colors}
                        reduceMotion={reduceMotion}
                        onImage
                        onPress={onToggleMute}
                    />
                </View>
            ) : null}
        </View>
    );

    const content = (
        <View style={[styles.content, {width: copyWidth}]}>
            <Pressable
                onPress={() => openDetails('hero_slide')}
                onFocus={() => setFocused('title')}
                onBlur={() => setFocused(null)}
                accessibilityRole="button"
                accessibilityLabel={`View ${movie.title}`}
                tabIndex={selected ? 0 : -1}
                style={[styles.titleHit, {borderColor: focused === 'title' ? colors.accent : 'transparent'}]}
            >
                <ThemedText
                    type="display"
                    style={[styles.title, {color: colors.text, fontSize: titleSize, lineHeight: Math.round(titleSize * 1.14)}]}
                    numberOfLines={split ? 3 : 2}
                >
                    {movie.title}
                </ThemedText>
            </Pressable>

            <View style={styles.metaRow}>
                {movie.rating > 0 ? (
                    <View style={styles.rating}>
                        <Ionicons name="star" size={13} color={colors.accent}/>
                        <ThemedText style={[styles.metaText, {color: colors.text, fontWeight: '600'}]}>
                            {movie.rating.toFixed(1)}
                        </ThemedText>
                    </View>
                ) : null}
                {meta.map((item) => (
                    <ThemedText key={item} style={[styles.metaText, {color: colors.textMuted}]}>{item}</ThemedText>
                ))}
            </View>

            {movie.genres.length > 0 ? (
                <ThemedText style={[styles.genres, {color: colors.accent}]} numberOfLines={1}>
                    {movie.genres.slice(0, 2).join(' / ')}
                </ThemedText>
            ) : null}

            {movie.summary ? (
                <ThemedText style={[styles.summary, {color: colors.textMuted}]} numberOfLines={3}>
                    {movie.summary}
                </ThemedText>
            ) : null}

            <View
                style={styles.ctaRow}
                onLayout={({nativeEvent: {layout}}) => onMeasureContent(movie.id, copyWidth, layout.y + layout.height)}
            >
                {hasTrailer ? (
                    <PressableScale
                        onPress={onPlay}
                        onFocus={() => setFocused('play')}
                        onBlur={() => setFocused(null)}
                        accessibilityRole="button"
                        accessibilityLabel={`Play the ${movie.title} trailer`}
                        tabIndex={selected ? 0 : -1}
                        pressedScale={reduceMotion ? 1 : 0.97}
                        pressedOpacity={0.85}
                        duration={reduceMotion ? 0 : Duration.fast}
                        style={styles.primaryHit}
                        contentStyle={[
                            styles.playButton,
                            {backgroundColor: colors.accentStrong, borderColor: focused === 'play' ? colors.text : colors.accentStrong},
                        ]}
                    >
                        <Ionicons name="play" size={16} color={colors.onAccent}/>
                        <ThemedText style={[styles.buttonLabel, {color: colors.onAccent, fontWeight: '600'}]} numberOfLines={1}>
                            Watch trailer
                        </ThemedText>
                    </PressableScale>
                ) : null}

                <PressableScale
                    onPress={() => {
                        Analytics.heroMoreInfo(movie);
                        openDetails('hero_more_info');
                    }}
                    onFocus={() => setFocused('info')}
                    onBlur={() => setFocused(null)}
                    accessibilityRole="button"
                    accessibilityLabel={`More info about ${movie.title}`}
                    tabIndex={selected ? 0 : -1}
                    pressedScale={reduceMotion ? 1 : 0.97}
                    pressedOpacity={0.7}
                    duration={reduceMotion ? 0 : Duration.fast}
                    contentStyle={[styles.infoButton, {borderColor: focused === 'info' ? colors.accent : 'transparent'}]}
                >
                    <ThemedText style={[styles.buttonLabel, {color: colors.text}]} numberOfLines={1}>More info</ThemedText>
                </PressableScale>

                <HeroIconButton
                    icon={saved ? 'bookmark' : 'bookmark-outline'}
                    label={saved ? `Remove ${movie.title} from Watchlist` : `Add ${movie.title} to Watchlist`}
                    colors={colors}
                    reduceMotion={reduceMotion}
                    selected={saved}
                    tabIndex={selected ? 0 : -1}
                    onPress={() => {
                        const added = toggleWatchlist(movie);
                        if (added) Analytics.watchlistAdd(movie);
                        else Analytics.watchlistRemove(movie);
                    }}
                />
            </View>
        </View>
    );

    return (
        <View
            aria-hidden={!selected}
            accessibilityElementsHidden={!selected}
            importantForAccessibility={selected ? 'auto' : 'no-hide-descendants'}
            style={[
                styles.slide,
                {
                    width,
                    height,
                    gap,
                    paddingHorizontal: gutter,
                    paddingTop: verticalPadding,
                    paddingBottom: bottomPadding,
                    flexDirection: split ? 'row' : 'column',
                    alignItems: split ? 'center' : 'flex-start',
                    justifyContent: split ? 'center' : 'flex-start',
                },
            ]}
        >
            {split ? content : artwork}
            {split ? artwork : content}
        </View>
    );
}

function HeroIconButton({
    icon,
    label,
    colors,
    reduceMotion,
    onPress,
    onImage = false,
    selected = false,
    tabIndex,
}: {
    icon: ComponentProps<typeof Ionicons>['name'];
    label: string;
    colors: Colors;
    reduceMotion: boolean;
    onPress: () => void;
    onImage?: boolean;
    selected?: boolean;
    tabIndex?: 0 | -1;
}) {
    const [focused, setFocused] = useState(false);
    return (
        <PressableScale
            onPress={onPress}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{selected}}
            tabIndex={tabIndex}
            pressedScale={reduceMotion ? 1 : 0.94}
            pressedOpacity={0.7}
            duration={reduceMotion ? 0 : Duration.fast}
            contentStyle={[
                styles.iconButton,
                {
                    backgroundColor: onImage ? colors.scrim : selected ? colors.accentSoft : 'transparent',
                    borderColor: focused ? colors.accent : onImage ? 'rgba(255,255,255,0.5)' : colors.borderStrong,
                },
            ]}
        >
            <Ionicons name={icon} size={19} color={onImage ? '#fff' : selected ? colors.accent : colors.text}/>
        </PressableScale>
    );
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
    slide: {overflow: 'hidden'},
    content: {flexShrink: 0},
    artwork: {flexShrink: 0, overflow: 'hidden', borderRadius: Radius.lg},
    artControls: {position: 'absolute', left: 12, right: 12, top: 12, flexDirection: 'row', justifyContent: 'space-between'},
    titleHit: {borderWidth: 1, marginHorizontal: -1, padding: 0},
    title: {fontFamily: FontFamily.displaySemibold, fontWeight: '500', letterSpacing: -1.1},
    metaRow: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 14, rowGap: 4, marginTop: 16},
    rating: {flexDirection: 'row', alignItems: 'center', gap: 5},
    metaText: {fontSize: 13, lineHeight: 18},
    genres: {fontSize: 13, lineHeight: 18, marginTop: 8},
    summary: {fontSize: 15, lineHeight: 23, marginTop: 18, maxWidth: 520},
    ctaRow: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 24},
    primaryHit: {flexShrink: 0},
    playButton: {minHeight: CONTROL_SIZE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, borderRadius: Radius.md, borderWidth: 2},
    infoButton: {minHeight: CONTROL_SIZE, justifyContent: 'center', paddingHorizontal: 10, borderRadius: Radius.md, borderWidth: 2},
    buttonLabel: {fontSize: 14, lineHeight: 20},
    iconButton: {width: CONTROL_SIZE, height: CONTROL_SIZE, borderRadius: Radius.md, borderWidth: 1, justifyContent: 'center', alignItems: 'center'},
    selector: {height: SELECTOR_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: Spacing.md},
    thumbStrip: {flex: 1},
    thumbRow: {flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 8},
    thumbHit: {minHeight: CONTROL_SIZE, justifyContent: 'center'},
    thumb: {width: THUMB_WIDTH, height: THUMB_HEIGHT, borderRadius: Radius.sm, borderWidth: 2, overflow: 'hidden'},
});
