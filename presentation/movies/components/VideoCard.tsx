import {Ionicons} from '@expo/vector-icons';
import {Link} from 'expo-router';
import {useState} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';

import type {Movie} from '@/domain';
import {Analytics} from '@/presentation/analytics/events';
import {Duration, PressableScale} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {Radius, Spacing, Typography} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {DurationBadge} from './DurationBadge';
import {formatRuntime, metaParts} from './format';
import {Thumbnail} from './Thumbnail';

const IS_WEB = Platform.OS === 'web';
const THUMB_ASPECT = 16 / 9;
const STAR_SIZE = 11;

export function VideoCard({
                              movie,
                              width,
                              source = 'unknown',
                              onPress,
                          }: {
    movie: Movie;
    width: number;
    source?: string;
    onPress?: () => void;
}) {
    const {colors} = usePalette();
    const [hovered, setHovered] = useState(false);

    const thumbHeight = Math.round(width / THUMB_ASPECT);
    const runtime = formatRuntime(movie.runtimeMinutes);
    const rating = movie.rating > 0 ? movie.rating.toFixed(1) : null;
    const meta = [rating, ...metaParts(movie), movie.genres[0]]
        .filter((part): part is string => !!part)
        .join(' · ');

    return (
        <Link href={`/movie/${movie.id}`} asChild>
            <PressableScale
                accessibilityRole="link"
                accessibilityLabel={[movie.title, meta].filter(Boolean).join(', ')}
                onPress={() => {
                    Analytics.movieOpen(movie, source);
                    onPress?.();
                }}
                pressedScale={IS_WEB ? 1 : 0.97}
                hoveredScale={1}
                pressedOpacity={0.9}
                duration={Duration.fast}
                onHoverIn={() => {
                    if (IS_WEB) setHovered(true);
                }}
                onHoverOut={() => {
                    if (IS_WEB) setHovered(false);
                }}
                style={{width}}
            >
                <Animated.View
                    style={[
                        styles.thumb,
                        {height: thumbHeight, backgroundColor: colors.surfaceSunken},
                        IS_WEB
                            ? {
                                borderRadius: hovered ? 0 : Radius.card,
                                transitionProperty: 'borderRadius',
                                transitionDuration: Duration.fast,
                                transitionTimingFunction: 'ease-out',
                            }
                            : styles.thumbRadius,
                    ]}
                >
                    <Thumbnail movie={movie} style={StyleSheet.absoluteFill}/>
                    {runtime ? <DurationBadge label={runtime}/> : null}
                </Animated.View>

                <View style={styles.info}>
                    <ThemedText
                        numberOfLines={2}
                        style={[Typography.videoTitle, styles.titleWeight, {color: colors.text}]}
                    >
                        {movie.title}
                    </ThemedText>
                    {meta ? (
                        <View style={styles.metaRow}>
                            {rating ? <Ionicons name="star" size={STAR_SIZE} color={colors.gold}/> : null}
                            <ThemedText
                                numberOfLines={1}
                                style={[Typography.videoMeta, styles.metaText, {color: colors.textMuted}]}
                            >
                                {meta}
                            </ThemedText>
                        </View>
                    ) : null}
                </View>
            </PressableScale>
        </Link>
    );
}

const styles = StyleSheet.create({
    thumb: {width: '100%', overflow: 'hidden'},
    thumbRadius: {borderRadius: Radius.card},
    info: {paddingTop: Spacing.md},
    titleWeight: {fontWeight: '600'},
    metaRow: {flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 3},
    metaText: {flex: 1},
});
