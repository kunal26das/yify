import {Ionicons} from '@expo/vector-icons';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FlatList, Platform, StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';
import type {Movie} from '@/domain';
import {FontFamily, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {LinearGradient} from '../../components/linear-gradient';
import {ThemedText, type ThemedTextType} from '../../components/themed-text';
import {Duration, PressableScale, enterFade, enterRise, exitFade} from '../../components/motion';
import {MoviePosterItem} from './MoviePosterItem';
import {MovieLandscapeItem, landscapeCellHeight, landscapeWidth} from './MovieLandscapeItem';
import {Analytics} from '@/presentation/analytics/events';
import {POSTER_GAP} from './moviePosterLayout';

export type RailVariant = 'standard' | 'ranked' | 'landscape';

interface MovieRailProps {
    title: string;
    subtitle?: string;
    movies: Movie[];
    variant?: RailVariant;
    posterWidth: number;
    gutter: number;
    onSeeAll?: () => void;
    markNew?: boolean;
    titleType?: ThemedTextType;
}

const IS_WEB = Platform.OS === 'web';

const RANKED_NUMERAL_SCALE = 0.86;
const RANKED_OVERLAP_RATIO = 0.28;

function rankedNumeralSize(posterWidth: number) {
    return posterWidth * 1.5 * RANKED_NUMERAL_SCALE;
}

function rankedOverlap(posterWidth: number) {
    return Math.round(posterWidth * RANKED_OVERLAP_RATIO);
}

const RANKED_DIGIT_RATIO = 0.54;
const RANKED_ONE_RATIO = 0.4;

function rankedNumeralArea(rank: number, posterWidth: number) {
    const size = rankedNumeralSize(posterWidth);
    const ratio = String(rank)
        .split('')
        .reduce((sum, digit) => sum + (digit === '1' ? RANKED_ONE_RATIO : RANKED_DIGIT_RATIO), 0);
    return Math.round(size * ratio);
}

function rankedItemWidth(rank: number, posterWidth: number) {
    return rankedNumeralArea(rank, posterWidth) - rankedOverlap(posterWidth) + posterWidth + POSTER_GAP;
}

interface RailMetrics {
    scrollX: number;
    layoutW: number;
    contentW: number;
}

export function MovieRail({
                              title,
                              subtitle,
                              movies,
                              variant = 'standard',
                              posterWidth,
                              gutter,
                              onSeeAll,
                              markNew,
                              titleType = 'heading',
                          }: MovieRailProps) {
    const {colors} = usePalette();
    const ranked = variant === 'ranked';
    const landscape = variant === 'landscape';
    const n = movies.length;

    const listRef = useRef<FlatList<Movie>>(null);
    const scrollXRef = useRef(0);
    const pagingRef = useRef(false);
    const pagingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wrapRef = useRef<View>(null);
    const [hovered, setHovered] = useState(false);
    const [metrics, setMetrics] = useState<RailMetrics>({scrollX: 0, layoutW: 0, contentW: 0});

    const posterHeight = landscape ? landscapeCellHeight(posterWidth) : posterWidth * 1.5;

    const data = movies;

    const {itemWidths, avgItemWidth} = useMemo(() => {
        if (ranked) {
            const widths = data.map((_, i) => rankedItemWidth(i + 1, posterWidth));
            const total = widths.reduce((sum, w) => sum + w, 0);
            return {itemWidths: widths, avgItemWidth: n > 0 ? total / n : 0};
        }
        const w = (landscape ? landscapeWidth(posterWidth) : posterWidth) + POSTER_GAP;
        return {itemWidths: data.map(() => w), avgItemWidth: w};
    }, [ranked, landscape, data, n, posterWidth]);

    const itemOffsets = useMemo(() => {
        const arr: number[] = new Array(itemWidths.length);
        let acc = 0;
        for (let i = 0; i < itemWidths.length; i++) {
            arr[i] = acc;
            acc += itemWidths[i];
        }
        return arr;
    }, [itemWidths]);

    const maxScroll = Math.max(0, metrics.contentW - metrics.layoutW);
    const page = Math.max(avgItemWidth, metrics.layoutW - avgItemWidth);

    const canLeft = metrics.scrollX > 1;
    const canRight = metrics.scrollX < maxScroll - 1;

    const scrollRailTo = useCallback((offset: number, animated: boolean) => {
        const node = listRef.current?.getScrollableNode?.() as
            | (HTMLElement & {scrollLeft: number})
            | null
            | undefined;
        if (IS_WEB && node) {
            if (!animated) {
                node.scrollLeft = offset;
                return;
            }
            const start = node.scrollLeft;
            const dist = offset - start;
            const t0 = performance.now();
            const duration = 340;
            const step = (t: number) => {
                const p = Math.min(1, (t - t0) / duration);
                node.scrollLeft = start + dist * (1 - Math.pow(1 - p, 3));
                if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
            return;
        }
        listRef.current?.scrollToOffset({offset, animated});
    }, []);

    const onScroll = useCallback(
        ({nativeEvent}: {nativeEvent: {contentOffset: {x: number}}}) => {
            const x = nativeEvent.contentOffset.x;
            scrollXRef.current = x;
            setMetrics((m) => (m.scrollX === x ? m : {...m, scrollX: x}));
        },
        []
    );

    const onLayout = useCallback(
        ({nativeEvent}: {nativeEvent: {layout: {width: number}}}) =>
            setMetrics((m) => ({...m, layoutW: nativeEvent.layout.width})),
        []
    );

    const onContentSizeChange = useCallback(
        (w: number) => setMetrics((m) => ({...m, contentW: w})),
        []
    );

    const scrollByPage = useCallback(
        (direction: 1 | -1) => {
            const raw = scrollXRef.current + direction * page;
            pagingRef.current = true;
            scrollRailTo(Math.min(maxScroll, Math.max(0, raw)), true);
            if (pagingTimerRef.current) clearTimeout(pagingTimerRef.current);
            pagingTimerRef.current = setTimeout(() => {
                pagingRef.current = false;
            }, 500);
        },
        [page, maxScroll, scrollRailTo]
    );

    useEffect(() => {
        scrollXRef.current = 0;
    }, [movies]);

    useEffect(
        () => () => {
            if (pagingTimerRef.current) clearTimeout(pagingTimerRef.current);
        },
        []
    );

    useEffect(() => {
        if (!IS_WEB) return;
        const node = wrapRef.current as unknown as HTMLElement | null;
        if (!node?.addEventListener) return;
        const enter = (e: PointerEvent) => {
            if (e.pointerType !== 'touch') setHovered(true);
        };
        const leave = (e: PointerEvent) => {
            if (e.pointerType !== 'touch') setHovered(false);
        };
        node.addEventListener('pointerenter', enter as EventListener);
        node.addEventListener('pointerleave', leave as EventListener);
        return () => {
            node.removeEventListener('pointerenter', enter as EventListener);
            node.removeEventListener('pointerleave', leave as EventListener);
        };
    }, []);

    const renderItem = useCallback(
        ({item, index}: {item: Movie; index: number}) => {
            if (ranked) {
                return <RankedPoster movie={item} rank={index + 1} posterWidth={posterWidth} source={title}/>;
            }
            if (landscape) {
                return (
                    <MovieLandscapeItem
                        movie={item}
                        posterWidth={posterWidth}
                        source={title}
                        isNew={markNew}
                    />
                );
            }
            return <MoviePosterItem movie={item} width={posterWidth} source={title} isNew={markNew}/>;
        },
        [ranked, landscape, posterWidth, title, markNew]
    );

    const keyExtractor = useCallback((item: Movie, index: number) => `${item.id}:${index}`, []);

    const getItemLayout = useCallback(
        (_: ArrayLike<Movie> | null | undefined, index: number) => ({
            length: itemWidths[index] ?? avgItemWidth,
            offset: itemOffsets[index] ?? avgItemWidth * index,
            index,
        }),
        [itemWidths, itemOffsets, avgItemWidth]
    );

    const trackEvents = IS_WEB;
    const list = (
        <FlatList
            ref={listRef}
            data={data}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
                paddingHorizontal: gutter - POSTER_GAP / 2,
                paddingRight: ranked ? gutter : gutter - POSTER_GAP / 2,
            }}
            initialNumToRender={6}
            windowSize={5}
            removeClippedSubviews
            decelerationRate="fast"
            getItemLayout={ranked ? undefined : getItemLayout}
            onScroll={trackEvents ? onScroll : undefined}
            onLayout={trackEvents ? onLayout : undefined}
            onContentSizeChange={trackEvents ? onContentSizeChange : undefined}
            scrollEventThrottle={16}
        />
    );

    return (
        <View style={styles.rail}>
            <Animated.View entering={enterRise()} style={[styles.header, {paddingHorizontal: gutter}]}>
                <View style={styles.headerText}>
                    <ThemedText type={titleType}>{title}</ThemedText>
                    {subtitle ? (
                        <ThemedText style={[styles.subtitle, {color: colors.textMuted}]}>
                            {subtitle}
                        </ThemedText>
                    ) : null}
                </View>
                {onSeeAll ? (
                    <PressableScale
                        onPress={onSeeAll}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`See all ${title}`}
                        pressedScale={0.93}
                        pressedOpacity={0.6}
                        hoveredScale={IS_WEB ? 1.06 : 1}
                        contentStyle={styles.seeAll}
                    >
                        <ThemedText style={[styles.seeAllLabel, {color: colors.accent}]}>View All</ThemedText>
                        <Ionicons name="chevron-forward" size={15} color={colors.accent}/>
                    </PressableScale>
                ) : null}
            </Animated.View>

            {IS_WEB ? (
                <View ref={wrapRef} style={styles.listWrap}>
                    {list}
                    {hovered && canLeft ? (
                        <RailHandle side="left" height={posterHeight} onPress={() => {
                            Analytics.railPage(title, 'back');
                            scrollByPage(-1);
                        }}/>
                    ) : null}
                    {hovered && canRight ? (
                        <RailHandle side="right" height={posterHeight} onPress={() => {
                            Analytics.railPage(title, 'forward');
                            scrollByPage(1);
                        }}/>
                    ) : null}
                </View>
            ) : (
                list
            )}
        </View>
    );
}

function RailHandle({
                        side,
                        height,
                        onPress,
                    }: {
    side: 'left' | 'right';
    height: number;
    onPress: () => void;
}) {
    const left = side === 'left';
    return (
        <Animated.View
            entering={enterFade()}
            exiting={exitFade}
            style={[styles.handle, left ? styles.handleLeft : styles.handleRight, {height}]}
        >
            <PressableScale
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={left ? 'Scroll left' : 'Scroll right'}
                pressedScale={0.9}
                hoveredScale={1.12}
                duration={Duration.fast}
                style={styles.handleHit}
                contentStyle={styles.handleHit}
            >
                <LinearGradient
                    colors={left ? ['rgba(8,8,10,0.72)', 'rgba(8,8,10,0)'] : ['rgba(8,8,10,0)', 'rgba(8,8,10,0.72)']}
                    direction="horizontal"
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                />
                <Ionicons name={left ? 'chevron-back' : 'chevron-forward'} size={30} color="#fff"/>
            </PressableScale>
        </Animated.View>
    );
}

function RankedPoster({movie, rank, posterWidth, source}: {movie: Movie; rank: number; posterWidth: number; source?: string}) {
    const {colors} = usePalette();
    const posterHeight = posterWidth * 1.5;
    const numeralSize = rankedNumeralSize(posterWidth);
    const overlap = rankedOverlap(posterWidth);

    return (
        <View style={[styles.rankedCell, {height: posterHeight + POSTER_GAP}]}>
            <Animated.View
                entering={enterFade()}
                style={[styles.numeralArea, {marginRight: -overlap}]}
                pointerEvents="none"
            >
                <ThemedText
                    type="display"
                    numberOfLines={1}
                    style={[styles.numeral, {fontSize: numeralSize, lineHeight: numeralSize, color: colors.rankNumeral}]}
                >
                    {rank}
                </ThemedText>
            </Animated.View>
            <MoviePosterItem movie={movie} width={posterWidth} source={source} hideRankFlag/>
        </View>
    );
}

const styles = StyleSheet.create({
    rail: {marginBottom: Spacing.xl},
    header: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
        gap: Spacing.md,
    },
    headerText: {flexShrink: 1},
    subtitle: {fontSize: 13, marginTop: 2, fontFamily: FontFamily.regular},
    seeAll: {flexDirection: 'row', alignItems: 'center', gap: 1, paddingVertical: 2},
    seeAllLabel: {fontSize: 14, fontWeight: '700'},

    listWrap: {position: 'relative'},
    handle: {
        position: 'absolute',
        top: 0,
        width: 56,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        zIndex: 20,
    },
    handleLeft: {left: 0},
    handleRight: {right: 0},
    handleHit: {flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center'},

    rankedCell: {flexDirection: 'row', alignItems: 'flex-end'},
    numeralArea: {
        height: '100%',
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        paddingBottom: POSTER_GAP / 2,
    },
    numeral: {
        fontFamily: FontFamily.displayExtra,
        textAlign: 'right',
        includeFontPadding: false,
    },
});
