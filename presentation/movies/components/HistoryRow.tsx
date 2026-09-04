import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {Link} from 'expo-router';
import {Platform, StyleSheet, View} from 'react-native';

import {type HistoryEntry, historyHref, historyKind} from '@/domain';
import {Analytics} from '@/presentation/analytics/events';
import {Duration, PressableScale} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {Radius, Spacing, Typography} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {DurationBadge} from './DurationBadge';
import {formatRuntime} from './format';

const IS_WEB = Platform.OS === 'web';
const THUMB_ASPECT = 16 / 9;
const STAR_SIZE = 11;

export function HistoryRow({
                               entry,
                               thumbWidth,
                               onRemove,
                           }: {
    entry: HistoryEntry;
    thumbWidth: number;
    onRemove: (entry: HistoryEntry) => void;
}) {
    const {colors} = usePalette();

    const thumbHeight = Math.round(thumbWidth / THUMB_ASPECT);
    const runtime = entry.runtimeMinutes ? formatRuntime(entry.runtimeMinutes) : null;
    const rating = entry.rating && entry.rating > 0 ? entry.rating.toFixed(1) : null;
    const kind = historyKind(entry.key) === 'show' ? 'Show' : null;
    const meta = [rating, entry.year ? String(entry.year) : null, kind]
        .filter((part): part is string => !!part)
        .join(' · ');

    return (
        <View style={styles.row}>
            <Link href={historyHref(entry.key) as never} asChild>
                <PressableScale
                    accessibilityRole="link"
                    accessibilityLabel={[entry.title, meta].filter(Boolean).join(', ')}
                    onPress={() => Analytics.historyOpen(entry.key, entry.title)}
                    pressedScale={IS_WEB ? 1 : 0.98}
                    hoveredScale={1}
                    pressedOpacity={0.9}
                    duration={Duration.fast}
                    style={styles.link}
                    contentStyle={styles.linkContent}
                >
                    <View
                        style={[
                            styles.thumb,
                            {
                                width: thumbWidth,
                                height: thumbHeight,
                                backgroundColor: colors.surfaceSunken,
                            },
                        ]}
                    >
                        {entry.imageUrl ? (
                            <Image
                                source={{uri: entry.imageUrl}}
                                style={StyleSheet.absoluteFill}
                                contentFit="cover"
                                transition={180}
                                cachePolicy="memory-disk"
                                recyclingKey={entry.key}
                            />
                        ) : (
                            <View style={styles.thumbFallback}>
                                <Ionicons name="film-outline" size={20} color={colors.textFaint}/>
                            </View>
                        )}
                        {runtime ? <DurationBadge label={runtime} style={styles.badge}/> : null}
                    </View>

                    <View style={styles.info}>
                        <ThemedText
                            numberOfLines={2}
                            style={[Typography.videoTitle, styles.title, {color: colors.text}]}
                        >
                            {entry.title}
                        </ThemedText>
                        {meta ? (
                            <View style={styles.metaRow}>
                                {rating ? (
                                    <Ionicons name="star" size={STAR_SIZE} color={colors.gold}/>
                                ) : null}
                                <ThemedText
                                    numberOfLines={1}
                                    style={[
                                        Typography.videoMeta,
                                        styles.metaText,
                                        {color: colors.textMuted},
                                    ]}
                                >
                                    {meta}
                                </ThemedText>
                            </View>
                        ) : null}
                    </View>
                </PressableScale>
            </Link>

            <PressableScale
                onPress={() => onRemove(entry)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${entry.title} from history`}
                hitSlop={8}
                pressedScale={0.86}
                pressedOpacity={0.6}
                hoveredScale={1.08}
                contentStyle={styles.removeButton}
            >
                <Ionicons name="close" size={18} color={colors.textMuted}/>
            </PressableScale>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs},
    link: {flex: 1},
    linkContent: {flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm},
    thumb: {borderRadius: Radius.sm, overflow: 'hidden'},
    thumbFallback: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {right: Spacing.xs, bottom: Spacing.xs},
    info: {flex: 1},
    title: {fontSize: 14, lineHeight: 19, fontWeight: '600'},
    metaRow: {flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2},
    metaText: {flex: 1},
    removeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
