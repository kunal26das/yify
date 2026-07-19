import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useCallback, useEffect} from 'react';
import {FlatList, Pressable, RefreshControl, StyleSheet, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LiquidGlassView} from '../components/liquid-glass-view';
import {LinearGradient} from '../components/linear-gradient';
import {ThemedText} from '../components/themed-text';
import {ThemedView} from '../components/themed-view';
import {usePalette} from '../hooks/use-palette';
import {useResponsive} from '../hooks/use-responsive';
import {FontFamily, Radius, Spacing} from '../constants/theme';
import {HeroBillboard} from './components/HeroBillboard';
import {MovieRail} from './components/MovieRail';
import {PosterSkeleton} from './components/PosterSkeleton';
import {POSTER_GAP} from './components/moviePosterLayout';
import {useWatchlist} from './useWatchlist';
import type {ShelfQuery} from './constants/homeShelves';
import type {HomeViewModel, ShelfState} from './useHomeViewModel';

type Palette = ReturnType<typeof usePalette>['colors'];

function buildBrowseHref(query: ShelfQuery): string {
    const params = new URLSearchParams();
    if (query.genre) params.set('genre', query.genre);
    if (query.quality) params.set('quality', query.quality);
    if (query.minimum_rating) params.set('minimum_rating', String(query.minimum_rating));
    if (query.sort_by) params.set('sort_by', query.sort_by);
    if (query.order_by) params.set('order_by', query.order_by);
    const qs = params.toString();
    return qs ? `/browse?${qs}` : '/browse';
}

export function HomeScreen({viewModel}: {viewModel: HomeViewModel}) {
    const insets = useSafeAreaInsets();
    const {colors, scheme} = usePalette();
    const {width, isPhone, isTablet, gutter} = useResponsive();
    const {height} = useWindowDimensions();
    const {heroMovies, shelves, loading, refreshing, error, loadInitial, loadShelf, reload} = viewModel;
    const myList = useWatchlist();

    useEffect(() => {
        loadInitial();
    }, [loadInitial]);

    const posterWidth = isPhone ? 126 : isTablet ? 146 : 158;
    const heroHeight = isPhone ? Math.round(Math.min(height * 0.62, 560)) : 468;
    const glassTint = scheme === 'dark' ? 'dark' : 'light';

    const renderShelf = useCallback(
        ({item}: {item: ShelfState}) => (
            <ShelfRow
                shelf={item}
                posterWidth={posterWidth}
                gutter={gutter}
                colors={colors}
                onLoad={loadShelf}
            />
        ),
        [posterWidth, gutter, colors, loadShelf]
    );

    const TopBar = (
        <View style={styles.topBar} pointerEvents="box-none">
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <LiquidGlassView
                    tint={glassTint}
                    fallbackBackgroundColor={scheme === 'dark' ? 'rgba(20,20,22,0.55)' : 'rgba(250,249,245,0.6)'}
                    style={StyleSheet.absoluteFill}
                />
            </View>
            <View style={[styles.topBarRow, {paddingTop: insets.top + 6}]} pointerEvents="box-none">
                <ThemedText type="title" style={[styles.wordmark, {color: colors.text}]}>
                    YIFY
                </ThemedText>
                <View style={styles.topActions}>
                    <TopButton icon="search" scheme={scheme} colors={colors}
                               onPress={() => router.push('/browse?focus=1' as never)} label="Search"/>
                </View>
            </View>
        </View>
    );

    if (loading && heroMovies.length === 0 && !error) {
        return (
            <ThemedView style={styles.container}>
                <HomeSkeleton heroHeight={heroHeight} posterWidth={posterWidth} gutter={gutter} colors={colors}/>
                {TopBar}
            </ThemedView>
        );
    }

    if (error && heroMovies.length === 0) {
        return (
            <ThemedView style={styles.container}>
                <View style={[styles.centered, {paddingTop: insets.top}]}>
                    <Ionicons name="cloud-offline-outline" size={56} color={colors.textMuted}/>
                    <ThemedText type="heading" style={styles.stateTitle}>Something went wrong</ThemedText>
                    <ThemedText style={[styles.stateMessage, {color: colors.textMuted}]}>{error}</ThemedText>
                    <Pressable onPress={reload} style={({pressed}) => ({opacity: pressed ? 0.85 : 1})}>
                        <View style={[styles.cta, {backgroundColor: colors.accent}]}>
                            <Ionicons name="refresh" size={18} color={colors.onAccent}/>
                            <ThemedText style={[styles.ctaLabel, {color: colors.onAccent}]}>Try again</ThemedText>
                        </View>
                    </Pressable>
                </View>
                {TopBar}
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <FlatList
                data={shelves}
                keyExtractor={(item) => item.key}
                renderItem={renderShelf}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                    <>
                        {heroMovies.length > 0 ? (
                            <View style={styles.heroWrap}>
                                <HeroBillboard movies={heroMovies} width={width} height={heroHeight}/>
                            </View>
                        ) : (
                            <View style={{height: insets.top + 64}}/>
                        )}
                        {myList.length > 0 ? (
                            <MovieRail
                                title="My List"
                                movies={myList}
                                posterWidth={posterWidth}
                                gutter={gutter}
                            />
                        ) : null}
                    </>
                }
                ListFooterComponent={
                    <Pressable
                        onPress={() => router.push('/browse' as never)}
                        style={({pressed}) => [styles.browseAll, {borderColor: colors.accent, opacity: pressed ? 0.8 : 1}]}
                    >
                        <ThemedText style={[styles.browseAllLabel, {color: colors.text}]}>
                            Browse the full catalog
                        </ThemedText>
                        <Ionicons name="arrow-forward" size={18} color={colors.accent}/>
                    </Pressable>
                }
                contentContainerStyle={{paddingBottom: insets.bottom + 40}}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={reload}
                        tintColor={colors.accent}
                        colors={[colors.accent]}
                        progressViewOffset={insets.top + 44}
                    />
                }
                initialNumToRender={3}
                maxToRenderPerBatch={3}
                windowSize={5}
            />
            {TopBar}
        </ThemedView>
    );
}

// One home shelf. Requests its data the first time it mounts near the viewport (so the home
// doesn't fetch every shelf at once), shows a skeleton until it arrives, and collapses if empty.
function ShelfRow({
                      shelf,
                      posterWidth,
                      gutter,
                      colors,
                      onLoad,
                  }: {
    shelf: ShelfState;
    posterWidth: number;
    gutter: number;
    colors: Palette;
    onLoad: (key: string) => void;
}) {
    useEffect(() => {
        if (shelf.status === 'idle') onLoad(shelf.key);
    }, [shelf.status, shelf.key, onLoad]);

    if (shelf.status === 'empty' || shelf.status === 'error') return null;

    if (shelf.status === 'loaded') {
        return (
            <MovieRail
                title={shelf.title}
                subtitle={shelf.subtitle}
                movies={shelf.movies}
                variant={shelf.variant}
                posterWidth={posterWidth}
                gutter={gutter}
                onSeeAll={() => router.push(buildBrowseHref(shelf.query) as never)}
            />
        );
    }

    return <ShelfSkeleton title={shelf.title} posterWidth={posterWidth} gutter={gutter} colors={colors}/>;
}

function ShelfSkeleton({
                           title,
                           posterWidth,
                           gutter,
                           colors,
                       }: {
    title: string;
    posterWidth: number;
    gutter: number;
    colors: Palette;
}) {
    return (
        <View style={styles.skeletonRail}>
            <ThemedText type="heading" style={[styles.shelfSkeletonTitle, {color: colors.text, marginLeft: gutter}]}>
                {title}
            </ThemedText>
            <View style={[styles.skeletonRow, {paddingHorizontal: gutter - POSTER_GAP / 2}]}>
                {Array.from({length: 6}).map((_, i) => (
                    <PosterSkeleton key={i} width={posterWidth}/>
                ))}
            </View>
        </View>
    );
}

function TopButton({
                       icon,
                       scheme,
                       colors,
                       onPress,
                       label,
                   }: {
    icon: keyof typeof Ionicons.glyphMap;
    scheme: 'light' | 'dark';
    colors: ReturnType<typeof usePalette>['colors'];
    onPress: () => void;
    label: string;
}) {
    return (
        <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}
                   style={({pressed}) => ({opacity: pressed ? 0.7 : 1})}>
            <View
                style={[
                    styles.topButton,
                    {
                        borderColor: colors.border,
                        backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(31,29,26,0.06)',
                    },
                ]}
            >
                <Ionicons name={icon} size={19} color={colors.text}/>
            </View>
        </Pressable>
    );
}

function HomeSkeleton({
                          heroHeight,
                          posterWidth,
                          gutter,
                          colors,
                      }: {
    heroHeight: number;
    posterWidth: number;
    gutter: number;
    colors: ReturnType<typeof usePalette>['colors'];
}) {
    return (
        <View>
            <View style={{height: heroHeight, backgroundColor: colors.surfaceSunken}}>
                <LinearGradient
                    colors={['rgba(6,6,8,0)', colors.background]}
                    bands={12}
                    style={styles.meltFade}
                    pointerEvents="none"
                />
            </View>
            {[0, 1, 2].map((row) => (
                <View key={row} style={styles.skeletonRail}>
                    <View style={[styles.skeletonTitle, {backgroundColor: colors.surfaceSunken, marginLeft: gutter}]}/>
                    <View style={[styles.skeletonRow, {paddingHorizontal: gutter - 6}]}>
                        {Array.from({length: 6}).map((_, i) => (
                            <PosterSkeleton key={i} width={posterWidth}/>
                        ))}
                    </View>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1},

    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    topBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingBottom: 8,
    },
    wordmark: {fontSize: 24, letterSpacing: 1, fontFamily: FontFamily.displayExtra},
    topActions: {flexDirection: 'row', alignItems: 'center', gap: 10},
    topButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: StyleSheet.hairlineWidth,
        justifyContent: 'center',
        alignItems: 'center',
    },

    heroWrap: {marginBottom: Spacing.xl},
    meltFade: {position: 'absolute', left: 0, right: 0, bottom: 0, height: 96},

    centered: {flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 6},
    stateTitle: {marginTop: 12},
    stateMessage: {fontSize: 14, lineHeight: 20, textAlign: 'center'},
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: Radius.pill,
        paddingHorizontal: 22,
        paddingVertical: 12,
        marginTop: 20,
    },
    ctaLabel: {fontSize: 15, fontFamily: FontFamily.bold},

    browseAll: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginHorizontal: Spacing.lg,
        marginTop: Spacing.sm,
        paddingVertical: 16,
        borderRadius: Radius.lg,
        borderWidth: 1.5,
        borderStyle: 'solid',
    },
    browseAllLabel: {fontSize: 15, fontFamily: FontFamily.semibold},

    skeletonRail: {marginBottom: Spacing.xl},
    skeletonTitle: {width: 160, height: 20, borderRadius: 6, marginBottom: Spacing.md},
    shelfSkeletonTitle: {fontSize: 21, lineHeight: 26, marginBottom: Spacing.md},
    skeletonRow: {flexDirection: 'row'},
});
