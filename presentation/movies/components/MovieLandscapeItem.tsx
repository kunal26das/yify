import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {Link} from 'expo-router';
import {useRef} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';
import type {Movie} from '@/domain';
import {Analytics} from '@/presentation/analytics/events';
import {ThemedText} from '../../components/themed-text';
import {Duration, PressableScale, enterFade, enterPop} from '../../components/motion';
import {FontFamily, Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {useHoverCard} from './HoverCard';
import {NewBadge} from './NewBadge';
import {POSTER_GAP} from './moviePosterLayout';

const IS_WEB = Platform.OS === 'web';
const ART_ASPECT = 16 / 9;

export function landscapeWidth(posterWidth: number): number {
    return Math.round(posterWidth * 1.9);
}

export function landscapeArtHeight(posterWidth: number): number {
    return Math.round(landscapeWidth(posterWidth) / ART_ASPECT);
}

export function landscapeCellHeight(posterWidth: number): number {
    return landscapeArtHeight(posterWidth) + CAPTION_HEIGHT;
}

const CAPTION_HEIGHT = 44;

export function MovieLandscapeItem({
                                       movie,
                                       posterWidth,
                                       source = 'unknown',
                                       isNew = false,
                                   }: {
    movie: Movie;
    posterWidth: number;
    source?: string;
    isNew?: boolean;
}) {
    const {colors, scheme} = usePalette();
    const nodeRef = useRef<View>(null);
    const hoverCard = useHoverCard();

    const width = landscapeWidth(posterWidth);
    const artHeight = landscapeArtHeight(posterWidth);

    const art = movie.backgroundImageUrl ?? movie.posterUrls[movie.posterUrls.length - 1];

    const meta = [movie.year ? String(movie.year) : null, formatRuntime(movie.runtimeMinutes)]
        .filter(Boolean)
        .join(' • ');

    return (
        <View ref={nodeRef} style={[styles.cell, {width, marginHorizontal: POSTER_GAP / 2}]} collapsable={false}>
            <Link href={`/movie/${movie.id}`} asChild>
                <PressableScale
                    accessibilityRole="link"
                    accessibilityLabel={[movie.title, meta].filter(Boolean).join(', ')}
                    onPress={() => Analytics.movieOpen(movie, source)}
                    pressedScale={0.97}
                    hoveredScale={IS_WEB ? 1.03 : 1}
                    lift={IS_WEB ? 4 : 0}
                    duration={Duration.fast}
                    onHoverIn={() => {
                        if (!IS_WEB) return;
                        if (hoverCard.enabled) hoverCard.open(movie, nodeRef.current, source);
                    }}
                    onHoverOut={() => {
                        if (!IS_WEB) return;
                        if (hoverCard.enabled) hoverCard.close();
                    }}
                >
                    <Animated.View
                        entering={enterFade()}
                        style={[
                            styles.art,
                            {
                                height: artHeight,
                                backgroundColor: colors.surfaceSunken,
                                borderColor: colors.border,
                                shadowColor: scheme === 'dark' ? '#000' : '#2A2019',
                            },
                        ]}
                    >
                        {art ? (
                            <Image
                                source={{uri: art}}
                                style={StyleSheet.absoluteFill}
                                contentFit="cover"
                                transition={180}
                                cachePolicy="memory-disk"
                                recyclingKey={String(movie.id)}
                            />
                        ) : null}

                        <View style={styles.playGlyph}>
                            <Ionicons name="play" size={13} color="#fff"/>
                        </View>

                        {movie.rating > 0 ? (
                            <Animated.View entering={enterPop(1)} style={styles.ratingBadge}>
                                <Ionicons name="star" size={10} color={colors.gold}/>
                                <ThemedText style={styles.ratingText} lightColor="#fff" darkColor="#fff">
                                    {movie.rating.toFixed(1)}
                                </ThemedText>
                            </Animated.View>
                        ) : null}

                        {isNew ? <NewBadge style={styles.newBadge}/> : null}
                    </Animated.View>
                </PressableScale>
            </Link>

            <ThemedText style={[styles.title, {color: colors.text}]} numberOfLines={1}>
                {movie.title}
            </ThemedText>
            {meta ? (
                <ThemedText style={[styles.meta, {color: colors.textMuted}]} numberOfLines={1}>
                    {meta}
                </ThemedText>
            ) : null}
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
    cell: {},
    art: {
        borderRadius: Radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.16,
        shadowRadius: 10,
        elevation: 3,
    },
    playGlyph: {
        position: 'absolute',
        left: Spacing.sm,
        bottom: Spacing.sm,
        width: 26,
        height: 26,
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(8,8,12,0.55)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    ratingBadge: {
        position: 'absolute',
        top: Spacing.sm,
        left: Spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: Radius.pill,
        backgroundColor: 'rgba(8,8,12,0.66)',
    },
    ratingText: {fontSize: 10.5, fontFamily: FontFamily.extrabold},
    newBadge: {position: 'absolute', top: Spacing.sm, right: Spacing.sm},

    title: {fontSize: 14, lineHeight: 19, marginTop: 8, fontFamily: FontFamily.semibold},
    meta: {fontSize: 12, lineHeight: 16, marginTop: 1, fontFamily: FontFamily.regular},
});
