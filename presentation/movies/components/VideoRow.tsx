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
import {formatRuntime} from './format';
import {Thumbnail} from './Thumbnail';

const IS_WEB = Platform.OS === 'web';
const THUMB_ASPECT = 16 / 9;
const STAR_SIZE = 11;
const GENRE_LIMIT = 3;

export function VideoRow({
                             movie,
                             thumbWidth = 168,
                             source = 'unknown',
                             onPress,
                         }: {
    movie: Movie;
    thumbWidth?: number;
    source?: string;
    onPress?: () => void;
}) {
    const {colors} = usePalette();

    const thumbHeight = Math.round(thumbWidth / THUMB_ASPECT);
    const runtime = formatRuntime(movie.runtimeMinutes);
    const rating = movie.rating > 0 ? movie.rating.toFixed(1) : null;
    const primary = [rating, movie.year ? String(movie.year) : null]
        .filter((part): part is string => !!part)
        .join(' · ');
    const genres = movie.genres.slice(0, GENRE_LIMIT).join(' · ');

    return (
        <Link href={`/movie/${movie.id}`} asChild>
            <PressableScale
                accessibilityRole="link"
                accessibilityLabel={[movie.title, primary].filter(Boolean).join(', ')}
                onPress={() => {
                    Analytics.movieOpen(movie, source);
                    onPress?.();
                }}
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
                    {runtime ? <DurationBadge label={runtime} style={styles.badge}/> : null}
                </View>

                <View style={styles.info}>
                    <ThemedText
                        numberOfLines={2}
                        style={[Typography.videoTitle, styles.title, {color: colors.text}]}
                    >
                        {movie.title}
                    </ThemedText>
                    {primary ? (
                        <View style={styles.metaRow}>
                            {rating ? <Ionicons name="star" size={STAR_SIZE} color={colors.gold}/> : null}
                            <ThemedText
                                numberOfLines={1}
                                style={[Typography.videoMeta, styles.metaText, {color: colors.textMuted}]}
                            >
                                {primary}
                            </ThemedText>
                        </View>
                    ) : null}
                    {genres ? (
                        <ThemedText
                            numberOfLines={1}
                            style={[Typography.videoMeta, {color: colors.textMuted}]}
                        >
                            {genres}
                        </ThemedText>
                    ) : null}
                </View>
            </PressableScale>
        </Link>
    );
}

const styles = StyleSheet.create({
    row: {flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm},
    thumb: {borderRadius: Radius.sm, overflow: 'hidden'},
    badge: {right: Spacing.xs, bottom: Spacing.xs},
    info: {flex: 1},
    title: {fontSize: 14, lineHeight: 19, fontWeight: '600'},
    metaRow: {flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2},
    metaText: {flex: 1},
});
