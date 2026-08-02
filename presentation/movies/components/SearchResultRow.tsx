import {Ionicons} from '@expo/vector-icons';
import {Link} from 'expo-router';
import {Platform, StyleSheet, View} from 'react-native';

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
const GENRE_LIMIT = 3;

export function SearchResultRow({
                                    movie,
                                    thumbWidth,
                                    source = 'search',
                                }: {
    movie: Movie;
    thumbWidth: number;
    source?: string;
}) {
    const {colors} = usePalette();

    const thumbHeight = Math.round(thumbWidth / THUMB_ASPECT);
    const runtime = formatRuntime(movie.runtimeMinutes);
    const rating = movie.rating > 0 ? movie.rating.toFixed(1) : null;
    const meta = [rating, ...metaParts(movie), ...movie.genres.slice(0, GENRE_LIMIT)]
        .filter((part): part is string => !!part)
        .join(' · ');

    return (
        <Link href={`/movie/${movie.id}`} asChild>
            <PressableScale
                accessibilityRole="link"
                accessibilityLabel={[movie.title, meta].filter(Boolean).join(', ')}
                onPress={() => Analytics.movieOpen(movie, source)}
                pressedScale={IS_WEB ? 1 : 0.98}
                hoveredScale={1}
                pressedOpacity={0.9}
                duration={Duration.fast}
                contentStyle={styles.row}
            >
                <View
                    style={[
                        styles.thumb,
                        {width: thumbWidth, height: thumbHeight, backgroundColor: colors.surfaceSunken},
                    ]}
                >
                    <Thumbnail movie={movie} style={StyleSheet.absoluteFill}/>
                    {runtime ? <DurationBadge label={runtime}/> : null}
                </View>

                <View style={styles.info}>
                    <ThemedText numberOfLines={2} style={[styles.title, {color: colors.text}]}>
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
                    {movie.summary ? (
                        <ThemedText
                            numberOfLines={2}
                            style={[Typography.videoMeta, styles.summary, {color: colors.textMuted}]}
                        >
                            {movie.summary}
                        </ThemedText>
                    ) : null}
                </View>
            </PressableScale>
        </Link>
    );
}

const styles = StyleSheet.create({
    row: {flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.lg},
    thumb: {borderRadius: Radius.card, overflow: 'hidden'},
    info: {flex: 1},
    title: {fontSize: 18, lineHeight: 24, fontWeight: '600'},
    metaRow: {flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 3},
    metaText: {flex: 1},
    summary: {marginTop: Spacing.sm},
});
