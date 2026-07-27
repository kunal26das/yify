import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {router} from 'expo-router';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import {Animated, Pressable, StyleSheet, View} from 'react-native';
import type {Movie} from '@/domain';
import {Analytics} from '@/lib/analytics-events';
import {toggleWatchlist} from '@/lib/watchlist';
import {ThemedText} from '../../components/themed-text';
import {usePalette} from '../../hooks/use-palette';
import {useResponsive} from '../../hooks/use-responsive';
import {FontFamily, Radius, Spacing} from '../../constants/theme';
import {useIsInWatchlist} from '../useWatchlist';
import {useTopTenRank} from './TopTenContext';

const OPEN_DELAY_MS = 480;
const CLOSE_DELAY_MS = 140;

const CARD_WIDTH = 340;
const CARD_MARGIN = 12;
const CARD_ART_HEIGHT = Math.round((CARD_WIDTH * 9) / 16);
const CARD_HEIGHT = CARD_ART_HEIGHT + 172;
const HIT_PADDING = 10;

interface Rect {
    top: number;
    left: number;
    width: number;
    height: number;
}

interface HoverState {
    movie: Movie;
    rect: Rect;
    card: Rect;
    scroller: HTMLElement | null;
}

function scrollableAncestor(node: Element | null): HTMLElement | null {
    let el = node?.parentElement ?? null;
    while (el) {
        const overflowY = getComputedStyle(el).overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
            return el;
        }
        el = el.parentElement;
    }
    return null;
}

function contains(rect: Rect, x: number, y: number, pad = HIT_PADDING): boolean {
    return (
        x >= rect.left - pad &&
        x <= rect.left + rect.width + pad &&
        y >= rect.top - pad &&
        y <= rect.top + rect.height + pad
    );
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function cardLayoutFor(rect: Rect): Rect {
    const viewportW = typeof window === 'undefined' ? CARD_WIDTH : window.innerWidth;
    const viewportH = typeof window === 'undefined' ? CARD_HEIGHT : window.innerHeight;
    return {
        left: clamp(
            rect.left + rect.width / 2 - CARD_WIDTH / 2,
            CARD_MARGIN,
            Math.max(CARD_MARGIN, viewportW - CARD_WIDTH - CARD_MARGIN)
        ),
        top: clamp(
            rect.top + rect.height / 2 - CARD_HEIGHT / 2,
            CARD_MARGIN,
            Math.max(CARD_MARGIN, viewportH - CARD_HEIGHT - CARD_MARGIN)
        ),
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
    };
}

export interface HoverCardController {
    open: (movie: Movie, anchor: unknown, source: string) => void;
    close: () => void;
    enabled: boolean;
}

const HoverCardContext = createContext<HoverCardController>({
    open: () => {},
    close: () => {},
    enabled: false,
});

export function useHoverCard(): HoverCardController {
    return useContext(HoverCardContext);
}

export function HoverCardHost({children}: {children: ReactNode}) {
    const {isDesktop} = useResponsive();
    const [state, setState] = useState<HoverState | null>(null);
    const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const openRef = useRef<HoverState | null>(null);
    useEffect(() => {
        openRef.current = state;
    }, [state]);

    const clearTimers = useCallback(() => {
        if (openTimerRef.current) clearTimeout(openTimerRef.current);
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        openTimerRef.current = null;
        closeTimerRef.current = null;
    }, []);

    const open = useCallback(
        (movie: Movie, anchor: unknown, source: string) => {
            const node = anchor as {getBoundingClientRect?: () => DOMRect} | null;
            if (!node?.getBoundingClientRect) return;
            if (openRef.current?.movie.id === movie.id) return;
            clearTimers();
            openTimerRef.current = setTimeout(() => {
                const r = node.getBoundingClientRect!();
                if (r.width === 0) return;
                const rect = {top: r.top, left: r.left, width: r.width, height: r.height};
                setState({
                    movie,
                    rect,
                    card: cardLayoutFor(rect),
                    scroller: scrollableAncestor(node as unknown as Element),
                });
                Analytics.posterHoverCard(movie, source);
            }, OPEN_DELAY_MS);
        },
        [clearTimers]
    );

    const close = useCallback(() => {
        if (openTimerRef.current) clearTimeout(openTimerRef.current);
        openTimerRef.current = null;
    }, []);

    useEffect(() => {
        if (!state) return;
        const onMove = (e: PointerEvent) => {
            if (contains(state.rect, e.clientX, e.clientY)) return;
            if (contains(state.card, e.clientX, e.clientY)) return;
            if (closeTimerRef.current) return;
            closeTimerRef.current = setTimeout(() => {
                closeTimerRef.current = null;
                setState(null);
            }, CLOSE_DELAY_MS);
        };
        const onMoveCancelsClose = (e: PointerEvent) => {
            if (!closeTimerRef.current) return;
            if (contains(state.rect, e.clientX, e.clientY) || contains(state.card, e.clientX, e.clientY)) {
                clearTimeout(closeTimerRef.current);
                closeTimerRef.current = null;
            }
        };
        const handle = (e: PointerEvent) => {
            onMoveCancelsClose(e);
            onMove(e);
        };
        const dismiss = () => {
            clearTimers();
            setState(null);
        };
        const onWheel = (e: WheelEvent) => {
            if (contains(state.card, e.clientX, e.clientY, 0) && state.scroller) {
                e.preventDefault();
                state.scroller.scrollTop += e.deltaY;
            }
            dismiss();
        };

        document.addEventListener('pointermove', handle, true);
        document.addEventListener('wheel', onWheel, {capture: true, passive: false});
        document.addEventListener('scroll', dismiss, true);
        window.addEventListener('resize', dismiss);
        return () => {
            document.removeEventListener('pointermove', handle, true);
            document.removeEventListener('wheel', onWheel, true);
            document.removeEventListener('scroll', dismiss, true);
            window.removeEventListener('resize', dismiss);
        };
    }, [state, clearTimers]);

    useEffect(() => clearTimers, [clearTimers]);

    const controller = useMemo<HoverCardController>(
        () => ({open, close, enabled: isDesktop}),
        [open, close, isDesktop]
    );

    return (
        <HoverCardContext.Provider value={controller}>
            {children}
            {state ? (
                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                    <ExpandedCard
                        movie={state.movie}
                        layout={state.card}
                        onNavigate={() => {
                            clearTimers();
                            setState(null);
                        }}
                        onDismiss={() => {
                            clearTimers();
                            setState(null);
                        }}
                    />
                </View>
            ) : null}
        </HoverCardContext.Provider>
    );
}

function ExpandedCard({
                          movie,
                          layout,
                          onNavigate,
                          onDismiss,
                      }: {
    movie: Movie;
    layout: Rect;
    onNavigate: () => void;
    onDismiss: () => void;
}) {
    const {colors, scheme} = usePalette();
    const rank = useTopTenRank(movie.id);
    const saved = useIsInWatchlist(movie.id);
    const grow = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(grow, {toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4}).start();
    }, [grow]);

    const artHeight = CARD_ART_HEIGHT;
    const art = movie.backgroundImageUrl ?? movie.posterUrls[movie.posterUrls.length - 1];
    const meta = [
        movie.year ? String(movie.year) : null,
        formatRuntime(movie.runtimeMinutes),
        movie.mpaRating || null,
    ].filter(Boolean) as string[];

    const openDetails = () => {
        Analytics.movieOpen(movie, 'hover_card');
        onNavigate();
        router.push(`/movie/${movie.id}`);
    };

    return (
        <Animated.View
            style={[
                styles.card,
                {
                    top: layout.top,
                    left: layout.left,
                    width: layout.width,
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    shadowColor: scheme === 'dark' ? '#000' : '#2A2019',
                    opacity: grow,
                    transform: [{scale: grow.interpolate({inputRange: [0, 1], outputRange: [0.9, 1]})}],
                },
            ]}
        >
            <Pressable onPress={openDetails} accessibilityRole="link" accessibilityLabel={`View ${movie.title}`}>
                <View style={{height: artHeight}}>
                    {art ? (
                        <Image
                            source={{uri: art}}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            transition={140}
                            cachePolicy="memory-disk"
                        />
                    ) : null}

                    <View style={styles.playGlyph}>
                        <Ionicons name="play" size={16} color="#fff"/>
                    </View>

                    {rank ? (
                        <View style={styles.rankFlag}>
                            <ThemedText style={styles.rankFlagText}>TOP{'\n'}10</ThemedText>
                        </View>
                    ) : null}
                </View>
            </Pressable>

            <Pressable
                onPress={onDismiss}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={({pressed}) => [styles.close, {opacity: pressed ? 0.7 : 1}]}
            >
                <Ionicons name="close" size={16} color="#fff"/>
            </Pressable>

            <View style={styles.body}>
                <View style={styles.titleRow}>
                    <ThemedText type="subtitle" style={styles.title} numberOfLines={1}>
                        {movie.title}
                    </ThemedText>
                    <Pressable
                        onPress={() => {
                            const added = toggleWatchlist(movie);
                            if (added) Analytics.watchlistAdd(movie);
                            else Analytics.watchlistRemove(movie);
                        }}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={
                            saved ? `Remove ${movie.title} from My List` : `Add ${movie.title} to My List`
                        }
                        style={({pressed}) => [
                            styles.addButton,
                            {borderColor: colors.borderStrong, opacity: pressed ? 0.7 : 1},
                        ]}
                    >
                        <Ionicons name={saved ? 'checkmark' : 'add'} size={16} color={colors.text}/>
                    </Pressable>
                </View>

                <View style={styles.metaRow}>
                    {movie.rating > 0 ? (
                        <View style={styles.metaItem}>
                            <Ionicons name="star" size={12} color={colors.gold}/>
                            <ThemedText style={[styles.metaText, {color: colors.text}]}>
                                {movie.rating.toFixed(1)}
                            </ThemedText>
                        </View>
                    ) : null}
                    {meta.map((m) => (
                        <ThemedText key={m} style={[styles.metaText, {color: colors.textMuted}]}>
                            {m}
                        </ThemedText>
                    ))}
                </View>

                {movie.genres.length > 0 ? (
                    <ThemedText style={[styles.genres, {color: colors.textMuted}]} numberOfLines={1}>
                        {movie.genres.slice(0, 3).join(' · ')}
                    </ThemedText>
                ) : null}

                <Pressable
                    onPress={openDetails}
                    accessibilityRole="link"
                    accessibilityLabel={`View more details about ${movie.title}`}
                    style={({pressed}) => [
                        styles.detailsRow,
                        {borderTopColor: colors.border, opacity: pressed ? 0.7 : 1},
                    ]}
                >
                    <ThemedText style={[styles.detailsLabel, {color: colors.text}]}>
                        View More Details
                    </ThemedText>
                    <Ionicons name="chevron-forward" size={15} color={colors.textMuted}/>
                </Pressable>
            </View>
        </Animated.View>
    );
}

function formatRuntime(minutes: number): string | null {
    if (!minutes || minutes <= 0) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const styles = StyleSheet.create({
    card: {
        position: 'absolute',
        borderRadius: Radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
        shadowOffset: {width: 0, height: 12},
        shadowOpacity: 0.34,
        shadowRadius: 28,
        elevation: 12,
        zIndex: 50,
    },
    rankFlag: {
        position: 'absolute',
        top: 0,
        right: Spacing.md,
        backgroundColor: '#E11D2E',
        paddingHorizontal: 5,
        paddingVertical: 4,
        borderBottomLeftRadius: 3,
        borderBottomRightRadius: 3,
    },
    rankFlagText: {
        color: '#fff',
        fontSize: 8,
        lineHeight: 9,
        letterSpacing: 0.6,
        textAlign: 'center',
        fontFamily: FontFamily.extrabold,
    },
    playGlyph: {
        position: 'absolute',
        left: Spacing.md,
        bottom: Spacing.md,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(8,8,12,0.55)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.55)',
    },
    close: {
        position: 'absolute',
        top: Spacing.sm,
        right: Spacing.sm,
        width: 26,
        height: 26,
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(8,8,12,0.6)',
        zIndex: 5,
    },
    body: {padding: Spacing.md, gap: 7},
    titleRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm},
    title: {fontSize: 16, lineHeight: 21, flexShrink: 1},
    addButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    metaRow: {flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap'},
    metaItem: {flexDirection: 'row', alignItems: 'center', gap: 3},
    metaText: {fontSize: 12.5, fontFamily: FontFamily.semibold},
    genres: {fontSize: 12.5, fontFamily: FontFamily.regular},
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: StyleSheet.hairlineWidth,
        marginTop: 3,
        paddingTop: 10,
    },
    detailsLabel: {fontSize: 13.5, fontFamily: FontFamily.bold},
});
