import {Ionicons} from '@expo/vector-icons';
import {Animated, Platform, ScrollView, StyleSheet, View} from 'react-native';
import Reanimated from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LiquidGlassView} from '../../components/liquid-glass-view';
import {ThemedText} from '../../components/themed-text';
import {Duration, PressableScale} from '../../components/motion';
import {usePalette} from '../../hooks/use-palette';
import {useResponsive} from '../../hooks/use-responsive';
import {FontFamily, Spacing} from '../../constants/theme';
import {Analytics} from '@/lib/analytics-events';
import {DESTINATIONS, useGoTo} from '../constants/destinations';

const SOLID_AT = 90;

const ROW_PADDING_TOP = 6;
const ROW_PADDING_BOTTOM = 8;
const NAV_FONT_SIZE = 14.5;
const NAV_LINE_HEIGHT = 24;

export type NavKey = 'home' | 'movies' | 'new' | 'my-list' | 'settings';

interface NavItem {
    key: NavKey;
    label: string;
    href: string;
}

const NAV_ITEMS: readonly NavItem[] = DESTINATIONS.filter((d) => d.key !== 'home');

const SETTINGS_ITEM: NavItem = {key: 'settings', label: 'Settings', href: '/settings'};

const HOME_ITEM: NavItem = {key: 'home', label: 'Home', href: '/'};

export function TopNav({
                           active,
                           scrollY,
                           below,
                           inline,
                       }: {
    active?: NavKey;
    scrollY?: Animated.Value;
    below?: React.ReactNode;
    inline?: React.ReactNode;
}) {
    const insets = useSafeAreaInsets();
    const {colors, scheme} = usePalette();
    const {isPhone, gutter} = useResponsive();
    const goTo = useGoTo();

    const backgroundOpacity = scrollY
        ? scrollY.interpolate({
              inputRange: [0, SOLID_AT],
              outputRange: [0, 1],
              extrapolate: 'clamp',
          })
        : 1;

    const go = (item: NavItem) => {
        Analytics.navSelect(item.key);
        goTo(item.href);
    };

    const renderLink = (item: NavItem) => {
        const selected = item.key === active;
        return (
            <PressableScale
                key={item.key}
                onPress={() => go(item)}
                hitSlop={6}
                accessibilityRole="link"
                accessibilityState={{selected}}
                pressedScale={0.92}
                pressedOpacity={0.6}
                contentStyle={styles.link}
            >
                <ThemedText
                    style={[
                        styles.linkLabel,
                        selected
                            ? {color: colors.text, fontFamily: FontFamily.bold}
                            : {color: colors.textMuted},
                    ]}
                >
                    {item.label}
                </ThemedText>
                <Reanimated.View
                    style={[
                        styles.underline,
                        {
                            backgroundColor: colors.accent,
                            opacity: selected ? 1 : 0,
                            transform: [{scaleX: selected ? 1 : 0}],
                            transitionProperty: ['opacity', 'transform'],
                            transitionDuration: Duration.base,
                            transitionTimingFunction: 'ease-out',
                        },
                    ]}
                />
            </PressableScale>
        );
    };

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

            <View style={[styles.row, {paddingTop: insets.top + ROW_PADDING_TOP, paddingHorizontal: gutter}]} pointerEvents="box-none">
                <PressableScale
                    onPress={() => go(HOME_ITEM)}
                    accessibilityRole="link"
                    accessibilityLabel="Yify home"
                    pressedScale={0.9}
                    pressedOpacity={0.7}
                    hoveredScale={1.06}
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
                            {links}
                        </ScrollView>
                        <PressableScale
                            onPress={() => go(SETTINGS_ITEM)}
                            hitSlop={8}
                            accessibilityRole="link"
                            accessibilityLabel="Settings"
                            accessibilityState={{selected: active === 'settings'}}
                            pressedScale={0.86}
                            pressedOpacity={0.6}
                            hoveredScale={1.1}
                            style={styles.settingsButton}
                        >
                            <Reanimated.View
                                style={{
                                    transform: [{rotate: active === 'settings' ? '90deg' : '0deg'}],
                                    transitionProperty: 'transform',
                                    transitionDuration: Duration.slow,
                                    transitionTimingFunction: 'ease-out',
                                }}
                            >
                                <Ionicons
                                    name={active === 'settings' ? 'settings' : 'settings-outline'}
                                    size={22}
                                    color={active === 'settings' ? colors.text : colors.textMuted}
                                />
                            </Reanimated.View>
                        </PressableScale>
                    </>
                ) : (
                    <>
                        <View style={styles.links}>{links}</View>
                        {inline ? (
                            <View style={styles.inlineSlot}>{inline}</View>
                        ) : (
                            <View style={styles.spacer}/>
                        )}
                        {renderLink(SETTINGS_ITEM)}
                    </>
                )}
            </View>

            {below}
        </View>
    );
}

export function useTopNavHeightWithSearch(): number {
    return useTopNavHeight() + SEARCH_ROW_HEIGHT;
}

export const SEARCH_ROW_HEIGHT = 44 + Spacing.sm * 2;

export const INLINE_SEARCH_HEIGHT = 32;

const NAV_ROW_HEIGHT = ROW_PADDING_TOP + NAV_LINE_HEIGHT + ROW_PADDING_BOTTOM;

export function useTopNavHeight(): number {
    const insets = useSafeAreaInsets();
    return insets.top + NAV_ROW_HEIGHT;
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
        paddingBottom: ROW_PADDING_BOTTOM,
        gap: Spacing.lg,
    },
    wordmark: {
        fontSize: NAV_FONT_SIZE,
        lineHeight: NAV_LINE_HEIGHT,
        letterSpacing: 1.5,
        fontFamily: FontFamily.displayExtra,
        ...Platform.select({web: {cursor: 'pointer'}, default: {}}),
    },
    links: {flexDirection: 'row', alignItems: 'center', gap: Spacing.xl},
    inlineSlot: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: (NAV_LINE_HEIGHT - INLINE_SEARCH_HEIGHT) / 2,
    },
    phoneLinks: {flex: 1},
    settingsButton: {marginLeft: -Spacing.sm},
    link: {paddingVertical: 4},
    linkLabel: {fontSize: NAV_FONT_SIZE, lineHeight: NAV_LINE_HEIGHT},
    underline: {height: 2, borderRadius: 1, marginTop: 1},
    spacer: {flex: 1},
});
