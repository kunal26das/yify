import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {router} from 'expo-router';
import {useCallback, useEffect, useRef, useState} from 'react';
import {
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import type {Movie} from '@/domain';
import {FontFamily, Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {LinearGradient} from '../../components/linear-gradient';
import {ThemedText} from '../../components/themed-text';

const ROTATE_MS = 6500;

type Colors = ReturnType<typeof usePalette>['colors'];

interface HeroBillboardProps {
    movies: Movie[];
    width: number;
    height: number;
    rounded?: boolean;
}

export function HeroBillboard({movies, width, height, rounded}: HeroBillboardProps) {
    const {colors} = usePalette();
    const [index, setIndex] = useState(0);
    const indexRef = useRef(0);
    const scrollRef = useRef<ScrollView>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scheduleNextRef = useRef<() => void>(() => {});
    const count = movies.length;

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const scheduleNext = useCallback(() => {
        clearTimer();
        if (count <= 1 || width <= 0) return;
        timerRef.current = setTimeout(() => {
            const next = (indexRef.current + 1) % count;
            // Slide forward; wrap back to the first slide instantly to avoid a long rewind sweep.
            scrollRef.current?.scrollTo({x: next * width, animated: next !== 0});
            // Continue the loop directly — onScroll continuation isn't guaranteed on every platform.
            scheduleNextRef.current();
        }, ROTATE_MS);
    }, [clearTimer, count, width]);

    useEffect(() => {
        scheduleNextRef.current = scheduleNext;
    }, [scheduleNext]);

    const setActive = useCallback(
        (next: number) => {
            if (next === indexRef.current || next < 0 || next >= count) return;
            indexRef.current = next;
            setIndex(next);
        },
        [count]
    );

    // Start the auto-advance loop; any scroll activity defers it via onScroll (below).
    useEffect(() => {
        scheduleNext();
        return clearTimer;
    }, [scheduleNext, clearTimer]);

    // Keep the active slide aligned when the viewport width changes (e.g. rotation).
    useEffect(() => {
        if (width > 0) scrollRef.current?.scrollTo({x: indexRef.current * width, animated: false});
    }, [width]);

    const onScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (width <= 0) return;
            setActive(Math.round(e.nativeEvent.contentOffset.x / width));
            // onScroll fires on every platform (native drag/momentum + web wheel/touch/programmatic),
            // so it — not the web-dead drag/momentum callbacks — is what defers auto-advance.
            scheduleNext();
        },
        [setActive, scheduleNext, width]
    );

    const goTo = useCallback(
        (i: number) => {
            scrollRef.current?.scrollTo({x: i * width, animated: true});
            setActive(i);
        },
        [setActive, width]
    );

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
                decelerationRate="fast"
            >
                {movies.map((movie) => (
                    <HeroSlide key={movie.id} movie={movie} width={width} height={height} colors={colors}/>
                ))}
            </ScrollView>

            {count > 1 ? (
                <View style={styles.dots} pointerEvents="box-none">
                    {movies.map((m, i) => (
                        <Pressable
                            key={m.id}
                            hitSlop={6}
                            onPress={() => goTo(i)}
                            accessibilityRole="button"
                            accessibilityLabel={`Featured ${i + 1}`}
                        >
                            <View style={[styles.dot, i === index ? styles.dotActive : styles.dotInactive]}/>
                        </Pressable>
                    ))}
                </View>
            ) : null}
        </View>
    );
}

function HeroSlide({
                       movie,
                       width,
                       height,
                       colors,
                   }: {
    movie: Movie;
    width: number;
    height: number;
    colors: Colors;
}) {
    const backdrop = movie.backgroundImageUrl ?? movie.posterUrls[movie.posterUrls.length - 1];
    const meta = [
        movie.year ? String(movie.year) : null,
        formatRuntime(movie.runtimeMinutes),
        movie.mpaRating || null,
    ].filter(Boolean) as string[];

    return (
        <View style={[styles.slide, {width, height}]}>
            {backdrop ? (
                <Image
                    source={{uri: backdrop}}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={260}
                    cachePolicy="memory-disk"
                />
            ) : null}
            <LinearGradient
                colors={['rgba(6,6,8,0)', 'rgba(6,6,8,0.35)', 'rgba(6,6,8,0.88)']}
                bands={16}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
            />
            <LinearGradient
                colors={['rgba(6,6,8,0)', colors.background]}
                bands={12}
                style={styles.meltFade}
                pointerEvents="none"
            />

            <View style={styles.content}>
                <Pressable
                    onPress={() => router.push(`/movie/${movie.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${movie.title}`}
                >
                    <View style={styles.badgeRow}>
                        <View style={styles.brandBadge}>
                            <Ionicons name="film" size={12} color="#fff"/>
                            <ThemedText style={styles.brandBadgeText}>FEATURED</ThemedText>
                        </View>
                        {movie.rating > 0 ? (
                            <View style={styles.ratingPill}>
                                <Ionicons name="star" size={12} color={colors.gold}/>
                                <ThemedText style={styles.ratingText}>{movie.rating.toFixed(1)}</ThemedText>
                            </View>
                        ) : null}
                    </View>

                    <ThemedText type="display" style={styles.title} numberOfLines={2}>
                        {movie.title}
                    </ThemedText>

                    <View style={styles.metaRow}>
                        {meta.map((m, i) => (
                            <View key={m} style={styles.metaItem}>
                                {i > 0 ? <View style={styles.metaDot}/> : null}
                                <ThemedText style={styles.metaText}>{m}</ThemedText>
                            </View>
                        ))}
                        {movie.genres.slice(0, 2).map((g) => (
                            <View key={g} style={styles.metaItem}>
                                <View style={styles.metaDot}/>
                                <ThemedText style={styles.metaText}>{g}</ThemedText>
                            </View>
                        ))}
                    </View>

                    {movie.summary ? (
                        <ThemedText style={styles.summary} numberOfLines={2}>
                            {movie.summary}
                        </ThemedText>
                    ) : null}
                </Pressable>

                <View style={styles.ctaRow}>
                    <Pressable
                        onPress={() => router.push(`/movie/${movie.id}`)}
                        accessibilityRole="button"
                        accessibilityLabel={`View ${movie.title}`}
                    >
                        <View style={[styles.viewButton, {backgroundColor: colors.accent}]}>
                            <Ionicons name="play" size={17} color={colors.onAccent}/>
                            <ThemedText style={[styles.viewLabel, {color: colors.onAccent}]}>View</ThemedText>
                        </View>
                    </Pressable>
                </View>
            </View>
        </View>
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
    slide: {justifyContent: 'flex-end', overflow: 'hidden'},
    meltFade: {position: 'absolute', left: 0, right: 0, bottom: 0, height: 96},

    content: {paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl},
    badgeRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10},
    brandBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: Radius.sm,
        backgroundColor: 'rgba(255,255,255,0.16)',
    },
    brandBadgeText: {color: '#fff', fontSize: 10, letterSpacing: 1.2, fontFamily: FontFamily.bold},
    ratingPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: Radius.pill,
        backgroundColor: 'rgba(6,6,8,0.5)',
    },
    ratingText: {color: '#fff', fontSize: 12, fontFamily: FontFamily.extrabold},

    title: {color: '#fff', fontSize: 34, lineHeight: 38},
    metaRow: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 8},
    metaItem: {flexDirection: 'row', alignItems: 'center'},
    metaDot: {width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.6)', marginHorizontal: 8},
    metaText: {color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: FontFamily.semibold},
    summary: {color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20, marginTop: 10, maxWidth: 560},

    ctaRow: {flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 18},
    viewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 24,
        paddingVertical: 11,
        borderRadius: Radius.pill,
    },
    viewLabel: {fontSize: 16, fontFamily: FontFamily.bold},

    dots: {
        position: 'absolute',
        bottom: Spacing.xl + 12,
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
