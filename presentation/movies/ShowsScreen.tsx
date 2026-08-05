import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {useCallback, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, FlatList, RefreshControl, StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Show} from '@/domain';
import {Analytics} from '@/presentation/analytics/events';
import {PressableScale, enterFade, enterRise} from '../components/motion';
import {ThemedText} from '../components/themed-text';
import {Screen} from '../components/screen';
import {FontFamily, Radius, Spacing, Typography} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';
import {useResponsive} from '../hooks/use-responsive';
import {ScrollProgress} from './components/ScrollProgress';
import {SkeletonBlock} from './components/PosterSkeleton';
import {useTopBarHeight} from './components/TopBar';
import {TopBarSlot} from './components/TopBarSlot';
import {useGoTo} from './constants/destinations';
import type {ShowsViewModel} from './useShowsViewModel';

const CARD_MIN_WIDTH = 304;
const SINGLE_COLUMN_MAX_WIDTH = 480;
const COLUMN_GAP = 16;
const ROW_GAP = 24;
const THUMB_ASPECT = 16 / 9;
const SKELETON_ROWS = 3;

function episodeLabel(show: Show): string {
    const {season, episode} = show.latestEpisode;
    if (!season && !episode) return 'New releases';
    const padded = `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
    return `Latest ${padded}`;
}

export function ShowsScreen({viewModel}: {viewModel: ShowsViewModel}) {
    const {colors} = usePalette();
    const insets = useSafeAreaInsets();
    const {width, contentMaxWidth, gutter} = useResponsive();
    const topBarHeight = useTopBarHeight();
    const goTo = useGoTo();
    const {shows, status, refreshing, loadingMore, loadMore, reload} = viewModel;

    const [lastVisible, setLastVisible] = useState(0);
    const [atTop, setAtTop] = useState(true);
    const listRef = useRef<FlatList<Show[]>>(null);

    const gridWidth = Math.min(width, contentMaxWidth);
    const columnsWidth = Math.max(0, gridWidth - gutter * 2);

    const numColumns = useMemo(() => {
        if (width < SINGLE_COLUMN_MAX_WIDTH) return 1;
        return Math.max(2, Math.floor((columnsWidth + COLUMN_GAP) / (CARD_MIN_WIDTH + COLUMN_GAP)));
    }, [columnsWidth, width]);

    const cardWidth = Math.max(
        1,
        Math.floor((columnsWidth - COLUMN_GAP * (numColumns - 1)) / numColumns)
    );

    const rows = useMemo(() => {
        const chunks: Show[][] = [];
        for (let start = 0; start < shows.length; start += numColumns) {
            chunks.push(shows.slice(start, start + numColumns));
        }
        return chunks;
    }, [numColumns, shows]);

    const onViewableItemsChanged = useRef(
        ({viewableItems}: {viewableItems: {index: number | null}[]}) => {
            const max = viewableItems.reduce(
                (acc, token) => (token.index != null && token.index > acc ? token.index : acc),
                -1
            );
            if (max >= 0) setLastVisible(max);
        }
    ).current;

    const viewabilityConfig = useRef({itemVisiblePercentThreshold: 10, minimumViewTime: 50}).current;

    const renderRow = useCallback(
        ({item}: {item: Show[]}) => (
            <View style={[styles.row, {paddingHorizontal: gutter, maxWidth: contentMaxWidth}]}>
                {item.map((show) => (
                    <ShowCard key={show.imdbId} show={show} width={cardWidth}/>
                ))}
            </View>
        ),
        [cardWidth, contentMaxWidth, gutter]
    );

    if (status === 'loading') {
        const cardHeight = Math.round(cardWidth / THUMB_ASPECT);
        return (
            <Screen>
                <View style={{paddingTop: topBarHeight + Spacing.lg, rowGap: ROW_GAP}}>
                    {Array.from({length: SKELETON_ROWS}).map((_, row) => (
                        <View
                            key={row}
                            style={[styles.row, {paddingHorizontal: gutter, maxWidth: contentMaxWidth}]}
                        >
                            {Array.from({length: numColumns}).map((__, column) => (
                                <View key={column} style={{width: cardWidth}}>
                                    <SkeletonBlock
                                        style={{height: cardHeight, borderRadius: Radius.card}}
                                    />
                                    <SkeletonBlock
                                        style={{height: 15, borderRadius: 4, marginTop: Spacing.md, width: '72%'}}
                                    />
                                    <SkeletonBlock
                                        style={{height: 12, borderRadius: 4, marginTop: 6, width: '44%'}}
                                    />
                                </View>
                            ))}
                        </View>
                    ))}
                </View>
            </Screen>
        );
    }

    if (status !== 'ready') {
        return (
            <Screen>
                <Animated.View
                    entering={enterRise()}
                    style={[styles.centered, {paddingTop: topBarHeight, paddingBottom: insets.bottom}]}
                >
                    <View style={[styles.glyph, {backgroundColor: colors.surfaceSunken}]}>
                        <Ionicons name="tv-outline" size={34} color={colors.accent}/>
                    </View>
                    <View style={[styles.badge, {backgroundColor: colors.accentSoft}]}>
                        <ThemedText style={[styles.badgeLabel, {color: colors.accent}]}>COMING SOON</ThemedText>
                    </View>
                    <ThemedText type="heading" style={styles.title}>Shows are on the way</ThemedText>
                    <ThemedText style={[styles.body, {color: colors.textMuted}]}>
                        Series browsing is not available right now. Movies are all yours in the meantime.
                    </ThemedText>
                    <PressableScale
                        onPress={() => {
                            Analytics.browseAllOpen('shows_placeholder');
                            goTo('/movies');
                        }}
                        accessibilityRole="link"
                        pressedScale={0.94}
                        pressedOpacity={0.85}
                        hoveredScale={1.03}
                    >
                        <View style={[styles.cta, {backgroundColor: colors.accent}]}>
                            <Ionicons name="film-outline" size={17} color={colors.onAccent}/>
                            <ThemedText style={[styles.ctaLabel, {color: colors.onAccent}]}>
                                Browse movies
                            </ThemedText>
                        </View>
                    </PressableScale>
                </Animated.View>
            </Screen>
        );
    }

    return (
        <Screen
            overlays={
                <>
                    <ScrollProgress
                        current={Math.min((lastVisible + 1) * numColumns, shows.length)}
                        total={shows.length}
                        atTop={atTop}
                        onScrollToTop={() => listRef.current?.scrollToOffset({offset: 0, animated: true})}
                        bottomInset={insets.bottom}
                        visible={shows.length > 0}
                    />
                    <TopBarSlot showSearch={false}/>
                </>
            }
        >
            <FlatList
                ref={listRef}
                data={rows}
                keyExtractor={(item, index) => item[0]?.imdbId ?? `row-${index}`}
                renderItem={renderRow}
                showsVerticalScrollIndicator={false}
                onEndReached={loadMore}
                onEndReachedThreshold={3}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                onScroll={(event) => setAtTop(event.nativeEvent.contentOffset.y <= 8)}
                scrollEventThrottle={16}
                initialNumToRender={4}
                maxToRenderPerBatch={4}
                windowSize={9}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={reload}
                        tintColor={colors.accent}
                        colors={[colors.accent]}
                        progressViewOffset={topBarHeight}
                    />
                }
                ListFooterComponent={
                    loadingMore ? (
                        <View style={[styles.footer, {paddingBottom: Spacing.lg}]}>
                            <ActivityIndicator color={colors.accent}/>
                            <ThemedText style={[styles.footerLabel, {color: colors.textMuted}]}>
                                Loading more series…
                            </ThemedText>
                        </View>
                    ) : null
                }
                contentContainerStyle={{
                    alignSelf: 'center',
                    width: '100%',
                    paddingTop: topBarHeight + Spacing.lg,
                    paddingBottom: insets.bottom + Spacing.xxl,
                    rowGap: ROW_GAP,
                }}
            />
        </Screen>
    );
}

function ShowCard({show, width}: {show: Show; width: number}) {
    const {colors} = usePalette();
    const goTo = useGoTo();
    const [artFailed, setArtFailed] = useState(false);
    const thumbHeight = Math.round(width / THUMB_ASPECT);

    const open = () => {
        Analytics.movieOpen({id: show.latestEpisode.id, title: show.title}, 'shows_grid');
        goTo(`/show/${show.imdbId}`);
    };

    return (
        <Animated.View entering={enterFade()} style={{width}}>
          <PressableScale
            onPress={open}
            accessibilityRole="link"
            accessibilityLabel={`${show.title}, ${episodeLabel(show)}`}
            pressedScale={0.98}
            pressedOpacity={0.85}
          >
            <View style={[styles.thumb, {height: thumbHeight, backgroundColor: colors.surfaceSunken}]}>
                {show.thumbnailUrl && !artFailed ? (
                    <Image
                        source={{uri: show.thumbnailUrl}}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={180}
                        cachePolicy="memory-disk"
                        onError={() => setArtFailed(true)}
                    />
                ) : (
                    <View style={styles.thumbFallback}>
                        <Ionicons name="tv-outline" size={28} color={colors.textFaint}/>
                    </View>
                )}
            </View>
            <View style={styles.info}>
                <ThemedText
                    numberOfLines={2}
                    style={[Typography.videoTitle, styles.cardTitle, {color: colors.text}]}
                >
                    {show.title}
                </ThemedText>
                <ThemedText numberOfLines={1} style={[Typography.videoMeta, {color: colors.textMuted}]}>
                    {episodeLabel(show)}
                </ThemedText>
            </View>
          </PressableScale>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    row: {flexDirection: 'row', gap: COLUMN_GAP, alignSelf: 'center', width: '100%'},
    thumb: {width: '100%', borderRadius: Radius.card, overflow: 'hidden'},
    thumbFallback: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    info: {paddingTop: Spacing.md, gap: 3},
    cardTitle: {fontWeight: '600'},

    centered: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: Spacing.sm},
    footer: {alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingTop: Spacing.md},
    footerLabel: {fontSize: 13},
    glyph: {
        width: 76,
        height: 76,
        borderRadius: 38,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.xs,
    },
    badge: {borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4},
    badgeLabel: {fontSize: 10.5, letterSpacing: 0.8, fontFamily: FontFamily.extrabold},
    title: {marginTop: Spacing.xs},
    body: {fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 380},
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        borderRadius: Radius.pill,
        paddingHorizontal: 22,
        paddingVertical: 12,
        marginTop: Spacing.md,
    },
    ctaLabel: {fontSize: 15, fontFamily: FontFamily.bold},
});
