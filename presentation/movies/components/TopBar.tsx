import {useCallback, useEffect, useState} from 'react';
import {Ionicons} from '@expo/vector-icons';
import {Platform, ScrollView, StyleSheet, TextInput, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LiquidGlassView} from '../../components/liquid-glass-view';
import {ThemedText} from '../../components/themed-text';
import {PressableScale} from '../../components/motion';
import {usePalette} from '../../hooks/use-palette';
import {useResponsive} from '../../hooks/use-responsive';
import {Radius, Spacing} from '../../constants/theme';
import {Analytics} from '@/lib/analytics-events';
import {DESTINATIONS, useGoTo} from '../constants/destinations';
import {SearchOverlay, rememberRecentSearch} from './SearchOverlay';

export type NavKey = 'home' | 'movies' | 'shows' | 'my-list' | 'settings';

export const TOP_BAR_ROW_HEIGHT = 56;

const SEARCH_PILL_HEIGHT = 40;
const SEARCH_PILL_MAX_WIDTH = 560;
const SEARCH_BUTTON_WIDTH = 62;
const SETTINGS_HREF = '/settings';

interface NavLink {
    key: NavKey;
    label: string;
    href: string;
    upcoming?: boolean;
}

const NAV_LINKS: readonly NavLink[] = DESTINATIONS.filter((destination) => destination.key !== 'home');

export function TopBar({
                           active,
                           onSearchSubmit,
                           searchValue,
                           showSearch = true,
                           below,
                       }: {
    active?: NavKey;
    onSearchSubmit?: (q: string) => void;
    searchValue?: string;
    showSearch?: boolean;
    below?: React.ReactNode;
}) {
    const insets = useSafeAreaInsets();
    const {colors, scheme} = usePalette();
    const {isPhone, gutter} = useResponsive();
    const goTo = useGoTo();
    const [query, setQuery] = useState(searchValue ?? '');
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

    const submitQuery = useCallback(
        (term: string) => {
            const trimmed = term.trim();
            if (!trimmed) return;
            rememberRecentSearch(trimmed);
            Analytics.search(trimmed);
            routeQuery(trimmed);
        },
        [routeQuery]
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
            <PressableScale
                key={link.key}
                onPress={() => navigate(link.key, link.href)}
                hitSlop={6}
                accessibilityRole="link"
                accessibilityState={{selected}}
                pressedScale={0.94}
                pressedOpacity={0.6}
                contentStyle={styles.link}
            >
                <ThemedText
                    style={[
                        styles.linkLabel,
                        selected ? {color: colors.text, fontWeight: '700'} : {color: colors.textMuted},
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
            </PressableScale>
        );
    };

    const settingsButton = (
        <PressableScale
            onPress={() => navigate('settings', SETTINGS_HREF)}
            hitSlop={6}
            accessibilityRole="link"
            accessibilityLabel="Settings"
            accessibilityState={{selected: active === 'settings'}}
            pressedScale={0.86}
            pressedOpacity={0.6}
            hoveredScale={1.08}
            contentStyle={styles.iconButton}
        >
            <Ionicons
                name="settings-outline"
                size={22}
                color={active === 'settings' ? colors.accent : colors.textMuted}
            />
        </PressableScale>
    );

    const searchPill = (
        <View
            style={[
                styles.searchPill,
                {backgroundColor: colors.surfaceSunken, borderColor: colors.border},
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
                onSubmitEditing={() => submitQuery(query)}
                placeholder="Search"
                placeholderTextColor={colors.textFaint}
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
                    pressedScale={0.85}
                    pressedOpacity={0.6}
                    hoveredScale={1.12}
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
                    {backgroundColor: colors.surface, borderLeftColor: colors.border},
                ]}
            >
                <Ionicons name="search" size={18} color={colors.textMuted}/>
            </PressableScale>
        </View>
    );

    return (
        <View style={[styles.bar, {paddingTop: insets.top}]}>
            <LiquidGlassView
                tint={scheme === 'dark' ? 'dark' : 'light'}
                fallbackBackgroundColor={
                    scheme === 'dark' ? 'rgba(15,15,15,0.82)' : 'rgba(255,255,255,0.86)'
                }
                style={StyleSheet.absoluteFill}
            />
            <View style={[styles.row, {paddingHorizontal: gutter}]}>
                <PressableScale
                    onPress={() => navigate('home', '/')}
                    accessibilityRole="link"
                    accessibilityLabel="Yify home"
                    pressedScale={0.92}
                    pressedOpacity={0.7}
                    hoveredScale={1.04}
                >
                    <ThemedText type="title" style={[styles.wordmark, {color: colors.accent}]}>
                        YIFY
                    </ThemedText>
                </PressableScale>

                {isPhone ? (
                    <>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.links}
                            style={styles.phoneLinks}
                        >
                            {NAV_LINKS.map(renderLink)}
                        </ScrollView>
                        <View style={styles.spacer}/>
                        <View style={styles.actions}>
                            {showSearch ? (
                                <PressableScale
                                    onPress={openOverlay}
                                    hitSlop={6}
                                    accessibilityRole="button"
                                    accessibilityLabel="Search"
                                    pressedScale={0.86}
                                    pressedOpacity={0.6}
                                    contentStyle={styles.iconButton}
                                >
                                    <Ionicons name="search" size={22} color={colors.textMuted}/>
                                </PressableScale>
                            ) : null}
                            {settingsButton}
                        </View>
                    </>
                ) : (
                    <>
                        <View style={styles.links}>{NAV_LINKS.map(renderLink)}</View>
                        <View style={styles.searchArea}>{showSearch ? searchPill : null}</View>
                        {settingsButton}
                    </>
                )}
            </View>

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
    return insets.top + TOP_BAR_ROW_HEIGHT;
}

const styles = StyleSheet.create({
    bar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
    },
    row: {
        height: TOP_BAR_ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.lg,
    },
    wordmark: {
        fontSize: 20,
        lineHeight: 26,
        letterSpacing: 0.6,
        ...Platform.select({web: {cursor: 'pointer'}, default: {}}),
    },
    links: {flexDirection: 'row', alignItems: 'center', gap: Spacing.xl},
    phoneLinks: {flexGrow: 0, flexShrink: 1},
    link: {alignItems: 'center', justifyContent: 'center', paddingVertical: 6},
    linkLabel: {fontSize: 14.5, lineHeight: 20},
    underline: {position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, borderRadius: 1},
    searchArea: {flex: 1, alignItems: 'center', paddingHorizontal: Spacing.md},
    spacer: {flex: 1},
    actions: {flexDirection: 'row', alignItems: 'center', gap: Spacing.xs},
    iconButton: {width: 40, height: 40, alignItems: 'center', justifyContent: 'center'},
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
        height: '100%',
        fontSize: 15,
        paddingLeft: Spacing.lg,
        paddingRight: Spacing.sm,
    },
    clearButton: {width: 32, height: 32, alignItems: 'center', justifyContent: 'center'},
    searchButton: {
        width: SEARCH_BUTTON_WIDTH,
        alignSelf: 'stretch',
        alignItems: 'center',
        justifyContent: 'center',
        borderLeftWidth: 1,
    },
});
