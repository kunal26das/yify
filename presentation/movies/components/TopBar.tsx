import {useCallback, useEffect, useRef, useState} from 'react';
import {usePathname} from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {Image} from 'expo-image';
import {Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemedText} from '../../components/themed-text';
import {PressableScale} from '../../components/motion';
import {NavigationLink} from '../../components/navigation-link';
import {usePalette} from '../../hooks/use-palette';
import {useResponsive} from '../../hooks/use-responsive';
import {FontFamily, Radius, Spacing} from '../../constants/theme';
import {Analytics} from '@/presentation/analytics/events';
import {DESTINATIONS, navKeyForPath, useGoTo, type NavKey} from '../constants/destinations';
import {SearchOverlay} from './SearchOverlay';
import {useTopBarSlot} from './TopBarSlot';
import {useSearchHistory} from '../../di/DependenciesContext';
import {useAuth} from '../../hooks/use-auth';
import {useSubscriberAccess} from '../../hooks/use-subscriber-access';

export const TOP_BAR_ROW_HEIGHT = 64;

const STACKED_NAV_HEIGHT = 44;
const SEARCH_PILL_HEIGHT = 44;
const SEARCH_PILL_MAX_WIDTH = 400;
const SEARCH_BUTTON_WIDTH = 44;
const PREFERENCES_HREF = '/preferences';

interface NavLink {
    key: NavKey;
    label: string;
    href: string;
    upcoming?: boolean;
}

const NAV_LINKS: readonly NavLink[] = DESTINATIONS.filter(
    (destination) => destination.key !== 'home' && destination.key !== 'history'
);

function navigationMetrics(width: number, fontScale: number) {
    const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
    return {
        stacked: width > 0 && width / scale < 520,
        compact: width / scale < 900,
        rowHeight: Math.max(TOP_BAR_ROW_HEIGHT, 34 * scale + 24),
        navHeight: Math.max(STACKED_NAV_HEIGHT, 20 * scale + 24),
    };
}

export function TopBar() {
    const {status: subscriberAccess} = useSubscriberAccess();
    const links = NAV_LINKS.filter(link => link.key !== 'anime' || subscriberAccess === 'allowed');
    const {below, searchValue, onSearchSubmit, showSearch = true} = useTopBarSlot();
    const active = navKeyForPath(usePathname());
    const insets = useSafeAreaInsets();
    const {colors} = usePalette();
    const {width, isPhone, gutter} = useResponsive();
    const {fontScale} = useWindowDimensions();
    const {compact, stacked, rowHeight, navHeight} = navigationMetrics(width, fontScale);
    const navScroll = useRef<ScrollView>(null);
    const navViewport = useRef(0);
    const navOffset = useRef(0);
    const navItems = useRef(new Map<NavKey, {x: number; width: number}>());
    const revealLink = useCallback((key?: NavKey) => {
        if (!key) return;
        const item = navItems.current.get(key);
        const width = navViewport.current;
        if (!item || width <= 0 || !navScroll.current) return;
        const current = navOffset.current;
        const edge = Spacing.md;
        const target = item.x < current + edge ? Math.max(0, item.x - edge) : item.x + item.width > current + width - edge
            ? Math.max(0, item.x + item.width - width + edge) : current;
        if (target !== current) {
            navOffset.current = target;
            navScroll.current.scrollTo({x: target, animated: false});
        }
    }, []);
    useEffect(() => { revealLink(active); }, [active, compact, stacked, fontScale, revealLink]);
    const goTo = useGoTo();
    const [query, setQuery] = useState(searchValue ?? '');
    const [searchFocused, setSearchFocused] = useState(false);
    const [overlayVisible, setOverlayVisible] = useState(false);

    useEffect(() => {
        setQuery(searchValue ?? '');
    }, [searchValue]);

    const routeQuery = useCallback(
        (term: string) => {
            if (onSearchSubmit) {
                onSearchSubmit(term);
                return;
            }
            goTo(`/movies?query=${encodeURIComponent(term)}`);
        },
        [onSearchSubmit, goTo]
    );

    const searchHistory = useSearchHistory();
    const {account} = useAuth();

    const submitQuery = useCallback(
        (term: string) => {
            const trimmed = term.trim();
            if (!trimmed) return;
            searchHistory.remember(trimmed);
            Analytics.search(trimmed);
            routeQuery(trimmed);
        },
        [routeQuery, searchHistory]
    );

    const navigate = useCallback(
        (key: NavKey, href: string) => {
            Analytics.navSelect(key);
            goTo(href);
        },
        [goTo]
    );

    const openOverlay = useCallback(() => {
        Analytics.searchOpen('top_bar');
        setOverlayVisible(true);
    }, []);

    const renderLink = (link: NavLink) => {
        const selected = link.key === active;
        return (
            <NavigationLink
                key={link.key}
                href={link.href}
                onNavigate={() => navigate(link.key, link.href)}
                hitSlop={6}
                accessibilityRole="link"
                accessibilityState={{selected}}
                pressedScale={0.98}
                pressedOpacity={0.6}
                style={styles.navLinkHit}
                onFocus={() => revealLink(link.key)}
                onLayout={event => {
                    navItems.current.set(link.key, event.nativeEvent.layout);
                    if (selected) revealLink(link.key);
                }}
                contentStyle={styles.link}
            >
                <ThemedText
                    numberOfLines={1}
                    style={[
                        styles.linkLabel,
                        selected ? {color: colors.text, fontWeight: '600'} : {color: colors.textMuted},
                    ]}
                >
                    {link.label}
                </ThemedText>
                <View
                    style={[
                        styles.underline,
                        {backgroundColor: selected ? colors.accent : 'transparent'},
                    ]}
                />
            </NavigationLink>
        );
    };

    const preferencesButton = (
        <NavigationLink
            href={PREFERENCES_HREF}
            onNavigate={() => navigate('preferences', PREFERENCES_HREF)}
            hitSlop={6}
            accessibilityRole="link"
            accessibilityLabel="Preferences"
            accessibilityState={{selected: active === 'preferences'}}
            pressedScale={0.94}
            pressedOpacity={0.6}
            hoveredScale={1}
            contentStyle={styles.iconButton}
        >
            {account?.photoUrl ? (
                <Image
                    source={{uri: account.photoUrl}}
                    style={[
                        styles.avatar,
                        {
                            borderColor:
                                active === 'preferences' ? colors.accent : 'transparent',
                            backgroundColor: colors.surfaceSunken,
                        },
                    ]}
                    contentFit="cover"
                    transition={160}
                    cachePolicy="memory-disk"
                />
            ) : (
                <Ionicons
                    name="person-circle-outline"
                    size={24}
                    color={active === 'preferences' ? colors.accent : colors.textMuted}
                />
            )}
        </NavigationLink>
    );

    const searchPill = (
        <View
            style={[
                styles.searchPill,
                {
                    backgroundColor: colors.surface,
                    borderColor: searchFocused ? colors.accent : colors.border,
                },
            ]}
        >
            <TextInput
                style={[
                    styles.searchInput,
                    {color: colors.text},
                    Platform.OS === 'web' ? ({outlineStyle: 'none'} as object) : null,
                ]}
                value={query}
                onChangeText={setQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onSubmitEditing={() => submitQuery(query)}
                placeholder="Search movies"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="never"
                accessibilityLabel="Search movies"
            />
            {query.length > 0 ? (
                <PressableScale
                    onPress={() => {
                        setQuery('');
                        Analytics.searchCleared();
                        onSearchSubmit?.('');
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    pressedScale={0.94}
                    pressedOpacity={0.6}
                    hoveredScale={1}
                    contentStyle={styles.clearButton}
                >
                    <Ionicons name="close" size={18} color={colors.textMuted}/>
                </PressableScale>
            ) : null}
            <PressableScale
                onPress={() => submitQuery(query)}
                accessibilityRole="button"
                accessibilityLabel="Search"
                pressedScale={0.9}
                pressedOpacity={0.6}
                style={[
                    styles.searchButton,
                    {backgroundColor: colors.surfaceSunken, borderLeftColor: colors.border},
                ]}
            >
                <Ionicons name="search" size={18} color={colors.textMuted}/>
            </PressableScale>
        </View>
    );

    return (
        <View style={[styles.bar, {paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.border}]}>
            <View style={[styles.row, isPhone && styles.rowPhone, {paddingHorizontal: gutter, height: rowHeight}]}>
                <NavigationLink
                    href="/"
                    onNavigate={() => navigate('home', '/')}
                    accessibilityRole="link"
                    accessibilityLabel="Yify home"
                    pressedScale={0.97}
                    pressedOpacity={0.7}
                    hoveredScale={1}
                    style={isPhone && !stacked ? styles.brandNavGap : undefined}
                    contentStyle={styles.brandHit}
                >
                    <ThemedText type="title" style={[styles.wordmark, isPhone && styles.wordmarkPhone, {color: colors.text}]}>
                        YIFY
                    </ThemedText>
                </NavigationLink>

                {compact ? (
                    <>
                        {stacked ? <View style={styles.spacer}/> : (
                            <ScrollView
                                ref={navScroll}
                                onLayout={event => { navViewport.current = event.nativeEvent.layout.width; revealLink(active); }}
                                onScroll={event => { navOffset.current = event.nativeEvent.contentOffset.x; }}
                                onContentSizeChange={() => revealLink(active)}
                                scrollEventThrottle={16}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={[styles.links, styles.linksCompact]}
                                style={styles.phoneLinks}
                            >
                                {links.map(renderLink)}
                            </ScrollView>
                        )}
                        <View style={styles.actions}>
                            {showSearch ? (
                                <PressableScale
                                    onPress={openOverlay}
                                    hitSlop={6}
                                    accessibilityRole="button"
                                    accessibilityLabel="Search"
                                    pressedScale={0.94}
                                    pressedOpacity={0.6}
                                    contentStyle={styles.iconButton}
                                >
                                    <Ionicons name="search" size={22} color={colors.textMuted}/>
                                </PressableScale>
                            ) : null}
                            {preferencesButton}
                        </View>
                    </>
                ) : (
                    <>
                        <View style={styles.links}>{links.map(renderLink)}</View>
                        <View style={styles.searchArea}>{showSearch ? searchPill : null}</View>
                        {preferencesButton}
                    </>
                )}
            </View>

            {stacked ? (
                <ScrollView ref={navScroll} horizontal showsHorizontalScrollIndicator={false}
                    onLayout={event => { navViewport.current = event.nativeEvent.layout.width; revealLink(active); }}
                    onScroll={event => { navOffset.current = event.nativeEvent.contentOffset.x; }}
                    onContentSizeChange={() => revealLink(active)} scrollEventThrottle={16}
                    style={{height: navHeight}} contentContainerStyle={[styles.stackedLinks, {paddingHorizontal: gutter}]}>
                    {links.map(renderLink)}
                </ScrollView>
            ) : null}

            {below}

            {showSearch ? (
                <SearchOverlay
                    visible={overlayVisible}
                    initialQuery={query}
                    onClose={() => setOverlayVisible(false)}
                    onSubmit={routeQuery}
                />
            ) : null}
        </View>
    );
}

export function useTopBarHeight(): number {
    const insets = useSafeAreaInsets();
    const {width} = useResponsive();
    const {fontScale} = useWindowDimensions();
    const {rowHeight, navHeight, stacked} = navigationMetrics(width, fontScale);
    return insets.top + rowHeight + (stacked ? navHeight : 0);
}

const styles = StyleSheet.create({
    bar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    row: {
        height: TOP_BAR_ROW_HEIGHT,
        width: '100%',
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xl,
    },
    rowPhone: {gap: Spacing.sm},
    brandNavGap: {marginRight: Spacing.lg},
    brandHit: {minHeight: 44, justifyContent: 'center'},
    wordmark: {
        fontSize: 27,
        lineHeight: 34,
        letterSpacing: -1.3,
        ...Platform.select({web: {cursor: 'pointer'}, default: {}}),
    },
    wordmarkPhone: {fontSize: 23, lineHeight: 30, letterSpacing: -1},
    links: {flexDirection: 'row', alignItems: 'center', gap: Spacing.xl},
    linksCompact: {gap: Spacing.md},
    stackedLinks: {flexGrow: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md},
    navLinkHit: {flexShrink: 0},
    spacer: {flex: 1},
    phoneLinks: {flex: 1, minWidth: 0},
    link: {minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sm, flexShrink: 0},
    linkLabel: {fontSize: 14, lineHeight: 20},
    underline: {position: 'absolute', left: 0, right: 0, bottom: 2, height: 2},
    searchArea: {flex: 1, minWidth: 0, alignItems: 'flex-end'},
    actions: {flexDirection: 'row', alignItems: 'center', flexShrink: 0},
    iconButton: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
    avatar: {width: 26, height: 26, borderRadius: 13, borderWidth: 1.5},
    searchPill: {
        width: '100%',
        maxWidth: SEARCH_PILL_MAX_WIDTH,
        height: SEARCH_PILL_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: Radius.pill,
        overflow: 'hidden',
    },
    searchInput: {
        flex: 1,
        minWidth: 0,
        height: '100%',
        fontSize: 14,
        fontFamily: FontFamily.regular,
        paddingLeft: Spacing.lg,
        paddingRight: Spacing.sm,
    },
    clearButton: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
    searchButton: {
        width: SEARCH_BUTTON_WIDTH,
        alignSelf: 'stretch',
        alignItems: 'center',
        justifyContent: 'center',
        borderLeftWidth: 1,
    },
});
