import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {router} from 'expo-router';
import {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, Pressable, StyleSheet, View} from 'react-native';
import type {Movie} from '@/domain';
import {FontFamily, Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {LinearGradient} from '../../components/linear-gradient';
import {ThemedText} from '../../components/themed-text';

const ROTATE_MS = 6500;
const FADE_OUT_MS = 320;
const FADE_IN_MS = 460;

interface HeroBillboardProps {
    movies: Movie[];
    width: number;
    height: number;
    rounded?: boolean;
}

export function HeroBillboard({movies, width, height, rounded}: HeroBillboardProps) {
    const {colors} = usePalette();
    const [index, setIndex] = useState(0);
    const [opacity] = useState(() => new Animated.Value(1));
    const indexRef = useRef(0);
    const count = movies.length;

    const swapTo = useCallback(
        (next: number) => {
            indexRef.current = next;
            Animated.timing(opacity, {toValue: 0, duration: FADE_OUT_MS, useNativeDriver: true}).start(
                ({finished}) => {
                    if (!finished) return;
                    setIndex(next);
                    Animated.timing(opacity, {
                        toValue: 1,
                        duration: FADE_IN_MS,
                        useNativeDriver: true,
                    }).start();
                }
            );
        },
        [opacity]
    );

    useEffect(() => {
        if (count <= 1) return;
        const timer = setInterval(() => {
            swapTo((indexRef.current + 1) % count);
        }, ROTATE_MS);
        return () => clearInterval(timer);
    }, [count, swapTo]);

    if (count === 0) return null;

    const movie = movies[Math.min(index, count - 1)];
    const backdrop = movie.backgroundImageUrl ?? movie.posterUrls[movie.posterUrls.length - 1];
    const meta = [
        movie.year ? String(movie.year) : null,
        formatRuntime(movie.runtimeMinutes),
        movie.mpaRating || null,
    ].filter(Boolean) as string[];

    return (
        <View
            style={[
                styles.container,
                {width, height, backgroundColor: colors.surfaceSunken},
                rounded && styles.rounded,
            ]}
        >
            <Animated.View style={[StyleSheet.absoluteFill, {opacity}]}>
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
            </Animated.View>

            <Animated.View style={[styles.content, {opacity}]}>
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

                    {count > 1 ? (
                        <View style={styles.dots}>
                            {movies.map((m, i) => (
                                <Pressable
                                    key={m.id}
                                    hitSlop={6}
                                    onPress={() => i !== index && swapTo(i)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Featured ${i + 1}`}
                                >
                                    <View
                                        style={[
                                            styles.dot,
                                            i === index
                                                ? {backgroundColor: '#fff', width: 22}
                                                : {backgroundColor: 'rgba(255,255,255,0.45)'},
                                        ]}
                                    />
                                </Pressable>
                            ))}
                        </View>
                    ) : null}
                </View>
            </Animated.View>
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
    container: {overflow: 'hidden', justifyContent: 'flex-end'},
    rounded: {borderRadius: Radius.xl},
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
    dots: {flexDirection: 'row', alignItems: 'center', gap: 6},
    dot: {width: 7, height: 7, borderRadius: 4},
});
