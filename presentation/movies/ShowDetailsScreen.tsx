import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, ScrollView, StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Show, ShowEpisode, ShowRepository, TitleArtwork, Torrent, TmdbRepository} from '@/domain';
import {PressableScale, enterFade, enterRise} from '../components/motion';
import {LinearGradient} from '../components/linear-gradient';
import {Screen} from '../components/screen';
import {ThemedText} from '../components/themed-text';
import {FontFamily, Radius, Spacing, Typography} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';
import {useResponsive} from '../hooks/use-responsive';
import {TorrentNoticeSheet} from './components/TorrentNoticeSheet';

const POSTER_WIDTH = 128;
const POSTER_OVERLAP = 56;
const BACKDROP_ASPECT = 16 / 9;

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
    const {width, gutter, contentMaxWidth} = useResponsive();

    const [show, setShow] = useState<Show | null>(null);
    const [episodes, setEpisodes] = useState<ShowEpisode[]>([]);
    const [meta, setMeta] = useState<TitleArtwork | null>(null);
    const [loading, setLoading] = useState(true);
    const [openSeasons, setOpenSeasons] = useState<Record<number, boolean>>({});
    const [notice, setNotice] = useState<Torrent | null>(null);

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

    const seasons = useMemo(() => {
        const grouped = new Map<number, ShowEpisode[]>();
        for (const episode of episodes) {
            const list = grouped.get(episode.season) ?? [];
            list.push(episode);
            grouped.set(episode.season, list);
        }
        return [...grouped.entries()]
            .map(([season, list]) => ({
                season,
                episodes: list.sort((a, b) => b.episode - a.episode),
            }))
            .sort((a, b) => b.season - a.season);
    }, [episodes]);

    useEffect(() => {
        if (seasons.length === 0) return;
        setOpenSeasons((prev) => (Object.keys(prev).length > 0 ? prev : {[seasons[0].season]: true}));
    }, [seasons]);

    const toEpisodeTorrent = (episode: ShowEpisode): Torrent => ({
        url: episode.magnetUrl,
        hash: '',
        quality: episodeCode(episode),
        type: 'episode',
        videoCodec: '',
        bitDepth: '',
        audioChannels: '',
        seeds: episode.seeds,
        peers: episode.peers,
        size: formatSize(episode.sizeBytes),
        sizeBytes: episode.sizeBytes,
        uploadedAt: episode.releasedAt,
    });

    const title = meta?.title || show?.title || 'Series';
    const backdropUrl = meta?.backdropUrl || meta?.posterUrl || show?.thumbnailUrl;
    const backdropHeight = Math.round(Math.min(width, contentMaxWidth) / BACKDROP_ASPECT);
    const seasonCount = seasons.filter((group) => group.season > 0).length;
    const metaLine = [
        seasonCount > 0 ? `${seasonCount} ${seasonCount === 1 ? 'season' : 'seasons'}` : null,
        `${episodes.length} ${episodes.length === 1 ? 'release' : 'releases'}`,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <Screen
            overlays={
                <>
                    <TorrentNoticeSheet
                        torrent={notice}
                        onClose={() => setNotice(null)}
                        bottomInset={insets.bottom}
                    />
                </>
            }
        >
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    paddingBottom: insets.bottom + Spacing.xxl,
                    maxWidth: contentMaxWidth,
                    alignSelf: 'center',
                    width: '100%',
                }}
            >
                <View style={[styles.backdrop, {height: backdropHeight}]}>
                    {backdropUrl ? (
                        <Image
                            source={{uri: backdropUrl}}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            transition={240}
                            priority="high"
                            cachePolicy="memory-disk"
                        />
                    ) : (
                        <View style={[StyleSheet.absoluteFill, {backgroundColor: colors.surfaceSunken}]}/>
                    )}
                    <LinearGradient
                        colors={['rgba(6,6,8,0.15)', 'rgba(6,6,8,0.55)', colors.background]}
                        bands={14}
                        style={StyleSheet.absoluteFill}
                        pointerEvents="none"
                    />
                </View>

                <View style={{paddingHorizontal: gutter}}>
                    <Animated.View
                        entering={enterRise()}
                        style={[styles.header, {marginTop: -POSTER_OVERLAP}]}
                    >
                        <View style={[styles.poster, {backgroundColor: colors.surfaceSunken, borderColor: colors.border}]}>
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
                                {metaLine}
                            </ThemedText>
                            {meta?.rating ? (
                                <View style={[styles.ratingPill, {backgroundColor: colors.accentSoft}]}>
                                    <Ionicons name="star" size={12} color={colors.accent}/>
                                    <ThemedText style={[styles.ratingLabel, {color: colors.accent}]}>
                                        {meta.rating.toFixed(1)}
                                    </ThemedText>
                                </View>
                            ) : null}
                        </View>
                    </Animated.View>

                    {meta?.overview ? (
                        <Animated.View
                            entering={enterFade()}
                            style={[styles.overviewBox, {backgroundColor: colors.surfaceSunken}]}
                        >
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
                    seasons.map((group) => {
                        const expanded = openSeasons[group.season] ?? false;
                        return (
                            <View key={group.season}>
                                <PressableScale
                                    onPress={() =>
                                        setOpenSeasons((prev) => ({
                                            ...prev,
                                            [group.season]: !expanded,
                                        }))
                                    }
                                    accessibilityRole="button"
                                    accessibilityState={{expanded}}
                                    pressedScale={0.99}
                                    pressedOpacity={0.7}
                                    contentStyle={[styles.seasonRow, {borderBottomColor: colors.border}]}
                                >
                                    <ThemedText style={[styles.seasonTitle, {color: colors.text}]}>
                                        {group.season > 0 ? `Season ${group.season}` : 'Other releases'}
                                    </ThemedText>
                                    <View style={styles.seasonRight}>
                                        <ThemedText style={[Typography.videoMeta, {color: colors.textMuted}]}>
                                            {group.episodes.length}
                                        </ThemedText>
                                        <Ionicons
                                            name={expanded ? 'chevron-up' : 'chevron-down'}
                                            size={18}
                                            color={colors.textMuted}
                                        />
                                    </View>
                                </PressableScale>

                                {expanded
                                    ? group.episodes.map((episode) => (
                                          <PressableScale
                                              key={episode.id}
                                              onPress={() => setNotice(toEpisodeTorrent(episode))}
                                              accessibilityRole="button"
                                              accessibilityLabel={`${episodeCode(episode)} ${episode.title}`}
                                              pressedScale={0.99}
                                              pressedOpacity={0.7}
                                              contentStyle={[
                                                  styles.episode,
                                                  {borderBottomColor: colors.border},
                                              ]}
                                          >
                                              <View style={[styles.codePill, {backgroundColor: colors.accentSoft}]}>
                                                  <ThemedText style={[styles.code, {color: colors.accent}]}>
                                                      {episodeCode(episode)}
                                                  </ThemedText>
                                              </View>
                                              <View style={styles.episodeText}>
                                                  <ThemedText
                                                      numberOfLines={2}
                                                      style={[styles.episodeTitle, {color: colors.text}]}
                                                  >
                                                      {episode.title}
                                                  </ThemedText>
                                                  <View style={styles.episodeMeta}>
                                                      <ThemedText
                                                          style={[Typography.videoMeta, {color: colors.textMuted}]}
                                                      >
                                                          {formatSize(episode.sizeBytes)}
                                                      </ThemedText>
                                                      <View style={styles.seedPeer}>
                                                          <Ionicons name="arrow-up" size={11} color={colors.seed}/>
                                                          <ThemedText
                                                              style={[Typography.videoMeta, {color: colors.seed}]}
                                                          >
                                                              {episode.seeds}
                                                          </ThemedText>
                                                      </View>
                                                      <View style={styles.seedPeer}>
                                                          <Ionicons name="arrow-down" size={11} color={colors.peer}/>
                                                          <ThemedText
                                                              style={[Typography.videoMeta, {color: colors.peer}]}
                                                          >
                                                              {episode.peers}
                                                          </ThemedText>
                                                      </View>
                                                  </View>
                                              </View>
                                          </PressableScale>
                                      ))
                                    : null}
                            </View>
                        );
                    })
                )}
                </View>
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1},
    backdrop: {width: '100%', overflow: 'hidden'},
    header: {flexDirection: 'row', gap: Spacing.lg, alignItems: 'flex-end'},
    poster: {
        width: POSTER_WIDTH,
        height: Math.round(POSTER_WIDTH * 1.5),
        borderRadius: Radius.card,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    ratingPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        borderRadius: Radius.pill,
        paddingHorizontal: 9,
        paddingVertical: 4,
        marginTop: Spacing.xs,
    },
    ratingLabel: {fontSize: 12.5, fontFamily: FontFamily.bold},
    posterFallback: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {flex: 1, gap: Spacing.xs, paddingBottom: Spacing.xs},
    overviewBox: {marginTop: Spacing.lg, padding: Spacing.lg, borderRadius: Radius.card},
    overview: {fontSize: 14, lineHeight: 21},
    sectionHeading: {marginTop: Spacing.xl, marginBottom: Spacing.sm},
    seasonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    seasonTitle: {fontSize: 15, fontWeight: '700'},
    seasonRight: {flexDirection: 'row', alignItems: 'center', gap: Spacing.sm},
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
