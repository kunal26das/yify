import {Ionicons} from '@expo/vector-icons';
import {router, usePathname} from 'expo-router';
import {Animated, Platform, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LiquidGlassView} from '../../components/liquid-glass-view';
import {ThemedText} from '../../components/themed-text';
import {usePalette} from '../../hooks/use-palette';
import {useResponsive} from '../../hooks/use-responsive';
import {FontFamily, Spacing} from '../../constants/theme';
import {Analytics} from '@/lib/analytics-events';
import {DESTINATIONS, goToDestination} from '../constants/destinations';

const SOLID_AT = 90;

export type NavKey = 'home' | 'movies' | 'new' | 'my-list' | 'settings';

interface NavItem {
    key: NavKey;
    label: string;
    href: string;
}

const NAV_ITEMS: readonly NavItem[] = DESTINATIONS;

const SETTINGS_ITEM: NavItem = {key: 'settings', label: 'Settings', href: '/settings'};

export function TopNav({
                           active,
                           scrollY,
                           onBack,
                       }: {
    active?: NavKey;
    scrollY?: Animated.Value;
    onBack?: () => void;
}) {
    const insets = useSafeAreaInsets();
    const {colors, scheme} = usePalette();
    const {isPhone, gutter} = useResponsive();
    const pathname = usePathname();

    const backgroundOpacity = scrollY
        ? scrollY.interpolate({
              inputRange: [0, SOLID_AT],
              outputRange: [0, 1],
              extrapolate: 'clamp',
          })
        : 1;

    const go = (item: NavItem) => {
        Analytics.navSelect(item.key);
        goToDestination(item.href, pathname);
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
    phoneLinks: {flex: 1},
    link: {paddingVertical: 4},
    linkLabel: {fontSize: 14.5},
    spacer: {flex: 1},
});
