import {Ionicons} from '@expo/vector-icons';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FlatList, Platform, Pressable, StyleSheet, View} from 'react-native';
import type {Movie} from '@/domain';
import {FontFamily, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {LinearGradient} from '../../components/linear-gradient';
import {ThemedText} from '../../components/themed-text';
import {MoviePosterItem} from './MoviePosterItem';
import {POSTER_GAP} from './moviePosterLayout';

export type RailVariant = 'standard' | 'ranked';

interface MovieRailProps {
    title: string;
    subtitle?: string;
    movies: Movie[];
    variant?: RailVariant;
    posterWidth: number;
    gutter: number;
    onSeeAll?: () => void;
}

const IS_WEB = Platform.OS === 'web';
const MIN_LOOP_ITEMS = 20;
const COPIES = 5;
const CENTER_COPY = 2;
const RANKED_MIN_LOOP_ITEMS = 8;

function rankedMetrics(posterWidth: number) {
    const numeralSize = posterWidth * 1.5 * 0.86;
    const numeralArea = Math.round(numeralSize * 1.3);
    const overlap = Math.round(posterWidth * 0.3);
    return {numeralSize, numeralArea, overlap};
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
                          }: MovieRailProps) {
    const {colors} = usePalette();
    const ranked = variant === 'ranked';
    const n = movies.length;
    const loop = n >= (ranked ? RANKED_MIN_LOOP_ITEMS : MIN_LOOP_ITEMS);

    const listRef = useRef<FlatList<Movie>>(null);
    const scrollXRef = useRef(0);
    const pagingRef = useRef(false);
    const pagingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const centeredRef = useRef(false);
    const [hovered, setHovered] = useState(false);
    const [metrics, setMetrics] = useState<RailMetrics>({scrollX: 0, layoutW: 0, contentW: 0});

    const posterHeight = posterWidth * 1.5;
    const rankedM = rankedMetrics(posterWidth);
    const itemFullWidth = ranked
        ? rankedM.numeralArea - rankedM.overlap + posterWidth + POSTER_GAP
        : posterWidth + POSTER_GAP;
    const oneCopy = n * itemFullWidth;
    const centerOffset = CENTER_COPY * oneCopy;
    const maxScroll = Math.max(0, metrics.contentW - metrics.layoutW);
    const page = Math.max(itemFullWidth, metrics.layoutW - itemFullWidth);

    const canLeft = loop || metrics.scrollX > 1;
    const canRight = loop || metrics.scrollX < maxScroll - 1;

    const data = useMemo(
        () => (loop ? Array.from({length: COPIES * n}, (_, i) => movies[i % n]) : movies),
        [loop, movies, n]
    );

    const normalize = useCallback(
        (x: number): number => {
            if (oneCopy <= 0) return x;
            const lo = (CENTER_COPY - 0.5) * oneCopy;
            const hi = (CENTER_COPY + 1.5) * oneCopy;
            let v = x;
            while (v < lo) v += oneCopy;
            while (v >= hi) v -= oneCopy;
            return v;
        },
        [oneCopy]
    );

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
            if (loop) {
                if (!pagingRef.current) {
                    const nx = normalize(x);
                    if (Math.abs(nx - x) > 0.5) scrollRailTo(nx, false);
                }
            } else {
                setMetrics((m) => (m.scrollX === x ? m : {...m, scrollX: x}));
            }
        },
        [loop, normalize, scrollRailTo]
    );

    const onLayout = useCallback(
        ({nativeEvent}: {nativeEvent: {layout: {width: number}}}) =>
            setMetrics((m) => ({...m, layoutW: nativeEvent.layout.width})),
        []
    );

    const onContentSizeChange = useCallback(
        (w: number) => {
            setMetrics((m) => ({...m, contentW: w}));
            if (loop && !centeredRef.current && w >= centerOffset + 200) {
                centeredRef.current = true;
                scrollXRef.current = centerOffset;
                scrollRailTo(centerOffset, false);
            }
        },
        [loop, centerOffset, scrollRailTo]
    );

    const scrollByPage = useCallback(
        (direction: 1 | -1) => {
            let start = scrollXRef.current;
            if (loop) {
                const centered = normalize(start);
                if (Math.abs(centered - start) > 0.5) {
                    scrollRailTo(centered, false);
                }
                start = centered;
            }
            const raw = start + direction * page;
            const target = loop ? raw : Math.min(maxScroll, Math.max(0, raw));
            pagingRef.current = true;
            scrollRailTo(target, true);
            if (pagingTimerRef.current) clearTimeout(pagingTimerRef.current);
            pagingTimerRef.current = setTimeout(() => {
                pagingRef.current = false;
            }, 500);
        },
        [loop, normalize, page, maxScroll, scrollRailTo]
    );

    useEffect(() => {
        centeredRef.current = false;
        scrollXRef.current = loop ? centerOffset : 0;
    }, [loop, centerOffset, movies]);

    useEffect(
        () => () => {
            if (pagingTimerRef.current) clearTimeout(pagingTimerRef.current);
        },
        []
    );

    const renderItem = useCallback(
        ({item, index}: {item: Movie; index: number}) =>
            ranked ? (
                <RankedPoster movie={item} rank={(index % n) + 1} posterWidth={posterWidth}/>
            ) : (
                <MoviePosterItem movie={item} width={posterWidth}/>
            ),
        [ranked, posterWidth, n]
    );

    const keyExtractor = useCallback((item: Movie, index: number) => `${item.id}:${index}`, []);

    const getItemLayout = useCallback(
        (_: ArrayLike<Movie> | null | undefined, index: number) => ({
            length: itemFullWidth,
            offset: itemFullWidth * index,
            index,
        }),
        [itemFullWidth]
    );

    const trackEvents = IS_WEB || loop;
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
            initialNumToRender={8}
            windowSize={9}
            decelerationRate="fast"
            getItemLayout={getItemLayout}
            onScroll={trackEvents ? onScroll : undefined}
            onLayout={trackEvents ? onLayout : undefined}
            onContentSizeChange={trackEvents ? onContentSizeChange : undefined}
            scrollEventThrottle={16}
        />
    );

    return (
        <View style={styles.rail}>
            <View style={[styles.header, {paddingHorizontal: gutter}]}>
                <View style={styles.headerText}>
                    <ThemedText type="heading" style={styles.title}>
                        {title}
                    </ThemedText>
                    {subtitle ? (
                        <ThemedText style={[styles.subtitle, {color: colors.textMuted}]}>
                            {subtitle}
                        </ThemedText>
                    ) : null}
                </View>
                {onSeeAll ? (
                    <Pressable
                        onPress={onSeeAll}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`See all ${title}`}
                        style={({pressed}) => [styles.seeAll, {opacity: pressed ? 0.6 : 1}]}
                    >
                        <ThemedText style={[styles.seeAllLabel, {color: colors.accent}]}>All</ThemedText>
                        <Ionicons name="chevron-forward" size={15} color={colors.accent}/>
                    </Pressable>
                ) : null}
            </View>

            {IS_WEB ? (
                <Pressable
                    onHoverIn={() => setHovered(true)}
                    onHoverOut={() => setHovered(false)}
                    style={styles.listWrap}
                >
                    {list}
                    {hovered && canLeft ? (
                        <RailHandle side="left" height={posterHeight} onPress={() => scrollByPage(-1)}/>
                    ) : null}
                    {hovered && canRight ? (
                        <RailHandle side="right" height={posterHeight} onPress={() => scrollByPage(1)}/>
                    ) : null}
                </Pressable>
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
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={left ? 'Scroll left' : 'Scroll right'}
            style={[styles.handle, left ? styles.handleLeft : styles.handleRight, {height}]}
        >
            <LinearGradient
                colors={left ? ['rgba(8,8,10,0.72)', 'rgba(8,8,10,0)'] : ['rgba(8,8,10,0)', 'rgba(8,8,10,0.72)']}
                direction="horizontal"
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
            />
            <Ionicons name={left ? 'chevron-back' : 'chevron-forward'} size={30} color="#fff"/>
        </Pressable>
    );
}

function RankedPoster({movie, rank, posterWidth}: {movie: Movie; rank: number; posterWidth: number}) {
    const {colors, scheme} = usePalette();
    const posterHeight = posterWidth * 1.5;
    const {numeralSize, numeralArea, overlap} = rankedMetrics(posterWidth);
    const numeralColor = scheme === 'dark' ? colors.surfaceElevated : colors.surfaceSunken;

    return (
        <View style={[styles.rankedCell, {height: posterHeight}]}>
            <View style={[styles.numeralArea, {width: numeralArea, marginRight: -overlap}]} pointerEvents="none">
                <ThemedText
                    type="display"
                    style={[styles.numeral, {fontSize: numeralSize, lineHeight: numeralSize, color: numeralColor}]}
                >
                    {rank}
                </ThemedText>
            </View>
            <MoviePosterItem movie={movie} width={posterWidth}/>
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
    title: {fontSize: 21, lineHeight: 26},
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

    rankedCell: {flexDirection: 'row', alignItems: 'flex-end'},
    numeralArea: {height: '100%', justifyContent: 'flex-end', alignItems: 'flex-end'},
    numeral: {
        fontFamily: FontFamily.displayExtra,
        textAlign: 'right',
        includeFontPadding: false,
    },
});
