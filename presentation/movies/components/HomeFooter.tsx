import {Platform, StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {Analytics} from '@/presentation/analytics/events';
import {enterRise} from '../../components/motion';
import {NavigationLink} from '../../components/navigation-link';
import {ThemedText} from '../../components/themed-text';
import {FontFamily, Spacing} from '../../constants/theme';
import {LEGAL_LINKS} from '../../constants/legal';
import {usePalette} from '../../hooks/use-palette';
import {useResponsive} from '../../hooks/use-responsive';
import {DESTINATIONS, useGoTo} from '../constants/destinations';
import {PlayStoreButton} from './PlayStoreButton';

interface FooterLink {
    label: string;
    href: string;
}

const BROWSE_LINKS: readonly FooterLink[] = DESTINATIONS
    .filter(({key}) => key !== 'history')
    .map(({label, href}) => ({label, href}));

const GENRE_LINKS: readonly FooterLink[] = [
    {label: 'Action', href: '/movies?genre=action'},
    {label: 'Comedy', href: '/movies?genre=comedy'},
    {label: 'Drama', href: '/movies?genre=drama'},
    {label: '4K Ultra HD', href: '/movies?quality=2160p'},
];

const APP_LINKS: readonly FooterLink[] = [{label: 'Preferences', href: '/preferences'}];

export function HomeFooter() {
    const {colors} = usePalette();
    const {isPhone, gutter} = useResponsive();
    const goTo = useGoTo();

    const go = (link: FooterLink) => {
        Analytics.footerLink(link.label);
        goTo(link.href);
    };

    const column = (title: string, links: readonly FooterLink[], index: number) => (
        <Animated.View entering={enterRise(index + 1)} style={styles.column} key={title}>
            <ThemedText style={[styles.columnTitle, {color: colors.text}]}>{title}</ThemedText>
            {links.map((link) => (
                <NavigationLink
                    key={link.label}
                    href={link.href}
                    onNavigate={() => go(link)}
                    accessibilityRole="link"
                    pressedScale={0.98}
                    pressedOpacity={0.6}
                    hoveredScale={1}
                    contentStyle={styles.linkHit}
                >
                    <ThemedText style={[styles.link, {color: colors.textMuted}]}>{link.label}</ThemedText>
                </NavigationLink>
            ))}
        </Animated.View>
    );

    return (
        <View style={[styles.footer, {borderTopColor: colors.border, paddingHorizontal: gutter}]}>
            <View style={[styles.top, isPhone && styles.topPhone]}>
                <Animated.View entering={enterRise()} style={styles.brand}>
                    <ThemedText type="title" style={[styles.wordmark, {color: colors.text}]}>
                        YIFY
                    </ThemedText>
                    <ThemedText style={[styles.tagline, {color: colors.textMuted}]}>
                        Explore films through trailers and ratings, and save a personal watchlist. Find where to watch in your country with links to streaming services.
                    </ThemedText>
                    <View style={styles.store}>
                        <PlayStoreButton source="home_footer"/>
                    </View>
                </Animated.View>

                <View style={[styles.columns, isPhone && styles.columnsPhone]}>
                    {column('Browse', BROWSE_LINKS, 0)}
                    {column('Genres', GENRE_LINKS, 1)}
                    {column('App', APP_LINKS, 2)}
                </View>
            </View>
            {Platform.OS === 'web' ? <View style={[styles.legal, {borderTopColor: colors.border}]}>
                <a href={`${process.env.EXPO_BASE_URL ?? ''}/guide/`}
                    onClick={() => Analytics.footerLink('How Yify works')}
                    style={{color: colors.textMuted, textDecoration: 'none', minHeight: 44, display: 'flex', alignItems: 'center'}}>
                    <ThemedText style={[styles.link, {color: colors.textMuted}]}>How Yify works</ThemedText>
                </a>
                {LEGAL_LINKS.map(link => <a key={link.url} href={link.url}
                    onClick={() => Analytics.footerLink(link.label)}
                    style={{color: colors.textMuted, textDecoration: 'none', minHeight: 44, display: 'flex', alignItems: 'center'}}>
                    <ThemedText style={[styles.link, {color: colors.textMuted}]}>{link.label}</ThemedText>
                </a>)}
            </View> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    footer: {
        marginTop: Spacing.xxl,
        paddingTop: Spacing.xxxl,
        paddingBottom: Spacing.xxl,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    top: {flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.xxxl},
    topPhone: {flexDirection: 'column', gap: Spacing.xxl},

    brand: {flexShrink: 1, maxWidth: 320, gap: Spacing.md},
    wordmark: {fontSize: 32, lineHeight: 42, letterSpacing: -1.5, fontFamily: FontFamily.displaySemibold},
    tagline: {fontSize: 14, lineHeight: 22, fontFamily: FontFamily.regular},
    store: {marginTop: Spacing.md},

    columns: {flexDirection: 'row', gap: Spacing.xxxl},
    columnsPhone: {gap: Spacing.lg, justifyContent: 'space-between'},
    column: {flexShrink: 1},
    columnTitle: {fontSize: 15, lineHeight: 22, marginBottom: Spacing.md, fontFamily: FontFamily.displaySemibold},
    link: {fontSize: 13, lineHeight: 19, fontFamily: FontFamily.regular},
    linkHit: {minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start'},
    legal: {flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xl, marginTop: Spacing.xxl, paddingTop: Spacing.lg, borderTopWidth: StyleSheet.hairlineWidth},

});
