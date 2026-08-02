import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, ScrollView, StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Show, ShowEpisode, ShowRepository, TitleArtwork, TmdbRepository} from '@/domain';
import {PressableScale, enterFade, enterRise} from '../components/motion';
import {ThemedText} from '../components/themed-text';
import {ThemedView} from '../components/themed-view';
import {FontFamily, Radius, Spacing, Typography} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';
import {useResponsive} from '../hooks/use-responsive';
import {TopBar, useTopBarHeight} from './components/TopBar';

const POSTER_WIDTH = 132;

function formatSize(bytes: number): string {
    if (!bytes) return '';
    const gb = bytes / 1_000_000_000;
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    return `${Math.round(bytes / 1_000_000)} MB`;
}

function episodeCode(episode: ShowEpisode): string {
    if (!episode.season && !episode.episode) return 'Release';
    return `S${String(episode.season).padStart(2, '0')}E${String(episode.episode).padStart(2, '0')}`;
}

export function ShowDetailsScreen({
                                      imdbId,
                                      shows,
                                      artwork,
                                  }: {
    imdbId: string;
    shows: ShowRepository;
    artwork: TmdbRepository;
}) {
    const {colors} = usePalette();
    const insets = useSafeAreaInsets();
    const {gutter, contentMaxWidth} = useResponsive();
    const topBarHeight = useTopBarHeight();

    const [show, setShow] = useState<Show | null>(null);
    const [episodes, setEpisodes] = useState<ShowEpisode[]>([]);
    const [meta, setMeta] = useState<TitleArtwork | null>(null);
    const [loading, setLoading] = useState(true);

    const imdbCode = useMemo(() => {
        const digits = imdbId.replace(/\D/g, '');
        return digits ? `tt${digits.padStart(7, '0')}` : '';
    }, [imdbId]);

    useEffect(() => {
        let active = true;
        setLoading(true);

        void (async () => {
            try {
                const [result, list] = await Promise.all([
                    shows.listShows({page: 1, imdbId}),
                    shows.listEpisodes(imdbId),
                ]);
                if (!active) return;
                setShow(result.shows[0] ?? null);
                setEpisodes(list);
            } catch {
                if (active) setShow(null);
            } finally {
                if (active) setLoading(false);
            }
        })();

        void (async () => {
            const found = await artwork.findByImdbCode(imdbCode);
            if (active) setMeta(found);
        })();

        return () => {
            active = false;
        };
    }, [artwork, imdbCode, imdbId, shows]);

    const title = meta?.title || show?.title || 'Series';

    return (
        <ThemedView style={styles.container}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    paddingTop: topBarHeight + Spacing.lg,
                    paddingBottom: insets.bottom + Spacing.xxl,
                    paddingHorizontal: gutter,
                    maxWidth: contentMaxWidth,
                    alignSelf: 'center',
                    width: '100%',
                }}
            >
                <Animated.View entering={enterRise()} style={styles.header}>
                    <View style={[styles.poster, {backgroundColor: colors.surfaceSunken}]}>
                        {meta?.posterUrl ? (
                            <Image
                                source={{uri: meta.posterUrl}}
                                style={StyleSheet.absoluteFill}
                                contentFit="cover"
                                transition={200}
                                cachePolicy="memory-disk"
                            />
                        ) : (
                            <View style={styles.posterFallback}>
                                <Ionicons name="tv-outline" size={30} color={colors.textFaint}/>
                            </View>
                        )}
                    </View>
                    <View style={styles.headerText}>
                        <ThemedText style={[Typography.watchTitle, {color: colors.text}]} numberOfLines={3}>
                            {title}
                        </ThemedText>
                        <ThemedText style={[Typography.videoMeta, {color: colors.textMuted}]}>
                            {episodes.length} {episodes.length === 1 ? 'release' : 'releases'}
                            {meta?.rating ? ` · ${meta.rating.toFixed(1)}★` : ''}
                        </ThemedText>
                    </View>
                </Animated.View>

                {meta?.overview ? (
                    <Animated.View entering={enterFade()} style={styles.overviewBox}>
                        <ThemedText style={[styles.overview, {color: colors.textMuted}]}>
                            {meta.overview}
                        </ThemedText>
                    </Animated.View>
                ) : null}

                <ThemedText type="section" style={[styles.sectionHeading, {color: colors.text}]}>
                    Episodes
                </ThemedText>

                {loading ? (
                    <ActivityIndicator color={colors.accent} style={styles.loader}/>
                ) : episodes.length === 0 ? (
                    <ThemedText style={[Typography.videoMeta, {color: colors.textMuted}]}>
                        No releases found for this series.
                    </ThemedText>
                ) : (
                    episodes.map((episode) => (
                        <View
                            key={episode.id}
                            style={[styles.episode, {borderBottomColor: colors.border}]}
                        >
                            <View style={[styles.codePill, {backgroundColor: colors.accentSoft}]}>
                                <ThemedText style={[styles.code, {color: colors.accent}]}>
                                    {episodeCode(episode)}
                                </ThemedText>
                            </View>
                            <View style={styles.episodeText}>
                                <ThemedText numberOfLines={2} style={[styles.episodeTitle, {color: colors.text}]}>
                                    {episode.title}
                                </ThemedText>
                                <View style={styles.episodeMeta}>
                                    <ThemedText style={[Typography.videoMeta, {color: colors.textMuted}]}>
                                        {formatSize(episode.sizeBytes)}
                                    </ThemedText>
                                    <View style={styles.seedPeer}>
                                        <Ionicons name="arrow-up" size={11} color={colors.seed}/>
                                        <ThemedText style={[Typography.videoMeta, {color: colors.seed}]}>
                                            {episode.seeds}
                                        </ThemedText>
                                    </View>
                                    <View style={styles.seedPeer}>
                                        <Ionicons name="arrow-down" size={11} color={colors.peer}/>
                                        <ThemedText style={[Typography.videoMeta, {color: colors.peer}]}>
                                            {episode.peers}
                                        </ThemedText>
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
            <TopBar active="shows"/>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1},
    header: {flexDirection: 'row', gap: Spacing.lg, alignItems: 'flex-start'},
    poster: {
        width: POSTER_WIDTH,
        height: Math.round(POSTER_WIDTH * 1.5),
        borderRadius: Radius.card,
        overflow: 'hidden',
    },
    posterFallback: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {flex: 1, gap: Spacing.xs, paddingTop: Spacing.xs},
    overviewBox: {marginTop: Spacing.lg},
    overview: {fontSize: 14, lineHeight: 21},
    sectionHeading: {marginTop: Spacing.xl, marginBottom: Spacing.sm},
    loader: {marginTop: Spacing.lg},
    episode: {
        flexDirection: 'row',
        gap: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
    },
    codePill: {borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 5},
    code: {fontSize: 12, fontFamily: FontFamily.bold},
    episodeText: {flex: 1, gap: 3},
    episodeTitle: {fontSize: 14, fontWeight: '600'},
    episodeMeta: {flexDirection: 'row', alignItems: 'center', gap: Spacing.md},
    seedPeer: {flexDirection: 'row', alignItems: 'center', gap: 2},
});
