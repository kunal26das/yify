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

const RANKED_NUMERAL_SCALE = 0.86;
const RANKED_OVERLAP_RATIO = 0.28;

function rankedNumeralSize(posterWidth: number) {
    return posterWidth * 1.5 * RANKED_NUMERAL_SCALE;
}

function rankedOverlap(posterWidth: number) {
    return Math.round(posterWidth * RANKED_OVERLAP_RATIO);
}

// Width of the numeral box. Single digits (ranks 1-9) hug the glyph so the rail stays tight; only
// the two-digit "10" gets the wide box it needs (any narrower and RN clips it). Keeping this
// per-rank is what stops the lone "10" from forcing every item apart.
function rankedNumeralArea(rank: number, posterWidth: number) {
    const size = rankedNumeralSize(posterWidth);
    return Math.round(size * (String(rank).length >= 2 ? 1.12 : 0.66));
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
    const wrapRef = useRef<View>(null);
    const [hovered, setHovered] = useState(false);
    const [metrics, setMetrics] = useState<RailMetrics>({scrollX: 0, layoutW: 0, contentW: 0});

    const posterHeight = posterWidth * 1.5;

    const data = useMemo(
        () => (loop ? Array.from({length: COPIES * n}, (_, i) => movies[i % n]) : movies),
        [loop, movies, n]
    );

    // Ranked items have per-rank widths (single vs two-digit numeral), so item widths and offsets
    // can't be derived from a single itemFullWidth — build them explicitly for getItemLayout/looping.
    const {itemWidths, oneCopy, avgItemWidth} = useMemo(() => {
        if (ranked) {
            const widths = data.map((_, i) => rankedItemWidth((i % n) + 1, posterWidth));
            let copy = 0;
            for (let rank = 1; rank <= n; rank++) copy += rankedItemWidth(rank, posterWidth);
            return {itemWidths: widths, oneCopy: copy, avgItemWidth: n > 0 ? copy / n : 0};
        }
        const w = posterWidth + POSTER_GAP;
        return {itemWidths: data.map(() => w), oneCopy: n * w, avgItemWidth: w};
    }, [ranked, data, n, posterWidth]);

    const itemOffsets = useMemo(() => {
        const arr: number[] = new Array(itemWidths.length);
        let acc = 0;
        for (let i = 0; i < itemWidths.length; i++) {
            arr[i] = acc;
            acc += itemWidths[i];
        }
        return arr;
    }, [itemWidths]);

    const centerOffset = CENTER_COPY * oneCopy;
    const maxScroll = Math.max(0, metrics.contentW - metrics.layoutW);
    const page = Math.max(avgItemWidth, metrics.layoutW - avgItemWidth);

    const canLeft = loop || metrics.scrollX > 1;
    const canRight = loop || metrics.scrollX < maxScroll - 1;

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

    // Track hover with native pointerenter/pointerleave on the wrapper DOM node. Unlike RN
    // Pressable's onHoverIn/Out (which fire when the pointer crosses onto a child poster), these
    // don't fire on child transitions, so the arrows stay visible while hovering the posters. The
    // pointerType guard suppresses touch, so tapping a poster on touch-web doesn't stick the arrows.
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
            length: itemWidths[index] ?? avgItemWidth,
            offset: itemOffsets[index] ?? avgItemWidth * index,
            index,
        }),
        [itemWidths, itemOffsets, avgItemWidth]
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
                <View ref={wrapRef} style={styles.listWrap}>
                    {list}
                    {hovered && canLeft ? (
                        <RailHandle side="left" height={posterHeight} onPress={() => scrollByPage(-1)}/>
                    ) : null}
                    {hovered && canRight ? (
                        <RailHandle side="right" height={posterHeight} onPress={() => scrollByPage(1)}/>
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
    const numeralSize = rankedNumeralSize(posterWidth);
    const numeralArea = rankedNumeralArea(rank, posterWidth);
    const overlap = rankedOverlap(posterWidth);
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
