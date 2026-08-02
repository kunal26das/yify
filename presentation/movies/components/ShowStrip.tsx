import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import type {Show} from '@/domain';
import {Analytics} from '@/lib/analytics-events';
import {PressableScale} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {Radius, Spacing, Typography} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {useGoTo} from '../constants/destinations';

const STRIP_LIMIT = 12;
const THUMB_ASPECT = 16 / 9;

export function ShowStrip({
                              shows,
                              gutter,
                              posterWidth,
                          }: {
    shows: Show[];
    gutter: number;
    posterWidth: number;
}) {
    const {colors} = usePalette();
    const goTo = useGoTo();
    const cardWidth = Math.round(posterWidth * 1.7);

    if (shows.length === 0) return null;

    return (
        <View style={styles.strip}>
            <View style={[styles.header, {paddingHorizontal: gutter}]}>
                <ThemedText type="heading">Just Added Episodes</ThemedText>
                <PressableScale
                    onPress={() => goTo('/shows')}
                    accessibilityRole="link"
                    hitSlop={8}
                    pressedScale={0.93}
                    pressedOpacity={0.6}
                    contentStyle={styles.seeAll}
                >
                    <ThemedText style={[styles.seeAllLabel, {color: colors.accent}]}>View All</ThemedText>
                    <Ionicons name="chevron-forward" size={15} color={colors.accent}/>
                </PressableScale>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.row, {paddingHorizontal: gutter}]}
            >
                {shows.slice(0, STRIP_LIMIT).map((show) => (
                    <ShowStripCard key={show.imdbId} show={show} width={cardWidth}/>
                ))}
            </ScrollView>
        </View>
    );
}

function ShowStripCard({show, width}: {show: Show; width: number}) {
    const {colors} = usePalette();
    const goTo = useGoTo();
    const [failed, setFailed] = useState(false);
    const height = Math.round(width / THUMB_ASPECT);

    const {season, episode} = show.latestEpisode;
    const code =
        season || episode
            ? `Latest S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
            : 'New releases';

    return (
        <PressableScale
            onPress={() => {
                Analytics.movieOpen({id: show.latestEpisode.id, title: show.title}, 'home_shows');
                goTo(`/show/${show.imdbId}`);
            }}
            accessibilityRole="link"
            accessibilityLabel={`${show.title}, ${code}`}
            pressedScale={0.97}
            pressedOpacity={0.85}
            style={{width}}
        >
            <View style={[styles.thumb, {height, backgroundColor: colors.surfaceSunken}]}>
                {show.thumbnailUrl && !failed ? (
                    <Image
                        source={{uri: show.thumbnailUrl}}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={180}
                        cachePolicy="memory-disk"
                        onError={() => setFailed(true)}
                    />
                ) : (
                    <View style={styles.fallback}>
                        <Ionicons name="tv-outline" size={24} color={colors.textFaint}/>
                    </View>
                )}
            </View>
            <ThemedText numberOfLines={2} style={[Typography.videoTitle, styles.title, {color: colors.text}]}>
                {show.title}
            </ThemedText>
            <ThemedText numberOfLines={1} style={[Typography.videoMeta, {color: colors.textMuted}]}>
                {code}
            </ThemedText>
        </PressableScale>
    );
}

const styles = StyleSheet.create({
    strip: {marginBottom: Spacing.xl},
    header: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    seeAll: {flexDirection: 'row', alignItems: 'center', gap: 1, paddingVertical: 2},
    seeAllLabel: {fontSize: 14, fontWeight: '700'},
    row: {flexDirection: 'row', gap: Spacing.md},
    thumb: {width: '100%', borderRadius: Radius.card, overflow: 'hidden'},
    fallback: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {marginTop: Spacing.sm, fontWeight: '600'},
});
