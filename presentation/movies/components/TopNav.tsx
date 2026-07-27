import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {Animated, Platform, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LiquidGlassView} from '../../components/liquid-glass-view';
import {ThemedText} from '../../components/themed-text';
import {usePalette} from '../../hooks/use-palette';
import {useResponsive} from '../../hooks/use-responsive';
import {FontFamily, Spacing} from '../../constants/theme';
import {Analytics} from '@/lib/analytics-events';
import {OrderBy, SortBy} from '../constants/movieFilterOptions';

/** Distance scrolled before the bar is fully opaque — roughly the height of the bar itself. */
const SOLID_AT = 90;

export type NavKey = 'home' | 'movies' | 'new' | 'my-list' | 'settings';

interface NavItem {
    key: NavKey;
    label: string;
    href: string;
}

const NAV_ITEMS: readonly NavItem[] = [
    {key: 'home', label: 'Home', href: '/'},
    {key: 'movies', label: 'Movies', href: '/browse'},
    {
        key: 'new',
        label: 'New & Popular',
        href: `/browse?sort_by=${SortBy.DateAdded}&order_by=${OrderBy.Desc}`,
    },
    {key: 'my-list', label: 'My List', href: '/my-list'},
];

// Kept out of the row above: it's a utility destination, not part of the catalogue, so on wide
// screens it sits at the far end of the bar rather than among the browse links.
const SETTINGS_ITEM: NavItem = {key: 'settings', label: 'Settings', href: '/settings'};

/**
 * The app bar over the billboard: transparent while the hero is in view and fading to a solid
 * surface as the rails scroll under it.
 *
 * `scrollY` drives that fade on the native thread, so it stays smooth on a list that is also busy
 * mounting shelves. Without a `scrollY` the bar renders permanently solid, which is what secondary
 * screens (Browse, My List) want.
 */
export function TopNav({
                           active,
                           scrollY,
                           onBack,
                       }: {
    /** Omitted on screens that aren't a nav destination, such as movie details. */
    active?: NavKey;
    scrollY?: Animated.Value;
    onBack?: () => void;
}) {
    const insets = useSafeAreaInsets();
    const {colors, scheme} = usePalette();
    const {isPhone, gutter} = useResponsive();

    const backgroundOpacity = scrollY
        ? scrollY.interpolate({
              inputRange: [0, SOLID_AT],
              outputRange: [0, 1],
              extrapolate: 'clamp',
          })
        : 1;

    const go = (item: NavItem) => {
        if (item.key === active) return;
        Analytics.navSelect(item.key);
        router.push(item.href as never);
    };

    const renderLink = (item: NavItem) => (
        <Pressable
            key={item.key}
            onPress={() => go(item)}
            hitSlop={6}
            accessibilityRole="link"
            accessibilityState={{selected: item.key === active}}
            style={({pressed}) => [styles.link, {opacity: pressed ? 0.6 : 1}]}
        >
            <ThemedText
                style={[
                    styles.linkLabel,
                    item.key === active
                        ? {color: colors.text, fontFamily: FontFamily.bold}
                        : {color: colors.textMuted},
                ]}
            >
                {item.label}
            </ThemedText>
        </Pressable>
    );

    const links = NAV_ITEMS.map(renderLink);

    return (
        <View style={styles.bar} pointerEvents="box-none">
            <Animated.View style={[StyleSheet.absoluteFill, {opacity: backgroundOpacity}]} pointerEvents="none">
                <LiquidGlassView
                    tint={scheme === 'dark' ? 'dark' : 'light'}
                    fallbackBackgroundColor={
                        scheme === 'dark' ? 'rgba(20,20,22,0.88)' : 'rgba(250,249,245,0.9)'
                    }
                    style={StyleSheet.absoluteFill}
                />
                <View style={[styles.hairline, {backgroundColor: colors.border}]}/>
            </Animated.View>

            <View style={[styles.row, {paddingTop: insets.top + 6, paddingHorizontal: gutter}]} pointerEvents="box-none">
                {/* The browser supplies its own back affordance, so the bar only carries one on
                    native, where there is no chrome around the app. */}
                {onBack && Platform.OS !== 'web' ? (
                    <Pressable
                        onPress={onBack}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                        style={({pressed}) => [styles.backButton, {opacity: pressed ? 0.6 : 1}]}
                    >
                        <Ionicons name="chevron-back" size={24} color={colors.text}/>
                    </Pressable>
                ) : null}

                <Pressable
                    onPress={() => go(NAV_ITEMS[0])}
                    accessibilityRole="link"
                    accessibilityLabel="Yify home"
                    style={({pressed}) => ({opacity: pressed ? 0.7 : 1})}
                >
                    <ThemedText type="title" style={[styles.wordmark, {color: colors.accent}]}>
                        YIFY
                    </ThemedText>
                </Pressable>

                {/* One row at every size. A phone can't fit four labels beside the wordmark, so the
                    links scroll horizontally there instead of wrapping onto a second row. */}
                {isPhone ? (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.links}
                        style={styles.phoneLinks}
                    >
                        {links}
                        {renderLink(SETTINGS_ITEM)}
                    </ScrollView>
                ) : (
                    <>
                        <View style={styles.links}>{links}</View>
                        <View style={styles.spacer}/>
                        {renderLink(SETTINGS_ITEM)}
                    </>
                )}
            </View>

        </View>
    );
}

/** Height the nav occupies, so screens can offset their first row clear of it. */
export function useTopNavHeight(): number {
    const insets = useSafeAreaInsets();
    return insets.top + 58;
}

const styles = StyleSheet.create({
    bar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
    },
    hairline: {position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth},
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 8,
        gap: Spacing.lg,
    },
    backButton: {marginRight: -Spacing.sm},
    wordmark: {
        fontSize: 24,
        letterSpacing: 1.5,
        fontFamily: FontFamily.displayExtra,
        ...Platform.select({web: {cursor: 'pointer'}, default: {}}),
    },
    links: {flexDirection: 'row', alignItems: 'center', gap: Spacing.xl},
    // Takes the remaining width so the links scroll within it rather than pushing the row wider.
    phoneLinks: {flex: 1},
    link: {paddingVertical: 4},
    linkLabel: {fontSize: 14.5},
    spacer: {flex: 1},
});
